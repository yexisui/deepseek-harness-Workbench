# 当前项目结构与接续入口

更新时间：2026-10-10。迁移前实际 Git 基线：main / 456fe64；工作前仍须自行检查 HEAD 和工作区。

| 仓库相对路径 | 职责 |
| --- | --- |
| ../deepseek_harness_desktop/ | 当前业务源码、共享组件、桌面壳与测试 |
| ../deepseek_harness_desktop/packages/dsh-capabilities/ | 能力、岗位、会议、需求分析、开发助手和执行记录 |
| ../deepseek_harness_desktop/packages/dsh-client-ui-plain-chat/ | 对话、岗位入口与管理界面 |
| ../deepseek_harness_desktop/packages/dsh-plugin-manager/ | 插件管理 |
| ../deepseek_harness_desktop/shared/ | 跨模块共用实现；修改需关联回归 |
| ../deploy.ps1 | Deploy 全量部署、Bootstrap 补齐便携基础环境、Tools 工具补装、Check 安装检查 |
| ../DEPLOYMENT.txt | 现有环境补齐与新环境安装的操作说明 |
| ../test-deploy.ps1 | Bootstrap、启动入口、Node 安装与配置保护回归 |
| ../external-tools/ | 必需外部程序清单与安装器；目前 FFmpeg/ffprobe |
| ../capability-packages/ | 外置能力源码与打包脚本；目前音频分段定位 |
| runtime*、dsh-data、chat-data、desktop-state | 本机环境、配置和业务数据，不入库 |

新协作者克隆仓库后先阅读 external-tools/README.txt 和部署脚本参数说明；Windows x64 默认一键部署由根“一键部署.cmd”调用。首次完整安装需要联网下载依赖；本轮工具检查不等同于全新电脑完整部署验收。模型凭据由使用者自行配置，绝不从项目文档取得。

## 当前接续重点

先读[台账](PEFR_PLAN.MD)。T023 会议内容质量、T027 JEV 过度拦截、T032 执行过程用户体验仍有待处理/验收部分；本轮只整理协作与部署基础设施，不改变这些业务事项状态。历史记录中“当时未推送”仅描述当时，当前代码以 Git 为准。

需求记录中的 `<WORKBENCH_ROOT>` 表示当前克隆目录；`<SECONDARY_WORKSPACE>` 是作者隔离验证目录，不要求协作者重建。旧版本号、旧 UI 和旧发布流程只供追溯；现行交互以规则第 8、9 节及最新已确认需求为准。

资料关系：[规则](AGENTS.MD) → [台账](PEFR_PLAN.MD) → [逐文件索引](FILE_INDEX.md) → 相关 A/M 详情；原项目背景见[归档索引](archive/INDEX.md)。
