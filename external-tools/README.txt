External tools / 外部工具维护说明

当前必需工具：tools.json 中的 FFmpeg 与 ffprobe，供会议录音分段、时长探测和音频转换使用。
能力组合中的音频分段规划由 capability-packages/audio-segment-location 提供，公共可执行程序由宿主调用。

安装：powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy.ps1 -Mode Tools
此命令从工作台根目录调用独立补装入口；缺失时下载，已有相同版本则复用，不重建应用或改模型配置。
检查：powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\external-tools\install.ps1 -Check
此命令只检查程序启动、版本与 current.json；缺失时失败，不下载、不重写入口。
默认一键部署（Deploy）也安装工具，部署 Check 同时检查工具；Desktop/Web 普通启动不联网安装。

Git 保留 tools.json、install.ps1、README.txt 和 .gitignore。每种工具的目录、下载包、staging、current.json 均为本机生成物。
调用路径以工作台根目录及工具 current.json 解析，不写制作者绝对路径，不改系统 PATH。
当前安装器支持 Windows x64、含单一版本顶层目录的 ZIP；首次下载需联网，已有校验正确的缓存可以离线解压。

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
