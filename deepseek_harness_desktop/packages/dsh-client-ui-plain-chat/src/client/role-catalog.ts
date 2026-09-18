import type { ChatKey } from './locales.ts'

export const roleIds = ['analyst', 'marketing', 'manager', 'developer'] as const
export type AssistantRole = typeof roleIds[number]
export type PreviewRole = 'chat' | AssistantRole
interface RoleExample {
  color: string
  name: ChatKey
  summary: ChatKey
  tags: readonly ChatKey[]
  duties: ChatKey
  requirements: ChatKey
  format: ChatKey
}

// Static UI examples only; these identifiers are never host preset IDs.
export const roleCatalog: Record<AssistantRole, RoleExample> = {
  analyst: { color: '#4F73E8', name: 'rolesAnalyst', summary: 'rolesSummary', tags: ['rolesTagOne', 'rolesTagTwo', 'rolesTagThree'], duties: 'rolesDutiesValue', requirements: 'rolesRequirementsValue', format: 'rolesFormatValue' },
  marketing: { color: '#E58A32', name: 'rolesMarketing', summary: 'rolesMarketingSummary', tags: ['rolesMarketingTagOne', 'rolesMarketingTagTwo', 'rolesMarketingTagThree'], duties: 'rolesMarketingDuties', requirements: 'rolesMarketingRequirements', format: 'rolesMarketingFormat' },
  manager: { color: '#9A62D8', name: 'rolesManager', summary: 'rolesManagerSummary', tags: ['rolesManagerTagOne', 'rolesManagerTagTwo', 'rolesManagerTagThree'], duties: 'rolesManagerDuties', requirements: 'rolesManagerRequirements', format: 'rolesManagerFormat' },
  developer: { color: '#22A58B', name: 'rolesDeveloper', summary: 'rolesDeveloperSummary', tags: ['rolesDeveloperTagOne', 'rolesDeveloperTagTwo', 'rolesDeveloperTagThree'], duties: 'rolesDeveloperDuties', requirements: 'rolesDeveloperRequirements', format: 'rolesDeveloperFormat' },
}
