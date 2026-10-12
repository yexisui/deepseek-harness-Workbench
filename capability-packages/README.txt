Capability packages / 外置能力源码

本目录提交能力源码、清单、说明和打包脚本。工程路径用英文，显示名称可用中文。
audio-segment-location 已有 src/main.cjs、capability.json 和 build.ps1；构建输出为 audio-segment-location/dist/audio-segment-location-latest.zip。
生成的 dist/、history/ 保留本机并忽略入库。构建成功不代表已导入任意用户 profile。
该能力根据时长/停顿生成分段计划；录音 I/O、FFmpeg/ffprobe 调用与凭据由宿主管理。
FFmpeg 通过根 deploy.ps1 的 Deploy 或 Tools 安装，检查和维护步骤见 ../external-tools/README.txt。

新增外置能力时同步说明依赖、构建与宿主调用方式；新增公共可执行工具必须登记到 external-tools/tools.json 并验证部署。
不携带录音、API Key、本机绝对路径或公共工具二进制。
移除 project-context 协作资料时，本目录源码与打包脚本继续保留。

离线交付与共享设置

shared-settings 只共享能力定义，不把可执行程序提交 Git。制作离线包时，build-offline.py 会收集共享定义引用的全部发布文件（包括历史版本），写入 payload 安装清单。缺失文件或校验不一致时停止制作，避免交付“已安装但未加载”的能力。
默认从干净 donor 的 dsh-data/capabilities/packages/releases 读取；若 donor 不含这些程序，通过 --capability-releases 指定已导入且校验通过的 releases 目录。脚本仅读取共享定义引用的 capability.json 和清单内 runtime/resources/docs 文件，不读取会话、录音、任务或凭据。
新电脑仍运行根目录的一键部署.cmd；已有电脑可用它修复缺失发布文件。Git 最新定义若引用新能力，须一起更新离线交付包，不能只迁移 state.json。
