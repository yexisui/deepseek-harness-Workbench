Capability packages / 外置能力源码

本目录提交能力源码、清单、说明和打包脚本。工程路径用英文，显示名称可用中文。
audio-segment-location 已有 src/main.cjs、capability.json 和 build.ps1；构建输出为 audio-segment-location/dist/audio-segment-location-latest.zip。
生成的 dist/、history/ 保留本机并忽略入库。构建成功不代表已导入任意用户 profile。
该能力根据时长/停顿生成分段计划；录音 I/O、FFmpeg/ffprobe 调用与凭据由宿主管理。
FFmpeg 通过根 deploy.ps1 的 Deploy 或 Tools 安装，检查和维护步骤见 ../external-tools/README.txt。

新增外置能力时同步说明依赖、构建与宿主调用方式；新增公共可执行工具必须登记到 external-tools/tools.json 并验证部署。
不携带录音、API Key、本机绝对路径或公共工具二进制。
移除 project-context 协作资料时，本目录源码与打包脚本继续保留。
