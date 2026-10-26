import { KnowledgeSettings } from './KnowledgeSettings.tsx'
import React from 'react'
import s from './ManagedCapabilities.module.css'
export function DocumentSettings(){return <><div className={s.row}><div><strong>文档编辑与 AI</strong><p>Word 在本机打开、编辑和保存，无需 Office 授权或文档服务器。</p><p>AI 默认使用工作台当前模型，也可在文档侧栏切换；账号、地址和密钥统一在模型设置维护。</p><p>支持 .docx（最多 40 MB）。复杂分页、字体与修订可能存在差异，请核对重要文件。</p></div></div><KnowledgeSettings/></>}
