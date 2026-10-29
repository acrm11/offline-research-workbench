# Decision Engine — Offline Research Workbench

这是一个可以从 GitHub 下载并在本机运行的 **Full Sandbox**。它包含完整的 Python Engine、中文工作台、版本化配置、TR02 Mock 链路、Gate A / Gate B、Run & Replay、Validation 和 Bad Case。

> 所有客户、金额、日期、分数和研究结论均为 Mock 演示数据，不是生产客户结论。

## 最快启动：Windows

1. 在 GitHub 仓库点击 **Code → Download ZIP**。
2. 将 ZIP 完整解压到本地目录，不要直接在压缩包中运行。
3. 确认电脑安装了 **Python 3.10 或更高版本**。
4. 双击根目录中的 `START_FULL_SANDBOX.bat`。
5. 浏览器会自动打开：<http://127.0.0.1:8765/#/overview>
6. 保持启动窗口打开；按 `Ctrl+C` 停止 Sandbox。

本项目只使用 Python 标准库，不需要执行 `pip install`。

## macOS / Linux

```bash
bash START_MAC_LINUX.sh
```

## 直接查看管理层汇报

不需要 Python。双击根目录中的：

```text
OPEN_BOSS_REPORT.html
```

也可以打开 [`boss_report/index.html`](boss_report/index.html)。

## Full Sandbox 包含什么

- Overview：研究对象与当前 Gate 状态
- Public Chain：CALL → F01–F06 → Return Bundle
- Trait Workspace：TR02 T01–T10，每一步都有真实感 Mock Input / Process / Output / 明细
- State Workspace：ST01 S01–S10
- Signal Workspace：SG01 G01–G10
- Validation Center：Gate A / Gate B 人工审核
- Configuration Registry：配置与 Python Kernel 隔离
- Runs & Replay：RunManifest 与回放
- Monitoring & Bad Cases
- LLM Copilot Mock：只生成结构化建议，人工接受后只写 Draft

## 目录结构

```text
offline-research-workbench/
├─ START_FULL_SANDBOX.bat      Windows 一键启动
├─ START_FULL_SANDBOX.ps1      Windows 启动逻辑
├─ START_MAC_LINUX.sh          macOS / Linux 启动
├─ OPEN_BOSS_REPORT.html       可直接双击的汇报 HTML
├─ boss_report/                管理层汇报源文件
└─ sandbox/
   ├─ configs/                 人工预设与版本化研究定义
   ├─ mock_data/               TR02 与 Public Chain Mock 数据
   ├─ engine/                  Python API、工作流、Gate 与 Replay
   ├─ web/                     中文 Sandbox UI
   ├─ runtime/                 本地生成的 Draft、Review 和 Run 状态
   └─ tests/                   回归测试
```

## 手动启动

```powershell
cd sandbox
python -m engine.server
```

然后访问 <http://127.0.0.1:8765/#/overview>。

## 运行测试

```powershell
cd sandbox
python -m unittest discover -s tests -v
node --check web/app.js
```

`node` 只用于 JavaScript 语法检查，不是运行 Sandbox 的必要依赖。

## 本地状态与重置

首次运行会生成：

```text
sandbox/runtime/state.json
```

它只保存本机的 Draft、Review 和 Run 状态，并被 `.gitignore` 排除。可以在 UI 的 Runs & Replay 页面点击“重置 Sandbox”。

## 安全边界

- 仓库不包含 `edf-4.0`。
- 仓库不包含真实客户数据、API Key 或 `.env`。
- Production Release 在 MVP1 中禁用。
- LLM 不能直接修改 Active Version 或批准 Gate。
- Gate 决策必须由人工完成。

## GitHub 仓库

<https://github.com/acrm11/offline-research-workbench>

