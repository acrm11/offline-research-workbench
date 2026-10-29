const state = {
  data: null,
  workspaceTab: "overview",
  selectedReview: null,
  llmSuggestion: null,
  busy: false,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pretty(value) {
  return JSON.stringify(value ?? null, null, 2);
}

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
  }).format(parsed);
}

function statusLabel(value) {
  const labels = {
    PASSED: "通过", APPROVED: "已批准", WARNING: "有警告", PENDING: "待审核",
    IN_REVIEW: "审核中", NEEDS_HUMAN_REVIEW: "需人工审核", FAILED: "失败",
    DRAFT: "草稿", NOT_STARTED: "未开始", LOCKED: "已锁定", DEFER: "延期",
    NOT_YET_DEMONSTRATED: "尚未证明", SANDBOX_RELEASED: "Sandbox 已发布",
    ACTIVE_WORKING: "研究中", DECIDED: "已决策", BLOCKING: "阻塞"
  };
  return labels[value] || String(value || "—");
}

function status(value) {
  return `<span class="status ${esc(value)}">${esc(statusLabel(value))}</span>`;
}

function lineTag(line) {
  const label = state.data?.lines?.[line]?.label || line;
  return `<span class="tag ${esc(line)}">${esc(label)}</span>`;
}

function navItem(hash, icon, label, route, badge = "", extra = "") {
  const active = route === "workspace" ? extra : (currentRoute().name === route ? "active" : "");
  return `<a class="nav-item ${active}" href="${hash}"><span class="nav-icon">${icon}</span><span>${label}</span>${badge ? `<span class="nav-badge">${badge}</span>` : ""}</a>`;
}

function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, "") || "overview";
  const parts = raw.split("/").filter(Boolean);
  if (parts[0] === "workspace") return { name: "workspace", line: parts[1] || "trait", objectId: parts[2] || "TR02", stepId: parts[3] || null };
  if (parts[0] === "public") return { name: "public", stepId: parts[1] || "CALL" };
  return { name: parts[0] || "overview" };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
  return payload;
}

async function reload() {
  state.data = await api("/api/bootstrap");
}

function renderShell(content, title = "Overview") {
  const app = state.data.app;
  const reviewCount = state.data.state.reviews.filter(r => !["DECIDED"].includes(r.status)).length;
  const badCount = state.data.state.bad_cases.filter(b => !["CLOSED"].includes(b.status)).length;
  $("#app").className = "app-shell";
  $("#app").innerHTML = `
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">D</div><div class="brand-copy"><strong>${esc(app.product_name)}</strong><span>${esc(app.product_subtitle)}</span></div></div>
      <div class="side-scroll">
        <div class="nav-group"><div class="nav-label">WORKSPACE</div>
          ${navItem("#/overview", "O", "总览", "overview")}
          ${navItem("#/public/CALL", "P", "公共链路", "public")}
        </div>
        <div class="nav-group"><div class="nav-label">RESEARCH WORKSPACES</div>
          ${navItem("#/workspace/trait/TR02/T01", "T", "Trait", "workspace", "", currentRoute().line === "trait" ? "active" : "")}
          ${navItem("#/workspace/state/ST01/S01", "S", "State", "workspace", "", currentRoute().line === "state" ? "active" : "")}
          ${navItem("#/workspace/signal/SG01/G01", "G", "Signal", "workspace", "", currentRoute().line === "signal" ? "active" : "")}
        </div>
        <div class="nav-group"><div class="nav-label">CONTROL PLANE</div>
          ${navItem("#/validation", "V", "验证中心", "validation", reviewCount)}
          ${navItem("#/runs", "R", "运行与回放", "runs")}
          ${navItem("#/config", "C", "配置注册表", "config")}
          ${navItem("#/monitoring", "M", "监控与 Bad Cases", "monitoring", badCount)}
          ${navItem("#/guide", "?", "使用说明", "guide")}
        </div>
        <div class="nav-group"><div class="nav-label">LATER PHASE</div>
          ${app.later_phase_lines.map((item, index) => `<button class="nav-item later" disabled><span class="nav-icon">L${index}</span><span>${esc(item)}</span></button>`).join("")}
        </div>
      </div>
      <div class="sandbox-note"><strong>◇ Sandbox 环境</strong><span>MVP1 禁止 Production Release，所有写操作只生成 Draft。</span></div>
      <div class="user-card"><div class="avatar">${esc(app.user.initials)}</div><div class="user-copy"><strong>${esc(app.user.name)}</strong><span>${esc(app.user.role)}</span></div></div>
    </aside>
    <header class="topbar">
      <div class="crumbs"><strong>${esc(app.product_name)}</strong><span>›</span><span>${esc(title)}</span></div>
      <div class="global-search"><input id="global-search" placeholder="搜索对象、运行、配置…" aria-label="全局搜索"></div>
      <div class="top-meta"><span><i class="env-dot"></i>${esc(app.environment)}</span><span class="top-divider"></span><span class="snapshot mono">▱ ${esc(app.snapshot_id)}</span><span class="avatar">${esc(app.user.initials)}</span></div>
    </header>
    <main class="main">${content}</main>`;
}

function pageHeader(eyebrow, title, description, actions = "") {
  return `<div class="page-header"><div class="page-heading"><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="actions">${actions}</div></div>`;
}

function renderOverview() {
  const objects = state.data.objects;
  const pending = state.data.state.reviews.filter(r => r.status !== "DECIDED").length;
  const cards = `
    <div class="grid cols-4">
      <div class="stat"><span class="label">MVP 范围</span><span class="value">${objects.length}</span><span class="context">当前研究对象</span></div>
      <div class="stat"><span class="label">未来槽位</span><span class="value">${state.data.app.future_slots}</span><span class="context">L0–L5 规划容量</span></div>
      <div class="stat"><span class="label">待处理审核</span><span class="value">${pending}</span><span class="context">Gate A / Gate B / Definition</span></div>
      <div class="stat"><span class="label">Kernel</span><span class="value mono" style="font-size:22px">${esc(state.data.app.kernel_version)}</span><span class="context">稳定代码层 · Sandbox</span></div>
    </div>`;

  const rows = objects.map(obj => `
    <tr class="clickable">
      <td><div class="object-name"><strong>${esc(obj.id)}</strong><span>${esc(obj.name_zh)}</span></div></td>
      <td>${lineTag(obj.line)}</td><td>${esc(obj.owner || "—")}</td><td class="mono">${esc(obj.version)}</td>
      <td>${esc(obj.current_stage)} · ${esc(obj.current_stage_zh)}</td><td>${status(obj.gate_a)}</td><td>${status(obj.automated_run)}</td><td>${status(obj.gate_b)}</td>
      <td><span class="mono" style="font-size:10px">${esc(obj.validation)}</span></td>
      <td><a class="btn small" href="#/workspace/${obj.line}/${obj.id}/${obj.current_stage}">${obj.id === "TR02" ? "打开 Gate B" : obj.id === "ST01" ? "审核设计" : "继续设置"} →</a></td>
    </tr>`).join("");

  const content = `<section class="page">
    ${pageHeader("Research portfolio", "研究对象总览", "跟踪 MVP 范围内对象的设计、执行、验证与发布。", `<button class="btn" data-action="go-validation">验证收件箱 ${pending}</button><button class="btn primary" data-action="create-object">＋ 创建研究对象</button>`)}
    ${cards}<div class="spacer"></div>
    <div class="card"><div class="card-head"><div class="section-heading"><h2>Active Research Objects</h2><p>每个对象独立通过 Draft → Gate A → Automated Research → Gate B。</p></div><button class="btn small">筛选</button></div>
      <div class="table-wrap"><table><thead><tr><th>对象</th><th>产品线</th><th>负责人</th><th>Config</th><th>当前阶段</th><th>Gate A</th><th>自动运行</th><th>Gate B</th><th>Validation</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div><div class="spacer"></div>
    <div class="grid cols-2">
      <div class="card"><div class="card-body stack"><div class="section-heading"><h2>Research Chain</h2><p>Trait、State 和 Signal 共用的主流程。</p></div><div class="research-chain"><span class="chain-node">StudySpec</span><span class="arrow">→</span><a class="chain-node highlight" href="#/public/CALL">Public Chain</a><span class="arrow">→</span><span class="chain-node">Research Input</span><span class="arrow">→</span><span class="chain-node gate">Gate A</span><span class="arrow">→</span><span class="chain-node">Automated Run</span><span class="arrow">→</span><span class="chain-node gate">Gate B</span></div></div></div>
      <div class="card"><div class="card-body stack"><div class="section-heading"><h2>下一步</h2><p>根据风险和阻塞自动排序。</p></div><div class="next-list">${state.data.state.reviews.slice(0,3).map(r => `<div class="next-item"><div class="next-symbol">→</div><div><strong>${esc(r.object_id)} · ${esc(r.type)}</strong><p>${esc(r.summary_zh)}</p></div><button class="btn small" data-action="open-review" data-id="${esc(r.id)}">查看</button></div>`).join("")}</div></div></div>
    </div>
  </section>`;
  renderShell(content, "总览");
}

function publicExampleTable(stepId) {
  const trace = state.data.public_chain_trace;
  if (stepId === "F02") return `<div class="table-wrap"><table class="trace-table"><thead><tr><th>Record</th><th>Effective</th><th>Known</th><th>Stable liquidity</th><th>选择</th></tr></thead><tbody>${trace.pit_example.map(r => `<tr><td>${r.record_id}</td><td>${r.effective_at}</td><td>${r.known_at}</td><td>${r.stable_liquid_assets.toLocaleString()}</td><td>${r.selected ? status("PASSED") : status("FAILED")}</td></tr>`).join("")}</tbody></table></div>`;
  if (stepId === "F03") return `<div class="table-wrap"><table class="trace-table"><thead><tr><th>ID</th><th>日期</th><th>事件</th><th>Choice</th><th>Status</th></tr></thead><tbody>${trace.opportunities.map(o => `<tr><td>${o.id}</td><td>${o.date}</td><td>${o.event}</td><td>${o.choice}</td><td>${status(o.status === "OBSERVABLE" ? "PASSED" : "WARNING")}</td></tr>`).join("")}</tbody></table></div>`;
  if (stepId === "F04") return `<div class="table-wrap"><table class="trace-table"><thead><tr><th>Measurement</th><th>Value</th><th>Numerator</th><th>Denominator</th><th>Coverage</th></tr></thead><tbody>${trace.measurements.map(m => `<tr><td class="mono">${m.id}</td><td>${m.value}</td><td>${m.numerator.toLocaleString()}</td><td>${m.denominator.toLocaleString()}</td><td>${status(m.coverage === "COMPLETE" ? "PASSED" : "WARNING")}</td></tr>`).join("")}</tbody></table></div>`;
  if (stepId === "F05") return `<div class="table-wrap"><table class="trace-table"><thead><tr><th>检查</th><th>观察</th><th>门槛</th><th>结果</th></tr></thead><tbody>${trace.adequacy.map(a => `<tr><td>${a.check}</td><td>${a.observed}</td><td>${a.threshold}</td><td>${status(a.status === "PASS" ? "PASSED" : "FAILED")}</td></tr>`).join("")}</tbody></table></div>`;
  return "";
}

function renderPublic() {
  const route = currentRoute();
  const chain = state.data.public_chain;
  const selected = chain.steps.find(s => s.id === route.stepId) || chain.steps[0];
  const buttons = chain.steps.map(step => `<a class="public-step ${selected.id === step.id ? "active" : ""}" href="#/public/${step.id}"><span class="step-state ${step.status === "PASSED" ? "passed" : "warning"}">${step.id === "CALL" ? "C" : step.id === "RETURN" ? "R" : step.id.slice(1)}</span><span class="step-copy"><small>${step.id}</small><strong>${esc(step.title_zh)}</strong></span></a>`).join("");
  const content = `<section class="page">
    ${pageHeader("Shared data & context", "公共链路", chain.description_zh, `<button class="btn" data-action="show-bundle">查看 Return Bundle</button><button class="btn primary" data-action="run-public">运行 Sandbox Trace</button>`)}
    <div class="grid cols-4 workspace-meta">
      <div class="stat"><span class="label">调用对象</span><span class="value mono" style="font-size:20px">${chain.caller.object_id}</span><span class="context">${chain.caller.caller_nodes.join(" / ")}</span></div>
      <div class="stat"><span class="label">Request</span><span class="value mono" style="font-size:14px">${chain.caller.request_id}</span><span class="context">${chain.caller.purpose}</span></div>
      <div class="stat"><span class="label">as_of</span><span class="value mono" style="font-size:14px">2026-10-01</span><span class="context">PIT 安全边界</span></div>
      <div class="stat"><span class="label">返回状态</span><span class="value" style="font-size:16px">有警告</span><span class="context">T08 被独立参照阻塞</span></div>
    </div>
    <div class="public-layout">
      <aside class="card step-panel"><div class="step-panel-title"><span>PUBLIC CHAIN</span><span>8 steps</span></div><div class="step-list">${buttons}</div></aside>
      <div class="card"><div class="detail-content">
        <div class="node-title"><span class="mono">${selected.id}</span>${status(selected.status)}<h2>${esc(selected.title_zh)}</h2></div>
        <p class="explain">${esc(selected.purpose)}</p>
        <div class="callout"><strong>这个例子在做什么</strong><p>${esc(selected.example_zh)}</p></div>
        <div class="fact-grid"><div class="fact"><label>Input</label><strong>${esc(selected.input)}</strong></div><div class="fact"><label>Output</label><strong>${esc(selected.output)}</strong></div><div class="fact"><label>Artifact</label><code>${esc(selected.artifact)}</code></div><div class="fact"><label>谁调用</label><strong>TR02.T02 / TR02.T03</strong></div></div>
        <div class="grid cols-3"><div class="callout"><strong>人工预设</strong><ul class="bullet-list">${selected.human_preset.map(item => `<li>${esc(item)}</li>`).join("")}</ul></div><div class="callout"><strong>LLM Assist</strong><p>${esc(selected.llm)}</p></div><div class="callout"><strong>Human Validation</strong><p>${esc(selected.human_validation)}</p></div></div>
        ${publicExampleTable(selected.id)}
        <div class="callout warning"><strong>公共链边界</strong><p>这个节点只产生通用事实、机会、测量、充分性或 Context；不会直接输出 TR02 分数、Requirement 或 Opportunity。</p></div>
      </div></div>
    </div>
  </section>`;
  renderShell(content, "公共链路");
}

function getObject(id) { return state.data.objects.find(item => item.id === id) || state.data.objects[0]; }

function stepStatus(obj, stepId) {
  if (obj.id === "TR02") return state.data.tr02_run.steps[stepId]?.status || "NOT_STARTED";
  if (obj.id === "ST01") {
    if (stepId === "S01") return "PASSED";
    if (stepId === "S02" || stepId === "S03") return "NEEDS_HUMAN_REVIEW";
    return "LOCKED";
  }
  if (obj.id === "SG01") return stepId === "G01" ? "DRAFT" : "LOCKED";
  return "DRAFT";
}

function resultFor(obj, stepId) {
  return obj.id === "TR02" ? state.data.tr02_run.steps[stepId] : null;
}

function renderWorkspace() {
  const route = currentRoute();
  const obj = getObject(route.objectId);
  const line = state.data.lines[obj.line];
  const selected = line.steps.find(step => step.id === route.stepId) || line.steps[0];
  const result = resultFor(obj, selected.id);
  const stepButtons = line.steps.map(step => {
    const s = stepStatus(obj, step.id);
    const stateClass = s === "PASSED" ? "passed" : ["WARNING","NEEDS_HUMAN_REVIEW"].includes(s) ? "warning" : s === "LOCKED" ? "locked" : "";
    return `<a class="step-button ${selected.id === step.id ? "active" : ""}" href="#/workspace/${obj.line}/${obj.id}/${step.id}"><span class="step-state ${stateClass}">${s === "PASSED" ? "✓" : s === "WARNING" ? "!" : s === "LOCKED" ? "×" : "·"}</span><span class="step-copy"><small>${step.id}</small><strong>${esc(step.title_zh)}</strong></span></a>`;
  }).join("");
  const tabDefinitions = [
    ["overview","概览"],["presets","Presets"],["input","Input Contract"],["output","Output Contract"],["execution","执行 / 结果"]
  ];
  if (obj.id === "TR02") tabDefinitions.push(["mock","TR02 Mock 示例"]);
  tabDefinitions.push(["validation","Validation"],["trace","Trace & Lineage"]);
  const tabs = tabDefinitions.map(([id,label]) => `<button class="tab ${state.workspaceTab === id ? "active" : ""}" data-action="workspace-tab" data-tab="${id}">${label}</button>`).join("");
  const detail = workspaceTabContent(obj, selected, result);
  const gateBReview = state.data.state.reviews.find(review => review.object_id === obj.id && review.type === "Gate B");
  const primaryAction = obj.gate_a === "APPROVED"
    ? `<button class="btn primary" data-action="run-object" data-object="${obj.id}">运行自动研究</button>`
    : `<button class="btn primary" data-action="submit-gate-a" data-object="${obj.id}">提交 Gate A</button>`;
  const gateBAction = obj.gate_b === "PENDING" && gateBReview
    ? `<button class="btn warning-btn" data-action="open-gate-b" data-id="${gateBReview.id}">打开 Gate B</button>`
    : "";
  const content = `<section class="page">
    ${pageHeader(`${line.label} workspace · ${obj.id}`, obj.name_zh, obj.description_zh, `<button class="btn" data-action="save-draft" data-object="${obj.id}" data-step="${selected.id}">保存 Draft</button><button class="btn llm" data-action="ask-llm" data-object="${obj.id}" data-step="${selected.id}">✦ Ask LLM</button>${gateBAction}${primaryAction}`)}
    <div class="grid cols-4 workspace-meta"><div class="stat"><span class="label">Config version</span><span class="value mono" style="font-size:16px">${esc(obj.version)}</span><span class="context">Active 只读，编辑生成 Draft</span></div><div class="stat"><span class="label">Current gate</span><span class="value" style="font-size:16px">${esc(obj.current_stage_zh)}</span><span class="context">${statusLabel(obj.gate_b)}</span></div><div class="stat"><span class="label">Data snapshot</span><span class="value mono" style="font-size:14px">${esc(obj.snapshot_id)}</span><span class="context">PIT snapshot attached</span></div><div class="stat"><span class="label">Last run</span><span class="value" style="font-size:16px">${formatDate(obj.last_run)}</span><span class="context">${statusLabel(obj.automated_run)}</span></div></div>
    <div class="workbench">
      <aside class="card step-panel"><div class="step-panel-title"><span>RESEARCH STEPS</span><span>${line.steps.findIndex(s => s.id === selected.id)+1}/10</span></div><div class="step-list">${stepButtons}</div></aside>
      <section class="card detail-panel"><div class="tabs">${tabs}</div><div class="detail-content">${detail}</div></section>
      ${renderCopilot(obj, selected)}
    </div>
  </section>`;
  renderShell(content, `${line.label} Workspace`);
}

function workspaceTabContent(obj, step, result) {
  const base = `<div class="node-title"><span class="mono">${step.id}</span>${status(stepStatus(obj, step.id))}<h2>${esc(step.title_zh)}</h2></div><p class="explain">${esc(step.purpose)}</p>`;
  if (state.workspaceTab === "presets") return `${base}<div class="callout"><strong>本节点人工预设</strong><ul class="bullet-list">${step.preset.map(item => `<li>${esc(item)}</li>`).join("")}</ul></div><div class="callout"><strong>当前对象配置</strong><pre class="json-box">${esc(pretty(obj.config))}</pre></div><button class="btn" data-action="save-draft" data-object="${obj.id}" data-step="${step.id}">编辑并保存 Draft</button>`;
  if (state.workspaceTab === "input") return `${base}<div class="fact"><label>Input Contract</label><strong>${esc(step.input)}</strong><span class="explain">Public Chain 返回的所有输入必须携带 request、as_of、version 和 lineage。</span></div><div class="callout"><strong>当前 Mock Input</strong><pre class="json-box">${esc(pretty(result?.input || {status:"Cold Start", required:step.input}))}</pre></div>`;
  if (state.workspaceTab === "output") return `${base}<div class="fact"><label>Output Contract</label><strong>${esc(step.output)}</strong><span class="explain">输出只能由冻结代码生成，并记录 artifact ID 与版本。</span></div><div class="callout"><strong>当前 Mock Output</strong><pre class="json-box">${esc(pretty(result?.output || {status:"Not generated", expected:step.output}))}</pre></div>`;
  if (state.workspaceTab === "execution") return `${base}${result ? `<div class="metric-grid">${Object.entries(result.metrics || {}).slice(0,8).map(([k,v]) => `<div class="metric"><span>${esc(k)}</span><strong>${v === null ? "null" : esc(v)}</strong></div>`).join("")}</div><div class="callout"><strong>执行摘要</strong><p>${esc(result.summary_zh)}</p></div>` : `<div class="empty"><strong>尚未执行</strong><span>通过 Gate A 后可运行自动研究。</span></div>`}`;
  if (state.workspaceTab === "mock") return `${base}${renderMockExample(result, step)}`;
  if (state.workspaceTab === "validation") return `${base}<div class="grid cols-2"><div class="callout"><strong>LLM 可以做什么</strong><p>${esc(step.llm)}</p></div><div class="callout"><strong>Human Validation</strong><p>${esc(step.human)}</p></div></div><div class="callout warning"><strong>Gate 规则</strong><p>普通计算节点不逐个审批。Gate A 审设计，Gate B 审结果与发布；失败、近门槛和高风险变更进入 Validation Center。</p></div>`;
  if (state.workspaceTab === "trace") return `${base}<div class="fact-grid"><div class="fact"><label>Config</label><code>${esc(obj.version)}</code></div><div class="fact"><label>Snapshot</label><code>${esc(obj.snapshot_id)}</code></div><div class="fact"><label>Kernel</label><code>${esc(state.data.app.kernel_version)}</code></div><div class="fact"><label>Artifact</label><code>${esc(result?.output?.artifact || "Not generated")}</code></div></div><pre class="json-box">${esc(pretty(state.data.tr02_run.manifest))}</pre>`;
  return `${base}<div class="callout"><strong>这个节点做什么</strong><p>${esc(result?.summary_zh || `${obj.id} 当前处于 Cold Start；先完成 Presets、Input/Output Contract 和 Gate A。`)}</p></div>${result?.example ? renderMockExample(result, step, true) : ""}<div class="fact-grid"><div class="fact"><label>Input Contract</label><strong>${esc(step.input)}</strong></div><div class="fact"><label>Output Contract</label><strong>${esc(step.output)}</strong></div></div><div class="grid cols-3"><div class="callout"><strong>人工预设</strong><ul class="bullet-list">${step.preset.map(item => `<li>${esc(item)}</li>`).join("")}</ul></div><div class="callout"><strong>LLM Assist</strong><p>${esc(step.llm)}</p></div><div class="callout"><strong>Human Validation</strong><p>${esc(step.human)}</p></div></div>`;
}

function renderMockExample(result, step, compact = false) {
  if (!result?.example) return `<div class="empty"><strong>暂无 Mock 实例</strong><span>${esc(step.id)} 尚未配置逐步 Mock 数据。</span></div>`;
  const example = result.example;
  const rows = Array.isArray(example.sample_rows) ? example.sample_rows : [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const table = rows.length ? `<div class="mock-table-wrap"><table class="mock-table"><thead><tr>${columns.map(key => `<th>${esc(key)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(key => `<td>${row[key] === null ? '<span class="mock-null">null</span>' : esc(row[key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : "";
  return `<section class="mock-panel ${compact ? "compact" : ""}">
    <div class="mock-banner"><div><span class="mock-kicker">TR02 REALISTIC MOCK · ${esc(step.id)}</span><h3>${esc(example.title_zh)}</h3></div><code>${esc(example.case_id)}</code></div>
    <div class="mock-flow">
      <div class="mock-flow-card input"><label>MOCK INPUT</label><p>${esc(example.input_story)}</p><pre>${esc(pretty(result.input))}</pre></div>
      <div class="mock-arrow">→</div>
      <div class="mock-flow-card process"><label>本步如何处理</label><ol>${(example.calculation || []).map(item => `<li>${esc(item)}</li>`).join("")}</ol></div>
      <div class="mock-arrow">→</div>
      <div class="mock-flow-card output"><label>MOCK OUTPUT</label><p>${esc(example.output_story)}</p><pre>${esc(pretty(result.output))}</pre></div>
    </div>
    ${compact ? "" : `<div class="mock-section-title"><strong>本例明细</strong><span>这些是可回放的演示数据，不是生产客户结论。</span></div>${table}`}
  </section>`;
}

function renderCopilot(obj, step) {
  const suggestion = state.llmSuggestion && state.llmSuggestion.object_id === obj.id && state.llmSuggestion.step_id === step.id ? state.llmSuggestion : null;
  return `<aside class="card copilot"><div class="card-head"><div class="copilot-title"><div class="spark">✦</div><div class="section-heading"><h3>LLM Copilot</h3><p>只生成建议 · 不写 Active</p></div></div></div><div class="copilot-body">
    ${suggestion ? `<div class="suggestion"><div class="node-title"><h3>STRUCTURED PATCH</h3><span class="status INFO">Draft only</span></div><strong>${esc(suggestion.title)}</strong><p>${esc(suggestion.reason_zh)}</p><pre class="json-box">${esc(pretty(suggestion.patch))}</pre><p>${esc(suggestion.impact_zh)}</p><div class="actions"><button class="btn small" data-action="dismiss-llm">拒绝</button><button class="btn primary small" data-action="accept-llm" data-object="${obj.id}" data-step="${step.id}">接受到 Draft</button></div></div>` : `<div class="callout"><strong>当前节点：${esc(step.id)}</strong><p>调用 Copilot 获得一个结构化 Patch。建议必须由人工接受后才会写入 Draft。</p><button class="btn llm" data-action="ask-llm" data-object="${obj.id}" data-step="${step.id}">生成节点建议</button></div>`}
    <div><div class="eyebrow" style="margin-bottom:8px">可以帮你</div><div class="chip-row"><span class="chip">建议 rivals</span><span class="chip">边界测试</span><span class="chip">解释配置</span><span class="chip">分析 bad cases</span></div></div>
    <div class="copilot-note">Copilot 不能批准 Gate、修改 Active Version、改变冻结窗口、绕过 Validation 或扩大数据权限。</div>
  </div></aside>`;
}

function renderValidation() {
  const reviews = state.data.state.reviews;
  const selected = reviews.find(r => r.id === state.selectedReview) || reviews[0];
  state.selectedReview = selected?.id || null;
  const rows = reviews.map(r => `<div class="review-row ${selected?.id === r.id ? "selected" : ""}" data-action="select-review" data-id="${r.id}"><div class="review-code">${r.id.replace("RV-", "RV-")}</div><div class="review-copy"><strong>${r.object_id} · ${state.data.lines[r.line]?.label || r.line}</strong><span>${r.type} · ${r.summary_zh}</span></div><span class="status ${r.risk === "HIGH" ? "WARNING" : "INFO"}">${r.risk} risk</span></div>`).join("");
  const detail = selected ? `<div class="card"><div class="card-head"><div class="section-heading"><h2>${selected.object_id} · ${selected.type}</h2><p>${selected.id} · ${statusLabel(selected.status)}</p></div>${status(selected.status)}</div><div class="card-body stack"><div class="callout"><strong>触发原因</strong><p>${esc(selected.trigger)}</p></div><div class="callout"><strong>审核摘要</strong><p>${esc(selected.summary_zh)}</p></div><div class="fact-grid"><div class="fact"><label>Assignee</label><strong>${esc(selected.assignee)}</strong></div><div class="fact"><label>Created</label><strong>${formatDate(selected.created_at)}</strong></div></div><button class="btn primary" data-action="review-decision" data-id="${selected.id}">打开人工决策</button></div></div>` : "";
  const content = `<section class="page">${pageHeader("Control plane", "Validation Center", "Gate A、Gate B、配置和 Validation 的统一人工收件箱。")}
    <div class="review-layout"><div class="card"><div class="card-head"><div class="section-heading"><h2>Validation Inbox</h2><p>所有写操作生成 Draft；高风险项目禁止批量批准。</p></div><button class="btn small">筛选</button></div>${rows}</div>
    <div class="stack">${detail}<div class="card"><div class="card-body stack"><h2>Workflow Guardrails</h2><div class="guard-list"><div class="guard">Active Version 只读</div><div class="guard">LLM 修改只进入 Draft</div><div class="guard">Gate 决策必须由人工完成</div><div class="guard">MVP1 禁止 Production Release</div></div></div></div></div></div>
  </section>`;
  renderShell(content, "Validation Center");
}

function renderRuns() {
  const rows = state.data.state.runs.map(run => `<tr><td class="mono">${esc(run.id)}</td><td>${esc(run.object_id)}</td><td>${lineTag(run.line)}</td><td>${status(run.status)}</td><td class="mono">${esc(run.snapshot_id)}</td><td class="mono">${esc(run.config_version)}</td><td>${formatDate(run.started_at)}</td><td>${run.duration_seconds}s</td><td><button class="btn small" data-action="replay-run" data-id="${esc(run.id)}">Replay</button></td></tr>`).join("");
  const content = `<section class="page">${pageHeader("Reproducibility", "Runs & Replay", "用 RunManifest 追溯数据快照、配置、代码、Prompt、审批和产物。", `<button class="btn" data-action="reset-sandbox">重置 Sandbox</button>`)}<div class="card"><div class="card-head"><div class="section-heading"><h2>Run History</h2><p>Replay 会创建新 Run，不覆盖历史结果。</p></div></div><div class="table-wrap"><table><thead><tr><th>Run ID</th><th>对象</th><th>Line</th><th>Status</th><th>Snapshot</th><th>Config</th><th>Started</th><th>Duration</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div></div><div class="spacer"></div><div class="card"><div class="card-body stack"><h2>TR02 RunManifest</h2><pre class="json-box">${esc(pretty(state.data.tr02_run.manifest))}</pre></div></div></section>`;
  renderShell(content, "Runs & Replay");
}

function renderConfig() {
  const cards = state.data.config_registry.map(item => `<div class="card"><div class="card-body stack"><div class="node-title"><h3>${esc(item.kind)}</h3>${item.active ? status("APPROVED") : status("DRAFT")}</div><code>${esc(item.path)}</code><p class="explain">${item.active ? "源配置由代码读取；UI 修改会生成 runtime Draft。" : "演示/运行时数据，不作为 Active 配置。"}</p><button class="btn small" data-action="show-config" data-id="${item.id}">查看内容</button></div></div>`).join("");
  const changes = state.data.state.draft_changes.map(c => `<tr><td>${esc(c.id)}</td><td>${esc(c.object_id)}</td><td>${esc(c.step_id)}</td><td>${esc(c.field)}</td><td>${status(c.status)}</td><td>${esc(c.source)}</td></tr>`).join("");
  const content = `<section class="page">${pageHeader("Versioned specs", "Configuration Registry", "稳定 Python Kernel 与可修改 Config 分离；Active 只读，所有修改进入 Draft。")}
    <div class="grid cols-3">${cards}</div><div class="spacer"></div><div class="card"><div class="card-head"><div class="section-heading"><h2>Draft Changes</h2><p>Human edit 和接受的 LLM Patch 都有审计记录。</p></div></div><div class="table-wrap"><table><thead><tr><th>ID</th><th>Object</th><th>Step</th><th>Field</th><th>Status</th><th>Source</th></tr></thead><tbody>${changes || `<tr><td colspan="6">暂无 Draft change</td></tr>`}</tbody></table></div></div></section>`;
  renderShell(content, "Configuration Registry");
}

function renderMonitoring() {
  const rows = state.data.state.bad_cases.map(item => `<tr><td>${esc(item.id)}</td><td>${esc(item.object_id)}</td><td>${esc(item.step_id)}</td><td>${esc(item.type)}</td><td>${status(item.severity === "HIGH" ? "BLOCKING" : item.severity === "MEDIUM" ? "WARNING" : "INFO")}</td><td>${item.count}</td><td>${esc(item.status)}</td><td>${esc(item.summary_zh)}</td></tr>`).join("");
  const content = `<section class="page">${pageHeader("Feedback loop", "Monitoring & Bad Cases", "监控运行质量，把异常转成可复现 ReviewTask；不会在线自动修改阈值。", `<button class="btn llm" data-action="analyze-badcases">✦ LLM 聚类摘要</button>`)}<div class="card"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Object</th><th>Step</th><th>Type</th><th>Severity</th><th>Count</th><th>Status</th><th>Summary</th></tr></thead><tbody>${rows}</tbody></table></div></div></section>`;
  renderShell(content, "Monitoring & Bad Cases");
}

function renderGuide() {
  const sections = [
    ["start","1. 从哪里开始","MVP1 建议先完成 TR02、ST01、SG01 三个对象，不要求准备全部 37 个槽位。创建对象后先完成定义、Eligibility/来源和 Validation Protocol，再提交 Gate A。"],
    ["public","2. 什么是公共链路","Public Chain 是共享的数据实验室。对象节点带着 StudySpec 调用 F01–F06，获得 PIT 安全事实、OpportunityBook、MeasurementValue、AdequacyReport 和 ContextPacket。公共链不产生对象结论。"],
    ["draft","3. 怎样修改配置","Active Version 永远只读。点击保存 Draft 或接受 LLM 建议，只会写入 runtime/state.json 的 Draft override。通过 Gate 和版本发布后，才可以生成新的冻结配置。"],
    ["llm","4. 怎样使用 LLM","LLM 可以起草配置、建议 rivals、生成边界测试和总结 Validation。LLM 不能批准 Gate、写 Active、扩大权限、改变冻结窗口或绕过失败。"],
    ["gate-a","5. Gate A","Gate A 审研究设计：对象语义、Eligibility、指标/特征/事件规则、rivals、Validation Protocol、来源和 Context Policy。Gate A 通过后，普通计算节点自动运行。"],
    ["run","6. Automated Research","一个按钮运行自动研究。页面按节点显示状态、Input、Output、指标和 Artifact。普通节点不逐个点击审批；失败、警告和近门槛进入 Validation Center。"],
    ["gate-b","7. Gate B","Gate B 审查 Validation Report 和 Evidence Pack，人工决定 Sandbox Release、Defer、Reject 或 Redefine。MVP1 禁止 Production Release。"],
    ["replay","8. 怎样 Replay","每次运行保存 RunManifest，包括 snapshot、config hash、kernel、operators、split、prompt/model、seed 和审批。Replay 创建新 Run，并保留 parent_run。"],
    ["badcase","9. Bad Case 回流","监控发现问题后生成 Bad Case。LLM 可以聚类和起草建议，人工判断问题来自数据、配置、对象语义还是底层 Capability，再创建新 Draft。"],
    ["boundary","10. 什么时候改 Python","如果现有 Capability 可以表达新需求，只改 Config；只有新增数据协议、原子算子、Input/Output 类型、权限或执行语义时，才改 Python Kernel。"]
  ];
  const nav = sections.map(([id,title]) => `<a class="guide-link" href="#${id}" data-action="guide-anchor" data-id="${id}">${title}</a>`).join("");
  const body = sections.map(([id,title,text]) => `<section id="${id}" class="guide-section"><h2>${title}</h2><p>${text}</p></section>`).join("");
  const content = `<section class="page">${pageHeader("Documentation", "使用说明", "从 Cold Start 到 Gate B、Replay 和 Bad Case 回流的中文操作指南。")}
    <div class="guide"><aside class="card guide-nav">${nav}</aside><article class="card guide-content">${body}</article></div></section>`;
  renderShell(content, "使用说明");
}

function render() {
  const route = currentRoute();
  if (route.name === "overview") return renderOverview();
  if (route.name === "public") return renderPublic();
  if (route.name === "workspace") return renderWorkspace();
  if (route.name === "validation") return renderValidation();
  if (route.name === "runs") return renderRuns();
  if (route.name === "config") return renderConfig();
  if (route.name === "monitoring") return renderMonitoring();
  if (route.name === "guide") return renderGuide();
  location.hash = "#/overview";
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  $("#toast-root").appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function modal(title, body, actions = "") {
  $("#modal-root").innerHTML = `<div class="modal-backdrop"><div class="modal"><div class="modal-head"><div><h2>${esc(title)}</h2></div><button class="close" data-action="close-modal">×</button></div><div class="modal-body">${body}</div><div class="modal-actions">${actions}</div></div></div>`;
}

function closeModal() { $("#modal-root").innerHTML = ""; }

async function refreshAndRender(message) {
  await reload();
  render();
  if (message) toast(message);
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "go-validation") location.hash = "#/validation";
  if (action === "open-review") { state.selectedReview = target.dataset.id; location.hash = "#/validation"; }
  if (action === "open-gate-b") { state.selectedReview = target.dataset.id; location.hash = "#/validation"; }
  if (action === "select-review") { state.selectedReview = target.dataset.id; renderValidation(); }
  if (action === "workspace-tab") { state.workspaceTab = target.dataset.tab; renderWorkspace(); }
  if (action === "close-modal") closeModal();
  if (action === "dismiss-llm") { state.llmSuggestion = null; renderWorkspace(); }
  if (action === "guide-anchor") { event.preventDefault(); document.getElementById(target.dataset.id)?.scrollIntoView({behavior:"smooth"}); }

  if (action === "ask-llm") {
    try {
      state.llmSuggestion = await api("/api/llm/suggest", { method: "POST", body: JSON.stringify({ object_id: target.dataset.object, step_id: target.dataset.step }) });
      renderWorkspace(); toast("LLM 已生成结构化建议；尚未写入 Draft。");
    } catch (error) { toast(error.message); }
  }
  if (action === "accept-llm") {
    try {
      await api("/api/llm/accept", { method: "POST", body: JSON.stringify({ object_id: target.dataset.object, step_id: target.dataset.step, patch: state.llmSuggestion.patch }) });
      state.llmSuggestion = null; await refreshAndRender("建议已由人工接受并写入 Draft，Active 未改变。");
    } catch (error) { toast(error.message); }
  }
  if (action === "save-draft") {
    const obj = getObject(target.dataset.object); const step = target.dataset.step;
    modal(`保存 ${obj.id} Draft`, `<div class="callout"><strong>只写 Draft</strong><p>Active Version 保持只读。请输入 JSON Patch；Sandbox 会保存版本化修改记录。</p></div><div class="field"><label>Step</label><input value="${esc(step)}" disabled></div><div class="field"><label>Config Patch (JSON)</label><textarea id="draft-patch">${esc(pretty({review_note:`${step} sandbox edit`, config_checked:true}))}</textarea></div>`, `<button class="btn" data-action="close-modal">取消</button><button class="btn primary" data-action="confirm-save-draft" data-object="${obj.id}" data-step="${step}">保存 Draft</button>`);
  }
  if (action === "confirm-save-draft") {
    try {
      const patch = JSON.parse($("#draft-patch").value);
      await api(`/api/objects/${target.dataset.object}/draft`, { method: "POST", body: JSON.stringify({ step_id: target.dataset.step, patch }) });
      closeModal(); await refreshAndRender("Draft 已保存；Active Version 未改变。");
    } catch (error) { toast(`无法保存：${error.message}`); }
  }
  if (action === "run-object") {
    try {
      target.disabled = true; target.textContent = "运行中…";
      const result = await api(`/api/objects/${target.dataset.object}/run`, { method: "POST", body: JSON.stringify({}) });
      await refreshAndRender(`Run ${result.run.id} 已完成，状态为 Warning。`);
    } catch (error) { toast(error.message); render(); }
  }
  if (action === "submit-gate-a") {
    state.selectedReview = target.dataset.object === "ST01" ? "RV-202" : "RV-198";
    location.hash = "#/validation";
    toast("已打开 Gate A / Definition Review。");
  }
  if (action === "review-decision") {
    const review = state.data.state.reviews.find(r => r.id === target.dataset.id);
    modal(`${review.id} · 人工决策`, `<div class="callout warning"><strong>${esc(review.object_id)} · ${esc(review.type)}</strong><p>${esc(review.summary_zh)}</p></div><div class="field"><label>审核意见</label><textarea id="review-comment" placeholder="记录证据、风险和决策理由…"></textarea></div>`, `<button class="btn" data-action="close-modal">取消</button><button class="btn" data-action="confirm-review" data-id="${review.id}" data-decision="REQUEST_CHANGES">请求修改</button><button class="btn" data-action="confirm-review" data-id="${review.id}" data-decision="DEFER">Defer</button><button class="btn danger" data-action="confirm-review" data-id="${review.id}" data-decision="REJECT">Reject</button><button class="btn primary" data-action="confirm-review" data-id="${review.id}" data-decision="APPROVE">Approve Sandbox</button>`);
  }
  if (action === "confirm-review") {
    try {
      const comment = $("#review-comment")?.value || "Sandbox review decision";
      await api(`/api/reviews/${target.dataset.id}`, { method: "POST", body: JSON.stringify({ decision: target.dataset.decision, comment }) });
      closeModal(); await refreshAndRender(`Review ${target.dataset.id} 已记录人工决策：${target.dataset.decision}`);
    } catch (error) { toast(error.message); }
  }
  if (action === "replay-run") {
    try {
      const result = await api(`/api/runs/${target.dataset.id}/replay`, { method: "POST", body: JSON.stringify({}) });
      await refreshAndRender(`Replay 已创建：${result.run.id}`);
    } catch (error) { toast(error.message); }
  }
  if (action === "reset-sandbox") {
    await api("/api/reset", {method:"POST", body:"{}"});
    await refreshAndRender("Sandbox 状态已重置为初始 Mock 数据。");
  }
  if (action === "create-object") {
    modal("创建研究对象", `<div class="form-grid"><div class="field"><label>Object ID</label><input id="new-id" value="TR03"></div><div class="field"><label>产品线</label><select id="new-line"><option value="trait">Trait</option><option value="state">State</option><option value="signal">Signal</option></select></div><div class="field full"><label>中文名称</label><input id="new-name-zh" value="新的研究对象"></div><div class="field full"><label>Canonical name</label><input id="new-name" value="New Research Object"></div></div>`, `<button class="btn" data-action="close-modal">取消</button><button class="btn primary" data-action="confirm-create-object">创建 Draft</button>`);
  }
  if (action === "confirm-create-object") {
    try {
      const payload = { id: $("#new-id").value, line: $("#new-line").value, name_zh: $("#new-name-zh").value, name: $("#new-name").value };
      await api("/api/objects", { method:"POST", body:JSON.stringify(payload) }); closeModal(); await refreshAndRender(`${payload.id} Draft 已创建。`);
    } catch (error) { toast(error.message); }
  }
  if (action === "run-public") toast("Public Chain Sandbox Trace 已完成；F05 返回独立参照缺失警告。");
  if (action === "show-bundle") modal("TR02 ResearchInputBundle", `<pre class="json-box">${esc(pretty({bundle_id:"bundle-tr02-c001-20261001-001",request_id:"req-tr02-c001-20261001-001",artifacts:{source_contract:"sc-tr02-v1",snapshot:"snap-tr02-c001-20261001-001",opportunity_book:"opp-tr02-c001-20261001-001",measurements:"ms-tr02-c001-20261001-001",adequacy:"adequate-tr02-c001-20261001-001",context:"ctx-tr02-c001-20261001-001"},status:{measurement:"SUFFICIENT",construct_validation:"INSUFFICIENT_REFERENCE"}}))}</pre>`, `<button class="btn primary" data-action="close-modal">关闭</button>`);
  if (action === "show-config") {
    const item = state.data.config_registry.find(c => c.id === target.dataset.id);
    const payloads = {
      app: state.data.app,
      lines: state.data.lines,
      objects: {objects: state.data.objects},
      "public-chain": state.data.public_chain,
      "tr02-run": state.data.tr02_run,
      runtime: state.data.state,
    };
    modal(item.kind, `<div class="callout"><strong>${esc(item.path)}</strong><p>源配置与 Python Engine 分离。下方为当前已加载内容；UI 修改只会进入 runtime/state.json。</p></div><pre class="json-box config-preview">${esc(pretty(payloads[item.id]))}</pre>`, `<button class="btn primary" data-action="close-modal">关闭</button>`);
  }
  if (action === "analyze-badcases") toast("LLM 摘要：主要阻塞为 T08 独立参照缺失；其次是 T04 义务信息不完整与 T02 ownership 映射。建议分别创建 Validation、Data Owner 和 Eligibility ReviewTask。");
});

window.addEventListener("hashchange", () => { state.workspaceTab = "overview"; state.llmSuggestion = null; render(); });

(async function init() {
  try {
    await reload();
    if (!location.hash) location.hash = "#/overview";
    render();
  } catch (error) {
    $("#app").innerHTML = `<div class="empty"><strong>无法启动 Sandbox</strong><span>${esc(error.message)}</span><span>请确认已通过 python -m engine.server 启动本地服务。</span></div>`;
  }
})();
