离线安装包目录

把 DeepSeek-Workbench-Offline-*.zip 原样放在本目录，不要手动解压。
关闭客户端后，双击项目根目录的一键部署.cmd，脚本会自动读取安装包。
本目录没有安装包时会提示缺少离线包，不会自动联网下载。

Git 只保存这份说明，让拉取代码后自动出现本目录。
ZIP、校验文件、解压文件、缓存及子文件夹均不提交。

新版交付ZIP仅包含offline目录，不包含第二套部署或启动入口。始终使用Git项目根的一键部署.cmd。

完整获取、安装、启动和修复步骤见项目根 README.md。
当前版本：2026.10.23-r14-win-x64
下载：https://github.com/yexisui/deepseek-harness-Workbench/releases/tag/offline-2026.10.23-r14
同时下载ZIP及同名.sha256校验文件。
