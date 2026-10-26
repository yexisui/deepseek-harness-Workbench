# 共享知识库提供方接入契约

2026-10-26。接口已贯通，正式工作台尚未登记实际提供方。需求助手的模板编写、修改、问答与智能文档共用 `KnowledgeService`；用户不需要先安装向量数据库才能使用本次文件。

## 后续接入位置

在宿主插件中实现 [KnowledgeProvider](src/core/knowledge.ts)，用现有 Cordis 服务机制登记 `knowledgeProvider`。宿主在实际调用时读取该服务：`ctx.provide('knowledgeProvider', provider)`。类型源文件属于本仓库，目前没有新增独立 npm SDK 或包导出入口。

- `id`：稳定的提供方标识。
- `status()`：返回 configured、verified、label、message、可选 checkedAt 和当前用户允许选择的 collections。填写配置不能视为验证成功。后续适配器负责真实连接检测及检测结论失效。
- `search({ query, limit, scope?, context? }, signal)`：只读检索，返回 sources。需求助手传入已确认的 collectionIds、可选 product/project 和服务端构造的 taskId/roleId/roleVersion；智能文档沿用当前问题检索并传入任务上下文，暂未增加资料集选择器。
- 每个来源提供稳定 documentId、chunkId、title、text、collectionId，以及可选 locator、url、version。来源原始 id 需提供；宿主实际身份由 providerId、collectionId、documentId、chunkId 共同计算。

适配器自行维护地址和凭据，复用宿主设置及遮挡规则。不要把密钥、鉴权头或带凭据的链接放入状态、来源、能力/岗位定义和日志。status 只公开白名单字段；来源链接只接受不含用户名密码的 HTTP(S)。

## 权限和范围

`knowledge-retrieval` 是可选业务组件，动作是 `search-knowledge`，可关联需求分析与智能文档能力。组件关联、岗位允许动作、真实服务配置是不同条件。旧需求权限迁移只扩展原有本地操作，不授予外部检索。

宿主检查所选资料集存在，并拒绝范围外的检索结果；提供方仍必须执行自身的访问控制。任务上下文用于提供方校验，不是可跳过鉴权的凭证。未指定 scope 的智能文档调用必须使用提供方明确允许的默认范围；不可搜索所有用户或所有租户。product/project 是业务过滤条件，不能替代访问控制。

遵循 AbortSignal；遇到失败抛出可展示的脱敏错误。无结果返回空数组，不扩大范围、不混入其他产品。宿主不自动上传本次文件、不建索引、不分块同步、不重试到其他资料集。

## 证据与兼容

宿主限制每次最多8条、每条最多6000字，按稳定身份去重并计算正文SHA256及检索时间。需求助手保存实际采用上下文的证据快照，逐字核对模型所给引用；编写候选、问答结果和文档版本保存关联。知识库后续更新不改写历史快照。引用存在只说明出处可核对，不证明整段推理或业务结论必然正确。

已有 `documentKnowledge` 适配器仍可供智能文档使用；新提供方优先。旧协议没有资料集信息，不允许伪装成需求助手可选择的资料库。接新需求流程应实现上述 `knowledgeProvider`。

公共只读状态接口是经宿主认证的 `GET /api/capabilities/knowledge/status`。需求与文档设置、组件详情读取同一来源。当前没有供用户填写任意地址的连接表单；应在真实服务协议明确后实现一次配置和连接检测，并复用这些页面。

## 接入后的验收

先以实际部署的服务测试鉴权失败、集合失效、空结果、超时和取消，再验证相近产品/不同版本隔离、原文定位、引用持久化及两助手权限。之后用获准的资料与模型完成真实生成、修改、问答验收。当前测试适配器仅位于测试代码和隔离演示，未登记到正式运行环境。
