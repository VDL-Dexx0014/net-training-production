// src/types/database.types.ts
// TypeScript types generated from your Supabase database schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      locations: {
        Row: {
          id: string
          name: string
          address: string
          city: string | null
          province: string | null
          postal_code: string | null
          timezone: string
          max_trainers: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address: string
          city?: string | null
          province?: string | null
          postal_code?: string | null
          timezone?: string
          max_trainers?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string
          city?: string | null
          province?: string | null
          postal_code?: string | null
          timezone?: string
          max_trainers?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          role: 'trainer' | 'client' | 'management'
          roles: ('trainer' | 'client' | 'management')[]
          first_name: string
          last_name: string
          email: string
          phone: string | null
          bio: string | null
          profile_photo_url: string | null
          fitness_goals: string | null
          medical_notes: string | null
          high_risk: boolean
          intensity: 'extra_low' | 'low' | 'medium' | 'high' | 'extra_high' | null
          notes: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          certifications: string[] | null
          specialties: string[] | null
          years_experience: number | null
          address: string | null
          city: string | null
          province: string | null
          postal_code: string | null
          timezone: string
          preferred_weight_unit: 'lbs' | 'kg'
          email_opt_in: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role: 'trainer' | 'client' | 'management'
          roles?: ('trainer' | 'client' | 'management')[]
          first_name: string
          last_name: string
          email: string
          phone?: string | null
          bio?: string | null
          profile_photo_url?: string | null
          fitness_goals?: string | null
          medical_notes?: string | null
          high_risk?: boolean
          intensity?: 'extra_low' | 'low' | 'medium' | 'high' | 'extra_high' | null
          notes?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          certifications?: string[] | null
          specialties?: string[] | null
          years_experience?: number | null
          address?: string | null
          city?: string | null
          province?: string | null
          postal_code?: string | null
          timezone?: string
          preferred_weight_unit?: 'lbs' | 'kg'
          email_opt_in?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: 'trainer' | 'client' | 'management'
          roles?: ('trainer' | 'client' | 'management')[]
          first_name?: string
          last_name?: string
          email?: string
          phone?: string | null
          bio?: string | null
          profile_photo_url?: string | null
          fitness_goals?: string | null
          medical_notes?: string | null
          high_risk?: boolean
          intensity?: 'extra_low' | 'low' | 'medium' | 'high' | 'extra_high' | null
          notes?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          certifications?: string[] | null
          specialties?: string[] | null
          email_opt_in?: boolean
          years_experience?: number | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          timezone?: string
          preferred_weight_unit?: 'lbs' | 'kg'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      trainer_locations: {
        Row: {
          id: string
          trainer_id: string
          location_id: string
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          trainer_id: string
          location_id: string
          is_primary?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          trainer_id?: string
          location_id?: string
          is_primary?: boolean
          created_at?: string
        }
      }
      trainer_clients: {
        Row: {
          id: string
          trainer_id: string
          client_id: string
          is_active: boolean
          added_at: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trainer_id: string
          client_id: string
          is_active?: boolean
          added_at?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trainer_id?: string
          client_id?: string
          is_active?: boolean
          added_at?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      machines: {
        Row: {
          id: string
          location_id: string | null
          machine_code: string
          machine_type: string
          machine_name: string
          manufacturer: string | null
          description: string | null
          body_zone: string | null
          is_active: boolean
          notes: string | null
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          location_id?: string | null
          machine_code: string
          machine_type: string
          machine_name: string
          manufacturer?: string | null
          description?: string | null
          body_zone?: string | null
          is_active?: boolean
          notes?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string | null
          machine_code?: string
          machine_type?: string
          machine_name?: string
          manufacturer?: string | null
          description?: string | null
          body_zone?: string | null
          is_active?: boolean
          notes?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      machine_locations: {
        Row: {
          id: string
          machine_id: string
          location_id: string
          created_at: string
        }
        Insert: {
          id?: string
          machine_id: string
          location_id: string
          created_at?: string
        }
        Update: {
          id?: string
          machine_id?: string
          location_id?: string
          created_at?: string
        }
      }
      programs: {
        Row: {
          id: string
          trainer_id: string | null
          client_id: string | null
          name: string
          description: string | null
          status: 'active' | 'completed' | 'archived'
          start_date: string | null
          end_date: string | null
          goals: string | null
          notes: string | null
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trainer_id?: string | null
          client_id?: string | null
          name: string
          description?: string | null
          status?: 'active' | 'completed' | 'archived'
          start_date?: string | null
          end_date?: string | null
          goals?: string | null
          notes?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trainer_id?: string | null
          client_id?: string | null
          name?: string
          description?: string | null
          status?: 'active' | 'completed' | 'archived'
          start_date?: string | null
          end_date?: string | null
          goals?: string | null
          notes?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      measurement_types: {
        Row: {
          id: string
          name: string
          abbreviation: string
          units: string[]
          description: string | null
          is_active: boolean
          is_custom: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          abbreviation: string
          units: string[]
          description?: string | null
          is_active?: boolean
          is_custom?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          abbreviation?: string
          units?: string[]
          description?: string | null
          is_active?: boolean
          is_custom?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      trainer_availability: {
        Row: {
          id: string
          trainer_id: string
          location_id: string
          start_time: string
          end_time: string
          is_recurring: boolean
          recurrence_pattern: Json | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trainer_id: string
          location_id: string
          start_time: string
          end_time: string
          is_recurring?: boolean
          recurrence_pattern?: Json | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trainer_id?: string
          location_id?: string
          start_time?: string
          end_time?: string
          is_recurring?: boolean
          recurrence_pattern?: Json | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          program_id: string | null
          trainer_id: string
          client_id: string
          location_id: string
          scheduled_start: string
          scheduled_end: string
          actual_start: string | null
          actual_end: string | null
          status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
          trainer_notes: string | null
          client_feedback: string | null
          client_rating: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          program_id?: string | null
          trainer_id: string
          client_id: string
          location_id: string
          scheduled_start: string
          scheduled_end: string
          actual_start?: string | null
          actual_end?: string | null
          status?: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
          trainer_notes?: string | null
          client_feedback?: string | null
          client_rating?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          program_id?: string | null
          trainer_id?: string
          client_id?: string
          location_id?: string
          scheduled_start?: string
          scheduled_end?: string
          actual_start?: string | null
          actual_end?: string | null
          status?: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
          trainer_notes?: string | null
          client_feedback?: string | null
          client_rating?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      machine_sessions: {
        Row: {
          id: string
          session_id: string
          machine_id: string
          measurement_type_id: string | null
          start_time: string
          end_time: string | null
          total_time_seconds: number | null
          weight_lbs: number | null
          weight_kg: number | null
          setting1: number | null
          setting2: number | null
          setting3: number | null
          setting4: number | null
          reps: number | null
          sets: number | null
          side: 'left' | 'right' | 'both' | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          machine_id: string
          measurement_type_id?: string | null
          start_time: string
          end_time?: string | null
          total_time_seconds?: number | null
          weight_lbs?: number | null
          weight_kg?: number | null
          setting1?: number | null
          setting2?: number | null
          setting3?: number | null
          setting4?: number | null
          reps?: number | null
          sets?: number | null
          side?: 'left' | 'right' | 'both' | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          machine_id?: string
          measurement_type_id?: string | null
          start_time?: string
          end_time?: string | null
          total_time_seconds?: number | null
          weight_lbs?: number | null
          weight_kg?: number | null
          setting1?: number | null
          setting2?: number | null
          setting3?: number | null
          setting4?: number | null
          reps?: number | null
          sets?: number | null
          side?: 'left' | 'right' | 'both' | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          related_session_id: string | null
          is_read: boolean
          sent_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          related_session_id?: string | null
          is_read?: boolean
          sent_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          related_session_id?: string | null
          is_read?: boolean
          sent_at?: string
          read_at?: string | null
        }
      }
      program_machines: {
        Row: {
          id: string
          program_id: string
          machine_id: string
          order_index: number
          current_weight: number | null
          current_reps: number | null
          current_sets: number | null
          initial_weight: number | null
          initial_reps: number | null
          initial_sets: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          program_id: string
          machine_id: string
          order_index: number
          current_weight?: number | null
          current_reps?: number | null
          current_sets?: number | null
          initial_weight?: number | null
          initial_reps?: number | null
          initial_sets?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          program_id?: string
          machine_id?: string
          order_index?: number
          current_weight?: number | null
          current_reps?: number | null
          current_sets?: number | null
          initial_weight?: number | null
          initial_reps?: number | null
          initial_sets?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_machine_settings: {
        Row: {
          id: string
          user_id: string
          machine_id: string
          setting1: string | null
          setting2: string | null
          setting3: string | null
          setting4: string | null
          notes: string | null
          last_verified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          machine_id: string
          setting1?: string | null
          setting2?: string | null
          setting3?: string | null
          setting4?: string | null
          notes?: string | null
          last_verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          machine_id?: string
          setting1?: string | null
          setting2?: string | null
          setting3?: string | null
          setting4?: string | null
          notes?: string | null
          last_verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      programs_history: {
        Row: {
          id: string
          program_id: string
          changed_at: string
          changed_by: string
          old_values: Json
          new_values: Json
        }
        Insert: {
          id?: string
          program_id: string
          changed_at?: string
          changed_by: string
          old_values: Json
          new_values: Json
        }
        Update: {
          id?: string
          program_id?: string
          changed_at?: string
          changed_by?: string
          old_values?: Json
          new_values?: Json
        }
      }
      program_machines_history: {
        Row: {
          id: string
          program_machine_id: string
          changed_at: string
          changed_by: string
          old_values: Json
          new_values: Json
        }
        Insert: {
          id?: string
          program_machine_id: string
          changed_at?: string
          changed_by: string
          old_values: Json
          new_values: Json
        }
        Update: {
          id?: string
          program_machine_id?: string
          changed_at?: string
          changed_by?: string
          old_values?: Json
          new_values?: Json
        }
      }
      user_machine_settings_history: {
        Row: {
          id: string
          user_machine_setting_id: string
          changed_at: string
          changed_by: string
          old_values: Json
          new_values: Json
        }
        Insert: {
          id?: string
          user_machine_setting_id: string
          changed_at?: string
          changed_by: string
          old_values: Json
          new_values: Json
        }
        Update: {
          id?: string
          user_machine_setting_id?: string
          changed_at?: string
          changed_by?: string
          old_values?: Json
          new_values?: Json
        }
      }
      machine_attribute_definitions: {
        Row: {
          id: string
          attribute_name: string
          value_type: 'numeric' | 'text'
          allowed_values: string[]
          default_value: string | null
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          attribute_name: string
          value_type: 'numeric' | 'text'
          allowed_values?: string[]
          default_value?: string | null
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          attribute_name?: string
          value_type?: 'numeric' | 'text'
          allowed_values?: string[]
          default_value?: string | null
          display_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      machine_attribute_links: {
        Row: {
          id: string
          machine_id: string
          attribute_definition_id: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          machine_id: string
          attribute_definition_id: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          machine_id?: string
          attribute_definition_id?: string
          sort_order?: number
          created_at?: string
        }
      }
      user_machine_attribute_values: {
        Row: {
          id: string
          user_id: string
          machine_id: string
          program_machine_id: string | null
          attribute_definition_id: string
          value: string | null
          notes: string | null
          last_verified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          machine_id: string
          program_machine_id?: string | null
          attribute_definition_id: string
          value?: string | null
          notes?: string | null
          last_verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          machine_id?: string
          program_machine_id?: string | null
          attribute_definition_id?: string
          value?: string | null
          notes?: string | null
          last_verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'trainer' | 'client' | 'management'
      session_status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
      program_status: 'active' | 'completed' | 'archived'
      weight_unit: 'lbs' | 'kg'
    }
  }
}