import React, { createContext, useContext, type ReactNode } from 'react'

/** The settings shell supplies its own authorized outlet, preserving the registered
 * section's services, child slots, localization and lifecycle. */
export const SettingsSectionContent = createContext<((id: string) => ReactNode) | undefined>(undefined)

export function ExistingPluginSettings() {
  const renderSection = useContext(SettingsSectionContent)
  return renderSection ? <>{renderSection('plugins')}</> : <p role="status">请从工作台设置打开能力中心，以加载完整插件管理。</p>
}
