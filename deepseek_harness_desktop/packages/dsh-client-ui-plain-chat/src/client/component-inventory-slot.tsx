import { withCapabilityNavigation } from '../../../dsh-plugin-manager/src/client/CapabilityNavigation.tsx'
import React from 'react'
import { InventoryTree } from '../../../dsh-plugin-manager/src/client/InventoryTree.tsx'
import { decorateSlot, type Registry } from './slot-adapter.ts'

/** Older aggregate bundles embed an inventory copy; retain its slot owner and injected services. */
export function registerComponentInventory(registry: Registry) {
  const section=decorateSlot(registry,'settings.section','CapabilityPluginSection',withCapabilityNavigation)
  const inventory=decorateSlot(registry, 'settings.plugins.tab', 'InventoryTree', () => function ComponentInventory(props) {
    return <InventoryTree {...props}/>
  })
  return ()=>{inventory();section()}
}
