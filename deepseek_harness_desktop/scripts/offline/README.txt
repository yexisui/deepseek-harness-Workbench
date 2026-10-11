离线包制作（维护者）

使用已通过实际启动验证、不含个人数据的 Windows x64 部署目录作为 donor：
python deepseek_harness_desktop/scripts/offline/build-offline.py --donor <干净部署目录> --source <仓库根目录> --output <新的空输出目录>
该命令只读取白名单内的运行文件，输出离线安装目录，并把ZIP和SHA256保存至源项目根offline-delivery；不会联网下载。
离线包含两个原有cmd入口，双击一键部署自动校验并只修复缺失/不同的文件。-Repair作用相同；-Mode Check只检查。
部署到新电脑前，在隔离输出目录运行verify-offline.py并验证实际宿主和界面；不要对正式业务目录执行该验证脚本。
verify-offline.py会故意损坏隔离环境的程序文件并验证修复；只能传入专用验证目录。
目标系统为Windows x64，PowerShell 5.1及.NET Framework为系统前置条件；不自动安装全局工具或系统运行库。
新发布版本调整build-offline.py中的release标识；不要以同一版本标识发布不同内容。
共享设置：源仓库现在提供shared-settings快照及scripts/settings-sync.cjs。部署根脚本安装完成后自动合并配置；与安装payload分开维护。将交付ZIP原样放入最新Git项目根offline-delivery，根一键部署自动解压并安装；模型Key仍单独配置。安装ZIP、settings-local应用记录/备份不入Git。

prepare-offline.ps1只提取ZIP内offline/内容，兼容2026.10.11旧交付包，跳过其根脚本。重复部署校验并复用已提取文件；Check/Inspect不解压。目录有多个版本时选最后修改时间最新者；目录存在但包缺失或损坏即停止，不联网回退。每次外部依赖变化需重新制作包、更新版本和校验，并完成复用/修复/启动验证；整个offline-delivery不入Git。

准备入口回归：powershell.exe -NoProfile -ExecutionPolicy Bypass -File deepseek_harness_desktop/scripts/offline/test-prepare-offline.ps1
在临时目录验证ZIP选择、自动提取/复用/修复、只读模式和路径保护；不会修改正式业务数据。Git入口优先使用源仓库install.ps1读取离线资源，保留现有根启动脚本。
