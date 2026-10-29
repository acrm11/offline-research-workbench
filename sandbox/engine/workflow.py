from __future__ import annotations

import copy
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from .repository import Repository


CN_TZ = timezone(timedelta(hours=8))


def now_iso() -> str:
    return datetime.now(CN_TZ).isoformat(timespec="seconds")


class WorkflowService:
    """Small sandbox workflow. It mutates runtime state, never source configs."""

    def __init__(self, repository: Repository) -> None:
        self.repository = repository

    def save_draft(self, object_id: str, step_id: str, patch: dict[str, Any], actor: str) -> dict[str, Any]:
        state = self.repository.load_state()
        change_id = f"CH-{uuid.uuid4().hex[:6].upper()}"
        change = {
            "id": change_id,
            "object_id": object_id,
            "step_id": step_id,
            "field": "structured_patch",
            "current": None,
            "suggested": patch,
            "status": "SAVED_TO_DRAFT",
            "source": "HUMAN_EDIT",
            "reason_zh": "用户在 Sandbox Workbench 中保存的结构化 Draft。",
            "at": now_iso(),
            "actor": actor,
        }
        state.setdefault("draft_changes", []).insert(0, change)
        state.setdefault("object_overrides", {}).setdefault(object_id, {}).setdefault("config", {})
        Repository._deep_merge(state["object_overrides"][object_id]["config"], patch)
        state.setdefault("audit_log", []).insert(0, {
            "at": now_iso(), "actor": actor, "action": "SAVE_DRAFT", "target": change_id
        })
        self.repository.save_state(state)
        return {"ok": True, "change": change, "state": state}

    def accept_llm_patch(self, payload: dict[str, Any], actor: str) -> dict[str, Any]:
        object_id = payload.get("object_id", "TR02")
        step_id = payload.get("step_id", "T04")
        patch = payload.get("patch", {})
        result = self.save_draft(object_id, step_id, patch, actor)
        result["change"]["source"] = "LLM_ASSIST_ACCEPTED_BY_HUMAN"
        state = self.repository.load_state()
        if state.get("draft_changes"):
            state["draft_changes"][0]["source"] = "LLM_ASSIST_ACCEPTED_BY_HUMAN"
            state["draft_changes"][0]["status"] = "ACCEPTED_TO_DRAFT"
        self.repository.save_state(state)
        result["state"] = state
        return result

    def llm_suggestion(self, object_id: str, step_id: str) -> dict[str, Any]:
        suggestions = {
            "T02": {
                "title": "补充 Eligibility 边界案例",
                "reason_zh": "联名账户 ownership 不清时不应进入有效分母。",
                "patch": {"eligibility": {"ambiguous_owner": "EXCLUDE_WITH_REASON"}},
                "impact_zh": "会影响 T02 分母，并要求重新运行 T03–T08。"
            },
            "T04": {
                "title": "增加大额已知义务的 UNKNOWN 分支",
                "reason_zh": "四个 bad case 缺少完整义务信息，继续评分可能夸大流动性取向。",
                "patch": {"rival_policy": {"missing_material_obligation": "UNKNOWN_DEFER"}},
                "impact_zh": "T04 unresolved 数量可能上升，T05 可评分 population 可能下降。"
            },
            "S03": {
                "title": "冻结进入前 Baseline",
                "reason_zh": "进入后滚动会吸收 episode 信号并导致状态提前消失。",
                "patch": {"baseline_rolling_after_entry": False},
                "impact_zh": "需要重新运行 S03–S08。"
            },
            "G01": {
                "title": "明确到期日冲突返回 UNKNOWN",
                "reason_zh": "两个权威来源 due_at 不一致时不能继续机械判断。",
                "patch": {"unknown_on_due_date_conflict": True},
                "impact_zh": "会增加 G04/G05 的 UNKNOWN，但降低误报。"
            }
        }
        suggestion = copy.deepcopy(suggestions.get(step_id, suggestions["T04"]))
        suggestion.update({
            "object_id": object_id,
            "step_id": step_id,
            "mode": "SUGGESTION_ONLY",
            "can_write_active": False
        })
        return suggestion

    def run_object(self, object_id: str, actor: str, parent_run: str | None = None) -> dict[str, Any]:
        if object_id != "TR02":
            return {"ok": False, "error": "MVP1 只为 TR02 提供完整自动研究 Mock Run。"}
        state = self.repository.load_state()
        base = self.repository.bootstrap()["tr02_run"]
        run_id = f"run-tr02-{datetime.now(CN_TZ).strftime('%Y%m%d-%H%M%S')}"
        run = {
            "id": run_id,
            "object_id": "TR02",
            "line": "trait",
            "status": "WARNING",
            "snapshot_id": base["snapshot_id"],
            "config_version": "tr02-draft-runtime",
            "started_at": now_iso(),
            "duration_seconds": 101,
            "parent_run": parent_run,
        }
        state.setdefault("runs", []).insert(0, run)
        state.setdefault("object_overrides", {}).setdefault("TR02", {}).update({
            "automated_run": "WARNING",
            "gate_b": "PENDING",
            "current_stage": "T09",
            "current_stage_zh": "Gate B 评审",
            "last_run": run["started_at"]
        })
        state.setdefault("audit_log", []).insert(0, {
            "at": now_iso(), "actor": actor, "action": "RUN_AUTOMATED_RESEARCH", "target": run_id
        })
        self.repository.save_state(state)
        return {"ok": True, "run": run, "state": state}

    def review(self, review_id: str, decision: str, comment: str, actor: str) -> dict[str, Any]:
        state = self.repository.load_state()
        review = next((item for item in state.get("reviews", []) if item["id"] == review_id), None)
        if not review:
            return {"ok": False, "error": "Review 不存在。"}
        normalized = decision.upper()
        review["decision"] = normalized
        review["status"] = "DECIDED" if normalized in {"APPROVE", "DEFER", "REJECT", "REDEFINE"} else "CHANGES_REQUESTED"
        review["comment"] = comment
        review["decided_by"] = actor
        review["decided_at"] = now_iso()
        override = state.setdefault("object_overrides", {}).setdefault(review["object_id"], {})
        if review["type"] == "Gate A" and normalized == "APPROVE":
            override.update({"gate_a": "APPROVED", "current_stage_zh": "等待自动研究"})
        if review["type"] == "Gate B":
            override["gate_b"] = normalized
            if normalized == "APPROVE":
                override.update({"status": "SANDBOX_RELEASED", "validation": "SANDBOX_ONLY"})
            elif normalized == "DEFER":
                override.update({"status": "ACTIVE_WORKING", "validation": "NOT_YET_DEMONSTRATED"})
        state.setdefault("audit_log", []).insert(0, {
            "at": now_iso(), "actor": actor, "action": f"REVIEW_{normalized}", "target": review_id
        })
        self.repository.save_state(state)
        return {"ok": True, "review": review, "state": state}

    def create_object(self, payload: dict[str, Any], actor: str) -> dict[str, Any]:
        state = self.repository.load_state()
        object_id = str(payload.get("id", "NEW01")).upper()
        state.setdefault("object_overrides", {})[object_id] = {
            "id": object_id,
            "name": payload.get("name", "Untitled Research Object"),
            "name_zh": payload.get("name_zh", "未命名研究对象"),
            "description_zh": payload.get("description_zh", "Sandbox 中创建的研究对象草案。"),
            "line": payload.get("line", "trait"),
            "owner": actor,
            "status": "DRAFT",
            "version": f"{object_id.lower()}-draft-v0",
            "current_stage": "T01" if payload.get("line") == "trait" else ("S01" if payload.get("line") == "state" else "G01"),
            "current_stage_zh": "Cold Start",
            "gate_a": "DRAFT",
            "automated_run": "NOT_STARTED",
            "gate_b": "LOCKED",
            "validation": "NOT_STARTED",
            "snapshot_id": "尚未绑定",
            "last_run": None,
            "config": {}
        }
        state.setdefault("audit_log", []).insert(0, {
            "at": now_iso(), "actor": actor, "action": "CREATE_DRAFT_OBJECT", "target": object_id
        })
        self.repository.save_state(state)
        return {"ok": True, "object": state["object_overrides"][object_id], "state": state}

