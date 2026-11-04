export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: { Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      absences: {
        Row: {
          created_at: string
          end_date: string
          id: string
          kind: string
          start_date: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          kind: string
          start_date: string
          user_id?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          kind?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fin_allocation_rules: {
        Row: {
          created_at: string
          essentials: number
          growth: number
          id: string
          month: string
          reward: number
          scope: string
          stability: number
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          essentials: number
          growth: number
          id?: string
          month: string
          reward: number
          scope: string
          stability: number
          user_id?: string
        }
        Update: {
          created_at?: string
          essentials?: number
          growth?: number
          id?: string
          month?: string
          reward?: number
          scope?: string
          stability?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_allocation_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_asset_valuations: {
        Row: {
          asset_id: string
          id: string
          user_id: string
          value_cents: number
          valued_on: string
        }
        ComputedFields: never
        Insert: {
          asset_id: string
          id?: string
          user_id?: string
          value_cents: number
          valued_on: string
        }
        Update: {
          asset_id?: string
          id?: string
          user_id?: string
          value_cents?: number
          valued_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_asset_valuations_asset_id_user_id_fkey"
            columns: ["asset_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fin_assets"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "fin_asset_valuations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_assets: {
        Row: {
          asset_type: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          asset_type: string
          created_at?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_assets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_expenses: {
        Row: {
          amount_cents: number
          category: Database["public"]["Enums"]["fin_category"]
          created_at: string
          description: string
          id: string
          note: string | null
          payment_method: string | null
          recurring_id: string | null
          spent_on: string
          subcategory: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          category: Database["public"]["Enums"]["fin_category"]
          created_at?: string
          description: string
          id?: string
          note?: string | null
          payment_method?: string | null
          recurring_id?: string | null
          spent_on: string
          subcategory?: string | null
          user_id?: string
        }
        Update: {
          amount_cents?: number
          category?: Database["public"]["Enums"]["fin_category"]
          created_at?: string
          description?: string
          id?: string
          note?: string | null
          payment_method?: string | null
          recurring_id?: string | null
          spent_on?: string
          subcategory?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_expenses_recurring_id_user_id_fkey"
            columns: ["recurring_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fin_recurring_expenses"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "fin_expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_forecasts: {
        Row: {
          amount_cents: number
          month: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          month: string
          user_id?: string
        }
        Update: {
          amount_cents?: number
          month?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_forecasts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_goals: {
        Row: {
          created_at: string
          current_cents: number
          due_date: string | null
          id: string
          linked: string
          name: string
          target_cents: number
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          current_cents?: number
          due_date?: string | null
          id?: string
          linked?: string
          name: string
          target_cents: number
          user_id?: string
        }
        Update: {
          created_at?: string
          current_cents?: number
          due_date?: string | null
          id?: string
          linked?: string
          name?: string
          target_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_incomes: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          note: string | null
          received_on: string
          source: string
          status: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          note?: string | null
          received_on: string
          source: string
          status?: string
          user_id?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          note?: string | null
          received_on?: string
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_incomes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_investment_movements: {
        Row: {
          amount_cents: number
          asset_id: string
          created_at: string
          fees_cents: number
          id: string
          kind: string
          note: string | null
          occurred_on: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          asset_id: string
          created_at?: string
          fees_cents?: number
          id?: string
          kind: string
          note?: string | null
          occurred_on: string
          user_id?: string
        }
        Update: {
          amount_cents?: number
          asset_id?: string
          created_at?: string
          fees_cents?: number
          id?: string
          kind?: string
          note?: string | null
          occurred_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_investment_movements_asset_id_user_id_fkey"
            columns: ["asset_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fin_assets"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "fin_investment_movements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_recurring_expenses: {
        Row: {
          amount_cents: number
          category: Database["public"]["Enums"]["fin_category"]
          created_at: string
          day_of_month: number
          description: string
          end_month: string | null
          id: string
          paused: boolean
          payment_method: string | null
          start_month: string
          subcategory: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          category: Database["public"]["Enums"]["fin_category"]
          created_at?: string
          day_of_month: number
          description: string
          end_month?: string | null
          id?: string
          paused?: boolean
          payment_method?: string | null
          start_month: string
          subcategory?: string | null
          user_id?: string
        }
        Update: {
          amount_cents?: number
          category?: Database["public"]["Enums"]["fin_category"]
          created_at?: string
          day_of_month?: number
          description?: string
          end_month?: string | null
          id?: string
          paused?: boolean
          payment_method?: string | null
          start_month?: string
          subcategory?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_recurring_expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_savings_movements: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          kind: string
          note: string | null
          occurred_on: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          occurred_on: string
          user_id?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          occurred_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_savings_movements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_settings: {
        Row: {
          alert_threshold: number
          carry_defaults: NonNullable<Json>
          currency: string
          disabled_alerts: string[]
          emergency_goal_cents: number | null
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          alert_threshold?: number
          carry_defaults?: NonNullable<Json>
          currency?: string
          disabled_alerts?: string[]
          emergency_goal_cents?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          alert_threshold?: number
          carry_defaults?: NonNullable<Json>
          currency?: string
          disabled_alerts?: string[]
          emergency_goal_cents?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_transfers: {
        Row: {
          action: string
          amount_cents: number
          created_at: string
          from_category: Database["public"]["Enums"]["fin_category"]
          id: string
          month: string
          note: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          action: string
          amount_cents: number
          created_at?: string
          from_category: Database["public"]["Enums"]["fin_category"]
          id?: string
          month: string
          note?: string | null
          user_id?: string
        }
        Update: {
          action?: string
          amount_cents?: number
          created_at?: string
          from_category?: Database["public"]["Enums"]["fin_category"]
          id?: string
          month?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_transfers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          day: string
          name: string
        }
        ComputedFields: never
        Insert: {
          day: string
          name: string
        }
        Update: {
          day?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          can_view_reports: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        ComputedFields: never
        Insert: {
          can_view_reports?: boolean
          created_at?: string
          email: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          can_view_reports?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          project_id: string
          role: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          created_at: string
          done_at: string | null
          due_date: string
          id: string
          project_id: string
          title: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          done_at?: string | null
          due_date: string
          id?: string
          project_id: string
          title: string
        }
        Update: {
          created_at?: string
          done_at?: string | null
          due_date?: string
          id?: string
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tags: {
        Row: {
          project_id: string
          tag_id: string
        }
        ComputedFields: never
        Insert: {
          project_id: string
          tag_id: string
        }
        Update: {
          project_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          billable_default: boolean
          budget_minutes: number | null
          client_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          billable_default?: boolean
          budget_minutes?: number | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          billable_default?: boolean
          budget_minutes?: number | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        ComputedFields: never
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          created_at: string
          estimated_minutes: number | null
          task_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          estimated_minutes?: number | null
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_minutes?: number | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklist_items: {
        Row: {
          created_at: string
          done: boolean
          id: string
          label: string
          task_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          label: string
          task_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          label?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          task_id: string
        }
        ComputedFields: never
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_links: {
        Row: {
          created_at: string
          id: string
          label: string | null
          task_id: string
          url: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          task_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          task_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          tag_id: string
          task_id: string
        }
        ComputedFields: never
        Insert: {
          tag_id: string
          task_id: string
        }
        Update: {
          tag_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          blocked_reason: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          is_blocked: boolean
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          assignee_id?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_blocked?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_blocked?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          billable: boolean
          description: string | null
          edited_at: string | null
          ended_at: string | null
          id: string
          kind: string
          pause_reason: string | null
          source: string
          started_at: string
          task_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          billable?: boolean
          description?: string | null
          edited_at?: string | null
          ended_at?: string | null
          id?: string
          kind?: string
          pause_reason?: string | null
          source?: string
          started_at?: string
          task_id: string
          user_id?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          billable?: boolean
          description?: string | null
          edited_at?: string | null
          ended_at?: string | null
          id?: string
          kind?: string
          pause_reason?: string | null
          source?: string
          started_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entry_id: string
          entry_user_id: string | null
          id: number
          new_value: Json | null
          old_value: Json | null
          task_id: string
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entry_id: string
          entry_user_id?: string | null
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          task_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entry_id?: string
          entry_user_id?: string | null
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_audit_entry_user_id_fkey"
            columns: ["entry_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_audit_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_changes: {
        Row: {
          changed_at: string
          changed_by: string | null
          entry_id: string
          id: string
          new_ended_at: string
          new_started_at: string
          old_ended_at: string
          old_started_at: string
          reason: string
          task_id: string
        }
        ComputedFields: never
        Insert: {
          changed_at?: string
          changed_by?: string | null
          entry_id: string
          id?: string
          new_ended_at: string
          new_started_at: string
          old_ended_at: string
          old_started_at: string
          reason: string
          task_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          entry_id?: string
          id?: string
          new_ended_at?: string
          new_started_at?: string
          old_ended_at?: string
          old_started_at?: string
          reason?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_changes_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_changes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_changes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_time_entries: { Args: { p_approved: boolean; p_ids: string[] }; Returns: number }
      assign_worker: { Args: { p_task_id: string; p_user: string }; Returns: undefined }
      can_access_project: { Args: { p_project_id: string }; Returns: boolean }
      can_access_task: { Args: { p_task_id: string }; Returns: boolean }
      can_manage_project: { Args: { p_project_id: string }; Returns: boolean }
      can_manage_task: { Args: { p_task_id: string }; Returns: boolean }
      check_time_range: {
        Args: { p_ended_at: string; p_ignore: string; p_started_at: string; p_user: string }
        Returns: undefined
      }
      data_version: { Args: Record<PropertyKey, never>; Returns: number }
      edit_time_entry: {
        Args: { p_ended_at: string; p_id: string; p_reason: string; p_started_at: string }
        Returns: undefined
      }
      is_finance_user: { Args: { p_user: string }; Returns: boolean }
      is_owner: { Args: Record<PropertyKey, never>; Returns: boolean }
      log_time: {
        Args: { p_description: string; p_ended_at: string; p_started_at: string; p_task_id: string }
        Returns: string
      }
      pause_timer: { Args: { p_reason?: string }; Returns: undefined }
      resume_timer: { Args: Record<PropertyKey, never>; Returns: undefined }
      set_pause_reason: { Args: { p_id: string; p_reason: string }; Returns: undefined }
      set_time_entry_billable: { Args: { p_billable: boolean; p_id: string }; Returns: undefined }
      set_time_entry_description: { Args: { p_description: string; p_id: string }; Returns: undefined }
      start_timer: { Args: { p_task_id: string }; Returns: undefined }
      stop_timer: { Args: Record<PropertyKey, never>; Returns: undefined }
      stop_timer_at: { Args: { p_ended_at: string }; Returns: undefined }
    }
    Enums: {
      app_role: "owner" | "collaborator"
      fin_category: "growth" | "stability" | "essentials" | "reward"
      project_status: "planned" | "in_progress" | "paused" | "done"
      task_priority: "low" | "normal" | "high"
      task_status: "todo" | "in_progress" | "rescheduled" | "done"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["owner", "collaborator"],
      fin_category: ["growth", "stability", "essentials", "reward"],
      project_status: ["planned", "in_progress", "paused", "done"],
      task_priority: ["low", "normal", "high"],
      task_status: ["todo", "in_progress", "rescheduled", "done"],
    },
  },
} as const
