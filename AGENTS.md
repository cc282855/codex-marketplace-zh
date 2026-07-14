# 项目多智能体协作

- 每个阶段先生成并校验 `.codex/state/runs/<run-id>/<phase>/agent-plan.json`。
- 只并行独立只读任务；`implement` 阶段只有一个 `project_worker` 能写入。
- 启动前后记录实际子线程 ID、权限、状态、工作区快照和结果证据。
- 只有 `check_phase_gate.py` 在审计报告为 PASS 时返回成功，才能进入下一阶段。
- 不覆盖未提交改动，不访问密钥，不执行生产或外部副作用操作，除非用户明确授权。
