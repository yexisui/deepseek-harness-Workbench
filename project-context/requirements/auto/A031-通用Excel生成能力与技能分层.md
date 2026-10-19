# A031 通用 Excel 生成能力与技能分层

- 编号：A031；关联事项：T042。
- 记录来源：用户要求新增功能中心 Excel 生成模块，模块仅提供生成能力，规范由既有或新建技能约束；由助手记录实施与验证。
- 创建/更新时间：2026-10-19。
- 状态：正式配置已保存、真实模型生成与下载通过，离线安装/复用/修复及实际启动通过；桌面入口的人工视觉体验待用户正常重开后验收。
- [返回事项台账](../../PEFR_PLAN.MD)。

## 需求与职责

1. 功能中心“Excel 生成”：接收工作表、数据、公式、合并、格式、列宽行高、冻结与筛选参数，生成可下载 XLSX。没有估算比例、固定业务表头、报价规则或默认模板。
2. 新技能“Excel 生成规范”（excel-generation-guidelines）：解释如何把业务要求组织成工具参数，检查行号/汇总和交付真实下载链接。
3. workload-estimator：继续负责估算口径、范围、两表结构、比例、公共部分与人月换算。本轮其四个源文件和内容哈希未修改。
4. 原“AI 项目估算助手”已通过现有管理接口保存为最新配置，保留原工作职责，只追加 Excel 功能与通用 Excel 技能；新对话使用新配置，旧版本与已有会话保留。没有创建重复岗位。

## 实现入口

- capability-packages/excel-generation：src/main.cjs、capability.json、build.mjs、docs、licenses、tests；skills/excel-generation-guidelines 保存独立技能源码。
- 构建生成 dist/excel-generation.zip 和 dist/excel-generation-guidelines.zip；分别走现有功能/技能导入管理。没有新建专属管理页面或第二套保存流程。
- 使用已安装 ExcelJS 与 esbuild 打包自包含 Node 程序，随包保留第三方许可证。无需用户安装 Office、Python 或新的外部 EXE，能力仅声明 node 权限，不调用模型。
- 宿主只扩展 packages/dsh-capabilities/src/host/package-artifact.ts：识别 XLSX 结果、向模型提供小型结果与下载地址，并通过现有认证路由下载。流程图原有下载/查看路线保持。
- settings-sync.cjs 修复技能资源导出：保留 skills 与 skill-management/versions 下的 .py/.xlsx，XLSX 按二进制原样迁移。否则 workload-estimator 脚本/模板丢失会破坏固定内容哈希。相关迁移测试通过；不执行导入的 Python。

## 已保存对象

| 对象 | 标识 |
| --- | --- |
| Excel 生成能力 | local-683c2126-572d-400c-b982-58a0df5aa06d，v1，已启用 |
| 生成动作 | pack:org.workbench.excel:writer:generate |
| 能力发布哈希 | b7f76536500f3665a7e7a78d3a96288464b6e614047a5b96bdda47c43b176f0e |
| 通用技能 | 6683e8a6-b1b7-425f-a98b-ce08e43a8eb4，已启用，仅岗位使用 |
| 技能内容哈希 | bab5dbd25a7bc3a10d235c8d8e261944e471bafe5c35c8091f64a462b522065a |
| 岗位 | local-b7e37045-6ca6-4a47-918f-e4d0e5dc8eef，AI 项目估算助手，v2 |

其他岗位、能力、技能与原 workload-estimator 记录在保存前后逐项比较保持。共享快照已重新导出，不含凭据、对话和结果。

## 验证与实际效果

- 通用生成器 4 项测试通过：任意数据/样式/公式、数据保护、输入边界及不植入业务字段。
- 宿主 6 个定向套件 36 项通过：真实 Worker、下载中文文件名、失败保留已有结果、重启恢复、停用授权，以及流程图、导入分发、技能绑定、路由认证与岗位直接保存。distribution 测试补齐旧 fixture 缺失的 webServer.port。
- 设置迁移 6 项通过，包括技能脚本与 XLSX 二进制逐字节往返。新技能 quick_validate 通过，能力和独立技能 ZIP 构建通过。
- 正式后台真实模型会话“AI 项目估算助手 · Excel 生成实测”（session-ef768b4e-0d3a-4abc-a4f9-e07d1df15604）加载两个技能后调用能力。首次因合并区包含已有数据被明确拒绝，模型修正参数后成功。
- 成功任务：57d6594f-9c72-4d79-867f-b7d1639b2bce。实际下载文件含“工作量汇总表”“AI部分”、5模块14条明细，编码17.4人天，总43.5人天/2.00人月；独立 openpyxl 检查 83 个业务公式、明细范围、跨表汇总及表头配色通过。
- 测试使用虚构采购材料预审小样；未上传用户原始工作量表，也未改动用户原文件。对话与结果保留便于查看。
- 本机证据：二次开发/excel-generation-20261019 下 live-evidence.json、workbook-check.json、final-state.json、verification/result.json、offline-startup.json。私有启动日志不进入共享文档/Git。

## 构建与交付边界

当前仓库有其他尚未提交的录音、界面、技能导入和图标工作。为避免覆盖它们，宿主运行包只替换本次 package-artifact 编译区段，其他字节保留。tsdown 定向编译成功；全项目 tsc 仍受既有缺失包类型和 MeetingService.authorizeSource 等错误影响，不能标记全项目类型检查通过。未用新的全量构建覆盖既有运行文件，也未将旧指纹当成新全量验证。

离线交付 2026.10.19-r11-win-x64 从 SHA256 验证过的 r10 公共安装包增量制作，逐项验证 47998 个旧文件，只更新宿主能力运行文件并追加 Excel 发布程序；保留其他既有离线资产。完整包 534367200 字节，48002 个程序文件，位于正式 offline-delivery。它不代表此前其他未同步离线事项已完成。

- ZIP SHA256：3f57e7d8c2c49ed9570c2c063241b0c5b757ebf2856b3380aa4d4fe062d44990。
- payload SHA256：9f0443bb8e89337b1ba6c19f1fa25afe985b7075b17245d527620bf0d4a0ee88。
- 外层仅 offline/；包含独立能力/技能可选 ZIP，不含源码开发环境、聊天、凭据或用户工作簿。
- 中文空格隔离目录：新安装 48002 项；重复安装修复 0 项；缺失/损坏修复 2 项；只读检查、业务哨兵保留、错误包校验拒绝通过。
- 离线新环境实际宿主启动、设置恢复、能力执行、XLSX 下载通过；此轮生成过程没有模型调用。

当前能力生成新 .xlsx，支持普通多表数据、样式及显式公式；不读取已有模板二进制，不就地编辑原文件，不生成宏/图表。公式写入并要求 Excel/WPS 打开后重算，未内置完整公式计算器；本轮独立核验了测试业务算术与公式，不声称完成全公式求值或逐像素模板复刻。受宿主通信体积限制，单文件上限350KB、单表20000单元格，参数上限256KiB。

使用方式：正常重开工作台，在功能中心查看“Excel 生成”；选择“AI 项目估算助手”新建对话，提供需求、范围和估算目标，要求按技能规则生成 Excel。其他岗位也可以按需绑定同一通用功能及对应业务技能。正式后台验证进程已关闭，配置和结果保留。
