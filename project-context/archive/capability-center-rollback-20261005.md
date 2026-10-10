> 历史回退证据（2026-10-05），不是当前操作流程；对应本机脚本和备份未随共享资料分发。

# 能力中心改版回退说明

本轮已先备份、后修改；回退脚本已在隔离副本中演练通过。回退只撤销本次界面与运行包，保留当时最新的岗位、能力草稿、收藏、会话、模型设置和服务配置。

- 修改前基线：`b597a072e4f81e575301eb6a1fe100ed76a3f24e`。
- 界面与测试提交：`6208b65`。
- 运行包提交：`fd81100`。
- 备份：本目录的 `backup` 保存修改前源码压缩包、Git 历史及 UI 运行包；`release/backup` 保存交付前逐文件备份与必要业务快照。
- 演练记录：`release/rollback-check.json`，源码树和旧文件字节均已恢复到基线。
- 交付清单：`release/manifest.json`；安装校验：`release/installed.json`。

## 正常回退步骤

1. 保存正在编辑的内容，正常退出 DeepSeek Harness 工作台。
2. 双击同目录的 `回退能力中心.cmd`，等出现回退成功提示；也可在 PowerShell 执行下面的命令。
3. 按平常方式重新打开工作台，进入设置中的能力中心查看旧版界面。

```powershell
& 'C:\Program Files\nodejs\node.exe' '<SECONDARY_WORKSPACE>\capability-center-simplification\release.mjs' --rollback
```

命令中的两个带引号路径分别指向 Node 和本次发布脚本；`--rollback` 使用 Git 撤销本次两个提交，再恢复校验过的旧文件字节，不恢复旧业务数据快照。

脚本会先核对正式分支、当前版本、修改文件和备份完整性。如果此后已有其他代码提交或手动修改，会停止并提示，避免覆盖后续工作；这种情况下应基于新版本重新评估回退。请保留整个 `capability-center-simplification` 目录。

本次修改没有自动重启正在运行的工作台，也没有推送远程仓库。交付后的正常重启体验、真实识别接口和模型调用仍需在实际工作中验收。
