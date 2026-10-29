// src/components/machine/MachineAttributeEditor.tsx
// Reusable component for editing/displaying machine attribute values

'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type {
  MachineAttributeWithDefinition,
  AttributeValuesMap,
} from '@/lib/queries/machine-attributes'
import { attrValueKey } from '@/lib/queries/machine-attributes'

interface MachineAttributeEditorProps {
  machineId: string
  attributes: MachineAttributeWithDefinition[]
  values: AttributeValuesMap
  onChange?: (machineId: string, attrDefId: string, value: string) => void
  readOnly?: boolean
  compact?: boolean
}

export function MachineAttributeEditor({
  machineId,
  attributes,
  values,
  onChange,
  readOnly = false,
  compact = false,
}: MachineAttributeEditorProps) {
  if (!attributes || attributes.length === 0) {
    return (
      <div className="text-xs text-slate-400 italic">
        No attributes configured
      </div>
    )
  }

  // Compact read-only mode: render inline text
  if (compact && readOnly) {
    const parts = attributes
      .map((attr) => {
        const val = values.get(attrValueKey(machineId, attr.definition.id))
        if (!val) return null
        return `${attr.definition.attribute_name}: ${val}`
      })
      .filter(Boolean)

    if (parts.length === 0) {
      return (
        <div className="text-sm text-slate-500 italic">
          No settings configured
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 gap-2 text-sm">
        {attributes.map((attr) => {
          const val = values.get(attrValueKey(machineId, attr.definition.id))
          if (!val) return null
          return (
            <div key={attr.definition.id}>
              <span className="text-slate-600">{attr.definition.attribute_name}:</span>{' '}
              {val}
            </div>
          )
        })}
      </div>
    )
  }

  // Full editable mode: render dropdowns/inputs
  return (
    <div>
      <div className="flex flex-wrap gap-x-3 gap-y-2">
        {attributes.map((attr) => {
          const key = attrValueKey(machineId, attr.definition.id)
          const rawValue = values.get(key) || (attr.definition as any).default_value || ''
          const hasOptions = attr.definition.allowed_values.length > 0
          // Radix Select needs undefined (not '') for "no selection" — also clear stale values not in allowed list
          const currentValue = hasOptions && rawValue && !attr.definition.allowed_values.includes(rawValue)
            ? undefined
            : rawValue || undefined

          return (
            <div key={attr.definition.id} className="flex-shrink-0" style={{ minWidth: '80px' }}>
              <label className="text-[11px] text-slate-500 font-medium block leading-tight mb-0.5">
                {attr.definition.attribute_name}
              </label>
              {hasOptions ? (
                <Select
                  value={currentValue}
                  onValueChange={(val) => onChange?.(machineId, attr.definition.id, val)}
                  disabled={readOnly}
                >
                  <SelectTrigger className="text-xs h-7">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent>
                    {attr.definition.allowed_values.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={currentValue}
                  onChange={(e) => onChange?.(machineId, attr.definition.id, e.target.value)}
                  placeholder="-"
                  className="text-xs h-7"
                  readOnly={readOnly}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
