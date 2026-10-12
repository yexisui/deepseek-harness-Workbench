# 智能文档外部资料库扩展接口

本轮按用户决定只留接口，未安装 Dify、RAGFlow、向量库或本地模型，也未验证任何资料库连接。

后续插件可向 Cordis 注册 `documentKnowledge` 服务，实现 `src/core/document-knowledge.ts` 的 `DocumentKnowledgeAdapter`：

- `status()` 分别返回是否配置、是否验证、显示名称和实际状态说明。
- `search({query,limit}, signal)` 返回来源的标题、正文片段和可选 HTTP(S) 地址，并响应停止信号。

模型凭据沿用工作台模型设置。资料库凭据由未来适配器在服务端自己的设置命名空间维护，不放入能力版本、会话响应或普通日志。此接口不接受浏览器传入任意检索 URL 或密钥。

文档服务通过现有认证的 `/api/capabilities/documents/knowledge` 读取状态；没有适配器时明确返回未配置、未验证。用户启用检索后，仅将问题发送给适配器，最多接收 8 个来源，并以 K1…K8 与文档 P1…Pn 分开引用。检索失败或无结果不伪装成已连接或已有依据。

接入一个具体产品时，应为其协议补实现与真实联调，不能仅填地址就宣称支持该产品。
