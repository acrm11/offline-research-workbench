# Decision Engine Offline Research Workbench — Sandbox UI

这是一个完全独立于 `edf-4.0` 的本地 MVP Sandbox。项目按照“可变配置”和“稳定 Python 能力”分层：

```text
configs/      人工预设、研究对象、节点定义、Gate 规则
mock_data/    TR02 与 Public Chain 的演示输入/输出
engine/       Python API、工作流、Gate、Replay 和本地持久化
web/          中文 Sandbox UI
runtime/      本地运行产生的 Draft、Review 和 Run 状态
tests/        Python 回归测试
```

## 启动

不依赖第三方 Python 包。进入本目录后运行：

```powershell
python -m engine.server
```

浏览器打开：

```text
http://127.0.0.1:8765
```

也可以执行：

```powershell
.\run.ps1
```

## MVP 范围

- Overview
- Public Chain：Call Entry、F01–F06、Return Bundle
- Trait Workspace：TR02 T01–T10 全步骤 Mock Run
- State Workspace：ST01 Gate A 冷启动模板
- Signal Workspace：SG01 Draft 冷启动模板
- Validation Center：Gate A / Gate B
- Runs & Replay
- Configuration Registry
- Monitoring & Bad Cases
- 中文 User Guide
- LLM Copilot 的结构化建议模拟：只写 Draft，不修改 Active Version

## 重要边界

- `edf-4.0` 未被修改。
- UI 中的日期、金额、分数均为演示数据，不是生产结论。
- Production Release 在 MVP1 中禁用。
- Gate 决策必须由人工操作。
- Python Engine 不读取或修改 `edf-4.0`。

