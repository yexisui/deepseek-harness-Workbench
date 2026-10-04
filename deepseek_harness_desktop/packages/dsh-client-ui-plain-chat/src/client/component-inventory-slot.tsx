import React from 'react'
import { InventoryTree } from '../../../dsh-plugin-manager/src/client/InventoryTree.tsx'
import { decorateSlot, type Registry } from './slot-adapter.ts'

/** Older aggregate bundles embed an inventory copy; retain its slot owner and injected services. */
export function registerComponentInventory(registry: Registry) {
  return decorateSlot(registry, 'settings.plugins.tab', 'InventoryTree', () => function ComponentInventory(props) {
    return <InventoryTree {...props}/>
  })
}
