import type { StationTables } from '@/lib/attendance/stations/types';
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: StationTables & {
      attendance_policies: {
        Row: {
          id: string
          store_id: string
          enforce_engine: boolean
          require_session_binding: boolean
          require_location_metadata: boolean
          max_accuracy_meters: number | null
          max_location_age_seconds: number
          smart_qr_enabled: boolean
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          store_id: string
          enforce_engine?: boolean
          require_session_binding?: boolean
          require_location_metadata?: boolean
          max_accuracy_meters?: number | null
          max_location_age_seconds?: number
          smart_qr_enabled?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          enforce_engine?: boolean
          require_session_binding?: boolean
          require_location_metadata?: boolean
          max_accuracy_meters?: number | null
          max_location_age_seconds?: number
          smart_qr_enabled?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      attendance_operations: {
        Row: {
          id: string
          employee_id: string
          operation_id: string
          command_hash: string
          action: string
          entry_point: string
          reason: string | null
          transaction_id: number
          response: Json | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          employee_id: string
          operation_id: string
          command_hash: string
          action: string
          entry_point: string
          reason?: string | null
          transaction_id: number
          response?: Json | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          employee_id?: string
          operation_id?: string
          command_hash?: string
          action?: string
          entry_point?: string
          reason?: string | null
          transaction_id?: number
          response?: Json | null
          created_at?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: []
      }
      attendance_audit_events: {
        Row: {
          id: string
          employee_id: string | null
          store_id: string | null
          attendance_id: string | null
          shift_id: string | null
          operation_id: string | null
          event_type: string
          attendance_method: string
          entry_point: string | null
          reason: string | null
          previous_values: Json | null
          new_values: Json | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          employee_id?: string | null
          store_id?: string | null
          attendance_id?: string | null
          shift_id?: string | null
          operation_id?: string | null
          event_type: string
          attendance_method: string
          entry_point?: string | null
          reason?: string | null
          previous_values?: Json | null
          new_values?: Json | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          employee_id?: string | null
          store_id?: string | null
          attendance_id?: string | null
          shift_id?: string | null
          operation_id?: string | null
          event_type?: string
          attendance_method?: string
          entry_point?: string | null
          reason?: string | null
          previous_values?: Json | null
          new_values?: Json | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          username: string | null
          role: 'admin' | 'manager' | 'employee'
          hourly_rate: number | null
          store_id: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          email?: string
          full_name?: string | null
          username?: string | null
          role?: 'admin' | 'manager' | 'employee'
          hourly_rate?: number | null
          store_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          username?: string | null
          role?: 'admin' | 'manager' | 'employee'
          hourly_rate?: number | null
          store_id?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      stores: {
        Row: {
          id: string
          name: string | null
          lat: number | null
          lng: number | null
          radius_meters: number | null
        }
        Insert: {
          id?: string
          name?: string | null
          lat?: number | null
          lng?: number | null
          radius_meters?: number | null
        }
        Update: {
          id?: string
          name?: string | null
          lat?: number | null
          lng?: number | null
          radius_meters?: number | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          check_out_method: string | null
          check_out_entry_point: string | null
          check_out_verification_status: string | null
          check_out_location_accuracy: number | null
          check_out_location_captured_at: string | null
          check_out_distance_meters: number | null
          version: number
          attendance_method: string
          entry_point: string | null
          verification_status: string
          location_accuracy: number | null
          location_captured_at: string | null
          distance_meters: number | null
          id: string
          employee_id: string
          store_id: string | null
          shift_id: string | null
          check_in: string
          check_out: string | null
          check_in_lat: number | null
          check_in_lng: number | null
          is_within_geofence: boolean | null
          is_auto_checkout: boolean | null
        }
        Insert: {
          check_out_method?: string | null
          check_out_entry_point?: string | null
          check_out_verification_status?: string | null
          check_out_location_accuracy?: number | null
          check_out_location_captured_at?: string | null
          check_out_distance_meters?: number | null
          version?: number
          attendance_method?: string
          entry_point?: string | null
          verification_status?: string
          location_accuracy?: number | null
          location_captured_at?: string | null
          distance_meters?: number | null
          id?: string
          employee_id: string
          store_id?: string | null
          shift_id?: string | null
          check_in: string
          check_out?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          is_within_geofence?: boolean | null
          is_auto_checkout?: boolean | null
        }
        Update: {
          check_out_method?: string | null
          check_out_entry_point?: string | null
          check_out_verification_status?: string | null
          check_out_location_accuracy?: number | null
          check_out_location_captured_at?: string | null
          check_out_distance_meters?: number | null
          version?: number
          attendance_method?: string
          entry_point?: string | null
          verification_status?: string
          location_accuracy?: number | null
          location_captured_at?: string | null
          distance_meters?: number | null
          id?: string
          employee_id?: string
          store_id?: string | null
          shift_id?: string | null
          check_in?: string
          check_out?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          is_within_geofence?: boolean | null
          is_auto_checkout?: boolean | null
        }
        Relationships: []
      }
      shifts: {
        Row: {
          attendance_started_at: string | null
          id: string
          employee_id: string | null
          start_time: string
          end_time: string | null
          shift_label: string | null
          status: string | null
          created_at: string | null
        }
        Insert: {
          attendance_started_at?: string | null
          id?: string
          employee_id?: string | null
          start_time: string
          end_time?: string | null
          shift_label?: string | null
          status?: string | null
          created_at?: string | null
        }
        Update: {
          attendance_started_at?: string | null
          id?: string
          employee_id?: string | null
          start_time?: string
          end_time?: string | null
          shift_label?: string | null
          status?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      shift_presets: {
        Row: {
          id: string
          label: string | null
          start_time: string | null
          end_time: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          label?: string | null
          start_time?: string | null
          end_time?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          label?: string | null
          start_time?: string | null
          end_time?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          id: string
          employee_id: string
          start_date: string
          end_date: string
          reason: string | null
          status: 'pending' | 'approved' | 'declined'
          created_at: string | null
        }
        Insert: {
          id?: string
          employee_id: string
          start_date: string
          end_date: string
          reason?: string | null
          status?: 'pending' | 'approved' | 'declined'
          created_at?: string | null
        }
        Update: {
          id?: string
          employee_id?: string
          start_date?: string
          end_date?: string
          reason?: string | null
          status?: 'pending' | 'approved' | 'declined'
          created_at?: string | null
        }
        Relationships: []
      }
      swap_requests: {
        Row: {
          shift_snapshot: Json | null
          id: string
          requestor_id: string
          receiver_id: string | null
          shift_id: string | null
          message: string | null
          note: string | null
          status: 'pending' | 'approved' | 'declined' | 'cancelled'
          created_at: string | null
        }
        Insert: {
          shift_snapshot?: Json | null
          id?: string
          requestor_id: string
          receiver_id?: string | null
          shift_id?: string | null
          message?: string | null
          note?: string | null
          status?: 'pending' | 'approved' | 'declined' | 'cancelled'
          created_at?: string | null
        }
        Update: {
          shift_snapshot?: Json | null
          id?: string
          requestor_id?: string
          receiver_id?: string | null
          shift_id?: string | null
          message?: string | null
          note?: string | null
          status?: 'pending' | 'approved' | 'declined' | 'cancelled'
          created_at?: string | null
        }
        Relationships: []
      }
      payroll_records: {
        Row: {
          id: string
          employee_id: string
          month_year: string | null
          base_hours: number | null
          gross_pay: number | null
          overtime_pay: number | null
          bonus_pay: number | null
          deductions: number | null
          net_pay: number | null
          type: 'salary' | 'advance' | 'bonus' | null
          status: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          employee_id: string
          month_year?: string | null
          base_hours?: number | null
          gross_pay?: number | null
          overtime_pay?: number | null
          bonus_pay?: number | null
          deductions?: number | null
          net_pay?: number | null
          type?: 'salary' | 'advance' | 'bonus' | null
          status?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          employee_id?: string
          month_year?: string | null
          base_hours?: number | null
          gross_pay?: number | null
          overtime_pay?: number | null
          bonus_pay?: number | null
          deductions?: number | null
          net_pay?: number | null
          type?: 'salary' | 'advance' | 'bonus' | null
          status?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string | null
          subscription_json: unknown
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          endpoint?: string | null
          subscription_json?: unknown
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string | null
          subscription_json?: unknown
          created_at?: string | null
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          id: string
          employee_id: string | null
          action: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          employee_id?: string | null
          action?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          employee_id?: string | null
          action?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      damage_reports: {
        Row: {
          id: string
          barcode: string
          product_name: string
          brand: string | null
          shade: string | null
          batch: string | null
          mrp: number | null
          quantity: number
          damage_type: string
          description: string | null
          reported_by: string
          store_id: string | null
          status: string
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          barcode: string
          product_name: string
          brand?: string | null
          shade?: string | null
          batch?: string | null
          mrp?: number | null
          quantity?: number
          damage_type: string
          description?: string | null
          reported_by: string
          store_id?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          barcode?: string
          product_name?: string
          brand?: string | null
          shade?: string | null
          batch?: string | null
          mrp?: number | null
          quantity?: number
          damage_type?: string
          description?: string | null
          reported_by?: string
          store_id?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "damage_reports_reported_by_fkey"
            columns: ["reported_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_reports_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      damage_images: {
        Row: {
          id: string
          damage_report_id: string
          url: string
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          damage_report_id: string
          url: string
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          damage_report_id?: string
          url?: string
          created_at?: string
          created_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "damage_images_damage_report_id_fkey"
            columns: ["damage_report_id"]
            referencedRelation: "damage_reports"
            referencedColumns: ["id"]
          }
        ]
      }
      damage_comments: {
        Row: {
          id: string
          damage_report_id: string
          comment: string
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          damage_report_id: string
          comment: string
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          damage_report_id?: string
          comment?: string
          created_at?: string
          created_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "damage_comments_damage_report_id_fkey"
            columns: ["damage_report_id"]
            referencedRelation: "damage_reports"
            referencedColumns: ["id"]
          }
        ]
      }
      checklist_templates: {
        Row: {
          id: string
          name: string
          type: string
          is_active: boolean
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: []
      }
      daily_checklists: {
        Row: {
          id: string
          template_id: string
          type: string
          date: string
          status: string
          completed_by: string | null
          completed_at: string | null
          photo_url: string | null
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          template_id: string
          type: string
          date?: string
          status?: string
          completed_by?: string | null
          completed_at?: string | null
          photo_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          template_id?: string
          type?: string
          date?: string
          status?: string
          completed_by?: string | null
          completed_at?: string | null
          photo_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_checklists_template_id_fkey"
            columns: ["template_id"]
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          }
        ]
      }
      daily_checklist_items: {
        Row: {
          id: string
          daily_checklist_id: string
          label: string
          is_completed: boolean
          completed_by: string | null
          completed_at: string | null
          photo_url: string | null
          sort_order: number
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          daily_checklist_id: string
          label: string
          is_completed?: boolean
          completed_by?: string | null
          completed_at?: string | null
          photo_url?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          daily_checklist_id?: string
          label?: string
          is_completed?: boolean
          completed_by?: string | null
          completed_at?: string | null
          photo_url?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_checklist_items_daily_checklist_id_fkey"
            columns: ["daily_checklist_id"]
            referencedRelation: "daily_checklists"
            referencedColumns: ["id"]
          }
        ]
      }
      store_sections: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: []
      }
      shelf_inspections: {
        Row: {
          id: string
          section_id: string
          employee_id: string
          status: string
          notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          section_id: string
          employee_id: string
          status?: string
          notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          section_id?: string
          employee_id?: string
          status?: string
          notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: []
      }
      inspection_images: {
        Row: {
          id: string
          inspection_id: string
          url: string
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          inspection_id: string
          url: string
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          inspection_id?: string
          url?: string
          created_at?: string
          created_by?: string
        }
        Relationships: []
      }
      inspection_comments: {
        Row: {
          id: string
          inspection_id: string
          comment: string
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          inspection_id: string
          comment: string
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          inspection_id?: string
          comment?: string
          created_at?: string
          created_by?: string
        }
        Relationships: []
      }
      testers: {
        Row: {
          id: string
          product_name: string
          brand: string | null
          shade: string | null
          opened_date: string | null
          expiry_date: string | null
          condition: string
          remaining_percentage: number
          needs_replacement: boolean
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          product_name: string
          brand?: string | null
          shade?: string | null
          opened_date?: string | null
          expiry_date?: string | null
          condition?: string
          remaining_percentage?: number
          needs_replacement?: boolean
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          product_name?: string
          brand?: string | null
          shade?: string | null
          opened_date?: string | null
          expiry_date?: string | null
          condition?: string
          remaining_percentage?: number
          needs_replacement?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: []
      }
      tester_logs: {
        Row: {
          id: string
          tester_id: string
          action: string
          notes: string | null
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          tester_id: string
          action: string
          notes?: string | null
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          tester_id?: string
          action?: string
          notes?: string | null
          created_at?: string
          created_by?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          assigned_to: string | null
          assigned_by: string | null
          priority: string
          due_date: string | null
          status: string
          category: string | null
          is_recurring: boolean
          recurrence_rule: string | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          assigned_to?: string | null
          assigned_by?: string | null
          priority?: string
          due_date?: string | null
          status?: string
          category?: string | null
          is_recurring?: boolean
          recurrence_rule?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          assigned_to?: string | null
          assigned_by?: string | null
          priority?: string
          due_date?: string | null
          status?: string
          category?: string | null
          is_recurring?: boolean
          recurrence_rule?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          comment: string
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          task_id: string
          comment: string
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          task_id?: string
          comment?: string
          created_at?: string
          created_by?: string
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          id: string
          task_id: string
          url: string
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          task_id: string
          url: string
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          task_id?: string
          url?: string
          created_at?: string
          created_by?: string
        }
        Relationships: []
      }
      audit_templates: {
        Row: {
          id: string
          name: string
          category: string | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          name: string
          category?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          name?: string
          category?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: []
      }
      audit_questions: {
        Row: {
          id: string
          template_id: string
          question: string
          max_score: number
          sort_order: number
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          template_id: string
          question: string
          max_score?: number
          sort_order?: number
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          template_id?: string
          question?: string
          max_score?: number
          sort_order?: number
          created_at?: string
          created_by?: string
        }
        Relationships: []
      }
      audits: {
        Row: {
          id: string
          template_id: string
          store_id: string | null
          conducted_by: string
          final_score: number | null
          max_score: number | null
          notes: string | null
          status: string
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          template_id: string
          store_id?: string | null
          conducted_by: string
          final_score?: number | null
          max_score?: number | null
          notes?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          template_id?: string
          store_id?: string | null
          conducted_by?: string
          final_score?: number | null
          max_score?: number | null
          notes?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: []
      }
      audit_answers: {
        Row: {
          id: string
          audit_id: string
          question_id: string
          score: number
          comment: string | null
          photo_url: string | null
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          audit_id: string
          question_id: string
          score?: number
          comment?: string | null
          photo_url?: string | null
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          audit_id?: string
          question_id?: string
          score?: number
          comment?: string | null
          photo_url?: string | null
          created_at?: string
          created_by?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          id: string
          title: string
          description: string | null
          incident_type: string
          priority: string
          status: string
          assigned_to: string | null
          store_id: string | null
          voice_note_url: string | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          incident_type: string
          priority?: string
          status?: string
          assigned_to?: string | null
          store_id?: string | null
          voice_note_url?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          incident_type?: string
          priority?: string
          status?: string
          assigned_to?: string | null
          store_id?: string | null
          voice_note_url?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: []
      }
      incident_images: {
        Row: {
          id: string
          incident_id: string
          url: string
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          incident_id: string
          url: string
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          incident_id?: string
          url?: string
          created_at?: string
          created_by?: string
        }
        Relationships: []
      }
      incident_comments: {
        Row: {
          id: string
          incident_id: string
          comment: string
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          incident_id: string
          comment: string
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          incident_id?: string
          comment?: string
          created_at?: string
          created_by?: string
        }
        Relationships: []
      }
      restock_requests: {
        Row: {
          id: string
          status: string
          notes: string | null
          supplier_notes: string | null
          approved_by: string | null
          approved_at: string | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          status?: string
          notes?: string | null
          supplier_notes?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          status?: string
          notes?: string | null
          supplier_notes?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: []
      }
      restock_items: {
        Row: {
          id: string
          restock_request_id: string
          barcode: string
          product_name: string
          brand: string | null
          quantity_needed: number
          quantity_approved: number | null
          supplier_notes: string | null
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          restock_request_id: string
          barcode: string
          product_name: string
          brand?: string | null
          quantity_needed?: number
          quantity_approved?: number | null
          supplier_notes?: string | null
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          restock_request_id?: string
          barcode?: string
          product_name?: string
          brand?: string | null
          quantity_needed?: number
          quantity_approved?: number | null
          supplier_notes?: string | null
          created_at?: string
          created_by?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          id: string
          user_id: string | null
          title: string
          body: string | null
          type: string | null
          link: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          title: string
          body?: string | null
          type?: string | null
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          title?: string
          body?: string | null
          type?: string | null
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      attendance_smart_scan: { Args: { p_command: Json; p_operation_id?: string }; Returns: Json }
      attendance_station_admin: { Args: { p_command: Json }; Returns: Json }
      attendance_station_device: { Args: { p_action: string; p_credential: string; p_station_id: string | null; p_request_id?: string; p_token_hash?: string; p_pairing_hash?: string }; Returns: Json }
      attendance_station_token_status: { Args: { p_token: string }; Returns: Json }

      attendance_transition: {
        Args: { p_command: Json; p_operation_id: string; p_entry_point?: string }
        Returns: Json
      }
      commit_shift_changes: {
        Args: { p_changes: Json; p_expected: Json; p_request_id?: string; p_decision?: string }
        Returns: undefined
      }
      manual_trigger_checkout: {
        Args: Record<string, never>
        Returns: void
      }
    }
    Enums: Record<string, never>
  }
}
