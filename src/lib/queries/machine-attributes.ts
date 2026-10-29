// src/lib/queries/machine-attributes.ts
// Query helpers for the machine attributes system

import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'

type AttributeDefinition = Database['public']['Tables']['machine_attribute_definitions']['Row']
type AttributeLink = Database['public']['Tables']['machine_attribute_links']['Row']
type AttributeValue = Database['public']['Tables']['user_machine_attribute_values']['Row']

// Exported types for use in components
export type { AttributeDefinition, AttributeLink, AttributeValue }

export interface MachineAttributeWithDefinition {
  link: AttributeLink
  definition: AttributeDefinition
}

// Map: machine_id -> array of attributes (sorted by sort_order)
export type MachineAttributesMap = Map<string, MachineAttributeWithDefinition[]>

// Map: `${program_machine_id}:${attribute_definition_id}` -> value string
export type AttributeValuesMap = Map<string, string>

/**
 * Build a composite key for the values map (scoped per program_machine+attr)
 */
export function attrValueKey(programMachineId: string, attrDefId: string): string {
  return `${programMachineId}:${attrDefId}`
}

/**
 * Load attribute definitions + links for a batch of machines.
 * Returns a map of machine_id -> sorted array of attributes with their definitions.
 */
export async function getMachineAttributesBatch(
  machineIds: string[]
): Promise<MachineAttributesMap> {
  const result: MachineAttributesMap = new Map()
  if (machineIds.length === 0) return result

  const supabase = createClient()

  // Load links with joined definitions
  const { data: linksData, error } = await supabase
    .from('machine_attribute_links')
    .select(`
      *,
      definition:machine_attribute_definitions (*)
    `)
    .in('machine_id', machineIds)
    .order('sort_order')


  if (error) {
    console.error('Error loading machine attribute links:', error)
    return result
  }

  if (!linksData) return result

  for (const row of linksData as any[]) {
    const machineId = row.machine_id as string
    const link: AttributeLink = {
      id: row.id,
      machine_id: row.machine_id,
      attribute_definition_id: row.attribute_definition_id,
      sort_order: row.sort_order,
      created_at: row.created_at,
    }
    const definition: AttributeDefinition = row.definition

    if (!definition) continue

    if (!result.has(machineId)) {
      result.set(machineId, [])
    }
    result.get(machineId)!.push({ link, definition })
  }

  return result
}

/**
 * Load a user's attribute values for a batch of program_machine ids.
 * Returns a map of "program_machine_id:attr_def_id" -> value.
 */
export async function getUserMachineAttributeValuesBatch(
  userId: string,
  programMachineIds: string[]
): Promise<AttributeValuesMap> {
  const result: AttributeValuesMap = new Map()
  if (!userId || programMachineIds.length === 0) return result

  const supabase = createClient()

  const { data, error } = await supabase
    .from('user_machine_attribute_values')
    .select('program_machine_id, attribute_definition_id, value')
    .eq('user_id', userId)
    .in('program_machine_id', programMachineIds)

  if (error) {
    console.error('Error loading user attribute values:', error)
    return result
  }

  if (!data) return result

  for (const row of data as any[]) {
    if (row.value != null && row.program_machine_id != null) {
      result.set(attrValueKey(row.program_machine_id, row.attribute_definition_id), row.value)
    }
  }

  return result
}

/**
 * Save attribute values for a user on a specific program_machine (routine+machine combo).
 * Uses upsert with conflict on (user_id, program_machine_id, attribute_definition_id).
 */
export async function saveUserMachineAttributeValues(
  userId: string,
  machineId: string,
  values: { attributeDefinitionId: string; value: string | null }[],
  programMachineId?: string
): Promise<{ error: any }> {
  const supabase = createClient()

  const rows = values
    .filter((v) => v.value !== null && v.value !== undefined)
    .map((v) => ({
      user_id: userId,
      machine_id: machineId,
      program_machine_id: programMachineId ?? null,
      attribute_definition_id: v.attributeDefinitionId,
      value: v.value,
      updated_at: new Date().toISOString(),
    }))

  if (rows.length === 0) return { error: null }

  const { error } = await supabase
    .from('user_machine_attribute_values')
    .upsert(rows as any, {
      onConflict: 'user_id,program_machine_id,attribute_definition_id',
    })

  return { error }
}

/**
 * Save attribute values for a user across multiple program_machines at once.
 * Key format: "program_machine_id:attr_def_id"
 * machineIdMap: program_machine_id -> machine_id (needed for the machine_id column)
 */
export async function saveUserMachineAttributeValuesBatch(
  userId: string,
  valuesMap: AttributeValuesMap,
  machineIdMap?: Map<string, string>
): Promise<{ error: any }> {
  const supabase = createClient()

  const rows: any[] = []
  valuesMap.forEach((value, key) => {
    if (value === null || value === undefined) return
    const [programMachineId, attrDefId] = key.split(':')
    rows.push({
      user_id: userId,
      machine_id: machineIdMap?.get(programMachineId) ?? programMachineId,
      program_machine_id: programMachineId,
      attribute_definition_id: attrDefId,
      value,
      updated_at: new Date().toISOString(),
    })
  })

  if (rows.length === 0) return { error: null }

  const { error } = await supabase
    .from('user_machine_attribute_values')
    .upsert(rows as any, {
      onConflict: 'user_id,program_machine_id,attribute_definition_id',
    })

  return { error }
}
