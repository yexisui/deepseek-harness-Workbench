# 协作资料移除说明

本目录只服务开发协作，业务代码、工具安装、构建与启动不得依赖它。移除前先同步最后一次事项状态并提交，确认不再需要随仓库分发。

1. 如需保留本机原件，先将 project-context/archive/local-only 整体移至仓库外明确的保留位置；此目录不在 Git 中，普通克隆没有它。不得直接递归删除 project-context 导致原件丢失。
2. 从 Git 工作树移除 project-context 的受跟踪文件。若根 AGENTS.MD / CLAUDE.md 仍只有本次入口，可一起移除；若后续追加了其他规则，仅删除本次引用。
3. 清理根 .gitignore 中标注的 PROJECT CONTEXT 区块。保留 ai_key.txt 的凭据排除规则。
4. 本机二次开发目录的 AGENTS.md 是仓库外入口；停止引用被移除目录，或改为当时新规则入口。
5. 搜索受跟踪文件中的 project-context 引用，除历史说明外应无残留。执行工程 docs:check、PowerShell 语法检查和 external-tools/install.ps1 -Check；必要时执行原部署检查。
6. 核对移除差异，提交独立清理提交。Git 历史仍保留之前提交过的资料；普通删除不擦除历史。

必须保留：external-tools/tools.json、install.ps1、README.txt、.gitignore，capability-packages 源码与打包脚本，deploy.ps1、启动入口、业务代码、许可证、用户配置和业务数据。

本轮将在隔离检出中演练移除受跟踪资料并检查工具、能力包构建和文档检查，不操作正式业务数据。结果见 M007。
