import type { NumericPrecision } from '@/shared/lib/numeric'
import { createContext, useContext } from 'react'
import type { DocumentStatus } from '@/shared/constants/document-status'

export interface CodeOption {
  value: string
  label: string
}
export interface InventoryVariant {
  type: 'IN' | 'OUT' | 'ADJUST'
  kind: 'GENERAL' | 'PURCHASE' | 'TRANSFER' | null
  label: string
}
export interface SystemMetadata {
  numericPrecision: NumericPrecision
  modules: { code: string; name: string; label: string }[]
  documentStatuses: { value: DocumentStatus; label: string }[]
  codeGroups: { codeId: string; name: string; label: string }[]
  inventoryVariants: InventoryVariant[]
  inventoryStatuses: CodeOption[]
  accessScopes: CodeOption[]
  approvalStepTypes: CodeOption[]
  permissionActions: CodeOption[]
}
export const MetadataContext = createContext<SystemMetadata | null>(null)
export function useMetadata() {
  const value = useContext(MetadataContext)
  if (!value) throw new Error('MetadataProvider is required')
  return value
}
export function inventoryLabel(
  variants: readonly InventoryVariant[],
  type: string,
  kind?: string | null,
) {
  return (
    variants.find((v) => v.type === type && v.kind === (kind ?? null))?.label ??
    type
  )
}

export function useStatusLabels(): Record<string, string> {
  const { documentStatuses } = useMetadata()
  return Object.fromEntries(
    documentStatuses.map(({ value, label }) => [value, label]),
  )
}
