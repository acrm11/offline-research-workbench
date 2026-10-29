from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = ROOT / "configs"
MOCK_DIR = ROOT / "mock_data"
RUNTIME_DIR = ROOT / "runtime"
STATE_PATH = RUNTIME_DIR / "state.json"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    temporary.replace(path)


class Repository:
    """Loads immutable configs and persists only sandbox runtime state."""

    def __init__(self) -> None:
        RUNTIME_DIR.mkdir(parents=True, exist_ok=True)

    def load_state(self) -> dict[str, Any]:
        if not STATE_PATH.exists():
            initial = load_json(MOCK_DIR / "initial_state.json")
            initial.setdefault("object_overrides", {})
            save_json(STATE_PATH, initial)
        state = load_json(STATE_PATH)
        state.setdefault("object_overrides", {})
        return state

    def save_state(self, state: dict[str, Any]) -> None:
        save_json(STATE_PATH, state)

    def reset_state(self) -> dict[str, Any]:
        state = load_json(MOCK_DIR / "initial_state.json")
        state.setdefault("object_overrides", {})
        save_json(STATE_PATH, state)
        return state

    def bootstrap(self) -> dict[str, Any]:
        app = load_json(CONFIG_DIR / "app.json")
        lines = load_json(CONFIG_DIR / "lines.json")
        objects_payload = load_json(CONFIG_DIR / "objects.json")
        public_chain = load_json(CONFIG_DIR / "public_chain.json")
        trace = load_json(MOCK_DIR / "public_chain_trace.json")
        tr02_run = load_json(MOCK_DIR / "tr02_run.json")
        state = self.load_state()

        objects = copy.deepcopy(objects_payload["objects"])
        overrides = state.get("object_overrides", {})
        base_ids = {item["id"] for item in objects}
        for item in objects:
            override = overrides.get(item["id"], {})
            self._deep_merge(item, override)
        for object_id, override in overrides.items():
            if object_id not in base_ids:
                objects.append(copy.deepcopy(override))

        return {
            "app": app,
            "lines": lines,
            "objects": objects,
            "public_chain": public_chain,
            "public_chain_trace": trace,
            "tr02_run": tr02_run,
            "state": state,
            "config_registry": [
                {"id": "app", "path": "configs/app.json", "kind": "Application", "active": True},
                {"id": "lines", "path": "configs/lines.json", "kind": "Pipeline definitions", "active": True},
                {"id": "objects", "path": "configs/objects.json", "kind": "Research objects", "active": True},
                {"id": "public-chain", "path": "configs/public_chain.json", "kind": "Public chain", "active": True},
                {"id": "tr02-run", "path": "mock_data/tr02_run.json", "kind": "Mock run", "active": False},
                {"id": "runtime", "path": "runtime/state.json", "kind": "Sandbox runtime", "active": False}
            ]
        }

    @staticmethod
    def _deep_merge(target: dict[str, Any], patch: dict[str, Any]) -> None:
        for key, value in patch.items():
            if isinstance(value, dict) and isinstance(target.get(key), dict):
                Repository._deep_merge(target[key], value)
            else:
                target[key] = copy.deepcopy(value)

