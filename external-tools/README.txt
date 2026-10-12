External tools / 外部工具维护说明

当前必需工具：tools.json 中的 FFmpeg/ffprobe（音频处理）、Everything 1.4.1.1032 与 ES 1.1.0.38（本地文件名索引和查询）。
能力组合中的音频分段规划由 capability-packages/audio-segment-location 提供，公共可执行程序由宿主调用。

安装：powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy.ps1 -Mode Tools
此命令从工作台根目录调用独立补装入口；缺失时下载，已有相同版本则复用，不重建应用或改模型配置。
检查：powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\external-tools\install.ps1 -Check
此命令只检查程序启动、版本、current.json 与 Everything 服务状态；缺失时失败，不下载、不重写入口。
默认一键部署（Deploy）也安装工具，部署 Check 同时检查工具；Desktop/Web 普通启动不联网安装。

Git 保留 tools.json、install.ps1、README.txt 和 .gitignore。每种工具的目录、下载包、staging、current.json 均为本机生成物。
调用路径以工作台根目录及工具 current.json 解析，不写制作者绝对路径，不改系统 PATH。
当前安装器支持 Windows x64、含单一版本顶层目录或 flatArchive 平铺格式的 ZIP；首次下载需联网，已有校验正确的缓存可以离线解压。

新增/更新工具的交付步骤：
1. 在 tools.json 登记 id、固定版本、归档目录/文件名、下载来源、SHA-256、许可证和可执行文件路径。
2. 确认安装器支持该归档格式和版本检查；不支持时同步实现安装逻辑。每种工具使用自身子目录，共用工具不重复打入能力 ZIP。
3. 更新本说明及能力包依赖说明。根下工具目录由 /*/ 忽略；新增需提交的安装源文件应放本目录根，若必须建目录则添加精确例外。
4. 验证首次安装、已有安装复用、缺失时只读检查失败、校验和不匹配拒绝安装、正常检查和实际业务使用。
5. 将清单、安装/部署改动、验证结果一起提交；未验证内容如实记录，不能仅凭本机安装成功宣称新电脑部署完成。

移除协作资料 project-context 时，本目录与 deploy.ps1 必须保留，运行与安装不依赖协作资料。
禁止将 API Key、私人录音、配置备份或工具二进制提交 Git。
来源：https://ffmpeg.org/download.html  Windows 构建提供方：https://www.gyan.dev/ffmpeg/builds/
安装时保留上游 LICENSE 与 README。

安装回归：powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\external-tools\test-install.ps1 -ArchivePath <verified-ffmpeg-zip>
将占位符替换为与 tools.json 校验和一致的本地 FFmpeg ZIP；测试在唯一临时目录内验证安装/复用/错误拒绝及合成音频处理，保留隔离证据，不调用模型。

离线交付（2026-10-11）
离线包由 deepseek_harness_desktop/scripts/offline/build-offline.py 从已验证的干净部署目录制作。
FFmpeg、Everything、ES 的 releases、许可证和相对路径 current.json包含在本地payload中；离线部署不调用联网下载流程。
一键部署.cmd自动复用完整文件并修复缺失/损坏文件，-Mode Check只检查；原有联网部署保留在源码开发目录。
BrowserSkill为独立可选插件ZIP，主离线安装不安装或检查其npm插件、CLI和扩展。
需要时由用户将可选包解压至工作台根目录，再自行加载Chrome/Edge扩展；桌面仅在便携CLI已安装且没有显式DSH_BSK_PATH时选用它。
浏览器程序和用户浏览器数据不随包分发，额外插件包不代表能力导入格式。
Everything 与 ES
官方来源：https://www.voidtools.com/downloads/ 与 https://www.voidtools.com/support/everything/command_line_interface/
版本和 SHA256 固定于 tools.json；MIT 许可分别保留 everything-LICENSE.txt 和 es-LICENSE.txt。
部署通过 search-service.ps1 安装或复用 Everything 系统服务。首次安装由官方程序请求 Windows 管理员确认；只读 Check 不请求提升权限、不安装服务。
普通查询先复用已有 Everything 实例；需要时启动独立后台实例，索引保存在本机能力数据目录，不改用户已有 Everything 配置。关闭工作台只停止由工作台启动的实例。
范围留空为全部已索引本地位置；指定文件夹限定范围。支持部分名称、多关键词 AND、* 与 ? 通配符，不读取文档正文。
搜索记录、索引和用户路径不入 Git；删除搜索记录不删除原文件。源码测试使用自建中文、空格和通配符样本。
