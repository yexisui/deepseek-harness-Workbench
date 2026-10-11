共享设置

files/ 和 manifest.json 保存从当前工作台导出的可共享设置，不是运行数据目录。
包括模型名称与接口选项、JEV、岗位与能力组合、技能、插件分类、皮肤和宠物。
排除 API Key、认证令牌、Cookie、会话/录音/业务任务、使用记录、安装程序及缓存。
能力包只同步配置；外部程序及可选插件从离线包另外安装，不会因同步设置自动安装。

新电脑：先拉取 main，将安装ZIP原样放入项目根目录的 offline-delivery 文件夹，再运行一键部署.cmd。
关闭客户端后执行部署。脚本先安装/修复本地依赖，再导入共享设置；Key 需自行填写。
脚本自动提取 offline 内容；不需要手动解压或覆盖根脚本。offline-delivery 存在但无有效包时停止。
未提供 offline-delivery 或旧 offline 目录时，才沿用联网部署。
已有环境正常启动也会检查更新。相同设置文件只应用一次，之后保留本机修改；
Git 中该设置文件更新后再次合并。不会删除本机额外配置或改变旧任务使用的配置版本。
机器路径按实际根目录解析。修改前的本机配置备份与应用记录放 settings-local，不提交。
部署器只合并注册；共享设置由独立脚本导入。Check/Inspect 不导入、不改写。

在保留完整设置的电脑上更新快照（在项目根目录运行）：
.\runtime-node\node.exe .\deepseek_harness_desktop\scripts\settings-sync.cjs export .
export 仅读取本机配置并更新此目录；不会读取会话正文。发现疑似凭据会中止导出。
检查 git diff 后随代码提交。不要直接强制添加 dsh-data 或 desktop-state。
