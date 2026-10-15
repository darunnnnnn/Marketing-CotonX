export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
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
      campaigns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          channel: Database["public"]["Enums"]["channel"]
          country_codes: string[]
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["campaign_kind"]
          name: string
          scheduled_from: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          target_statuses: Database["public"]["Enums"]["contact_status"][]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          channel?: Database["public"]["Enums"]["channel"]
          country_codes?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["campaign_kind"]
          name: string
          scheduled_from?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          target_statuses?: Database["public"]["Enums"]["contact_status"][]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          channel?: Database["public"]["Enums"]["channel"]
          country_codes?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["campaign_kind"]
          name?: string
          scheduled_from?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          target_statuses?: Database["public"]["Enums"]["contact_status"][]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          country: string
          country_code: string
          created_at: string
          domain: string | null
          employee_count: number | null
          id: string
          industry: string | null
          name: string
          sources: Database["public"]["Enums"]["source_id"][]
          updated_at: string
          verified: boolean
          website: string | null
        }
        Insert: {
          city?: string | null
          country: string
          country_code: string
          created_at?: string
          domain?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          name: string
          sources?: Database["public"]["Enums"]["source_id"][]
          updated_at?: string
          verified?: boolean
          website?: string | null
        }
        Update: {
          city?: string | null
          country?: string
          country_code?: string
          created_at?: string
          domain?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          name?: string
          sources?: Database["public"]["Enums"]["source_id"][]
          updated_at?: string
          verified?: boolean
          website?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          call_consent: boolean
          company_id: string
          created_at: string
          designation: string | null
          do_not_contact: boolean
          email: string
          id: string
          last_reply_at: string | null
          last_touch_at: string | null
          linkedin: string | null
          name: string | null
          phone: string | null
          preferred_language: string
          role_category: string | null
          role_priority: Database["public"]["Enums"]["role_priority"]
          sequence_position: Json
          sources: Database["public"]["Enums"]["source_id"][]
          status: Database["public"]["Enums"]["contact_status"]
          updated_at: string
          verified: boolean
        }
        Insert: {
          call_consent?: boolean
          company_id: string
          created_at?: string
          designation?: string | null
          do_not_contact?: boolean
          email: string
          id?: string
          last_reply_at?: string | null
          last_touch_at?: string | null
          linkedin?: string | null
          name?: string | null
          phone?: string | null
          preferred_language?: string
          role_category?: string | null
          role_priority?: Database["public"]["Enums"]["role_priority"]
          sequence_position?: Json
          sources?: Database["public"]["Enums"]["source_id"][]
          status?: Database["public"]["Enums"]["contact_status"]
          updated_at?: string
          verified?: boolean
        }
        Update: {
          call_consent?: boolean
          company_id?: string
          created_at?: string
          designation?: string | null
          do_not_contact?: boolean
          email?: string
          id?: string
          last_reply_at?: string | null
          last_touch_at?: string | null
          linkedin?: string | null
          name?: string | null
          phone?: string | null
          preferred_language?: string
          role_category?: string | null
          role_priority?: Database["public"]["Enums"]["role_priority"]
          sequence_position?: Json
          sources?: Database["public"]["Enums"]["source_id"][]
          status?: Database["public"]["Enums"]["contact_status"]
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      handoffs: {
        Row: {
          campaign_id: string | null
          contact_id: string
          created_at: string
          id: string
          reason: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          campaign_id?: string | null
          contact_id: string
          created_at?: string
          id?: string
          reason: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          reason?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "handoffs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingested_threads: {
        Row: {
          contact_id: string | null
          counterparty_email: string | null
          created_at: string
          excluded_reason: string | null
          external_id: string
          first_message_at: string | null
          id: string
          last_message_at: string | null
          mailbox_id: string | null
          message_count: number
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_verdict: string | null
          score: number
          signals: Json
          source: Database["public"]["Enums"]["source_id"]
          verdict: string
        }
        Insert: {
          contact_id?: string | null
          counterparty_email?: string | null
          created_at?: string
          excluded_reason?: string | null
          external_id: string
          first_message_at?: string | null
          id?: string
          last_message_at?: string | null
          mailbox_id?: string | null
          message_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_verdict?: string | null
          score: number
          signals?: Json
          source?: Database["public"]["Enums"]["source_id"]
          verdict: string
        }
        Update: {
          contact_id?: string | null
          counterparty_email?: string | null
          created_at?: string
          excluded_reason?: string | null
          external_id?: string
          first_message_at?: string | null
          id?: string
          last_message_at?: string | null
          mailbox_id?: string | null
          message_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_verdict?: string | null
          score?: number
          signals?: Json
          source?: Database["public"]["Enums"]["source_id"]
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingested_threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingested_threads_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingested_threads_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mailbox_sync_runs: {
        Row: {
          buyers: number
          discarded: number
          error: string | null
          finished_at: string | null
          id: string
          mailbox_id: string
          mode: string
          needs_review: number
          started_at: string
          threads_seen: number
        }
        Insert: {
          buyers?: number
          discarded?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          mailbox_id: string
          mode: string
          needs_review?: number
          started_at?: string
          threads_seen?: number
        }
        Update: {
          buyers?: number
          discarded?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          mailbox_id?: string
          mode?: string
          needs_review?: number
          started_at?: string
          threads_seen?: number
        }
        Relationships: [
          {
            foreignKeyName: "mailbox_sync_runs_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mailboxes: {
        Row: {
          address: string
          buyers_found: number
          created_at: string
          display_name: string | null
          enabled: boolean
          id: string
          last_error: string | null
          last_history_id: string | null
          last_synced_at: string | null
          status: Database["public"]["Enums"]["mailbox_sync_status"]
          threads_classified: number
          threads_seen: number
          updated_at: string
        }
        Insert: {
          address: string
          buyers_found?: number
          created_at?: string
          display_name?: string | null
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_history_id?: string | null
          last_synced_at?: string | null
          status?: Database["public"]["Enums"]["mailbox_sync_status"]
          threads_classified?: number
          threads_seen?: number
          updated_at?: string
        }
        Update: {
          address?: string
          buyers_found?: number
          created_at?: string
          display_name?: string | null
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_history_id?: string | null
          last_synced_at?: string | null
          status?: Database["public"]["Enums"]["mailbox_sync_status"]
          threads_classified?: number
          threads_seen?: number
          updated_at?: string
        }
        Relationships: []
      }
      merge_candidates: {
        Row: {
          contact_a: string
          contact_b: string
          created_at: string
          id: string
          reason: string
          resolved_at: string | null
          score: number
        }
        Insert: {
          contact_a: string
          contact_b: string
          created_at?: string
          id?: string
          reason: string
          resolved_at?: string | null
          score: number
        }
        Update: {
          contact_a?: string
          contact_b?: string
          created_at?: string
          id?: string
          reason?: string
          resolved_at?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "merge_candidates_contact_a_fkey"
            columns: ["contact_a"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merge_candidates_contact_b_fkey"
            columns: ["contact_b"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_events: {
        Row: {
          campaign_id: string | null
          channel: Database["public"]["Enums"]["channel"]
          contact_id: string
          detail: string | null
          id: string
          occurred_at: string
          provider_message_id: string | null
          step_id: string | null
          type: Database["public"]["Enums"]["outreach_event_type"]
        }
        Insert: {
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["channel"]
          contact_id: string
          detail?: string | null
          id?: string
          occurred_at?: string
          provider_message_id?: string | null
          step_id?: string | null
          type: Database["public"]["Enums"]["outreach_event_type"]
        }
        Update: {
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["channel"]
          contact_id?: string
          detail?: string | null
          id?: string
          occurred_at?: string
          provider_message_id?: string | null
          step_id?: string | null
          type?: Database["public"]["Enums"]["outreach_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "outreach_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_events_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "sequence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      send_queue: {
        Row: {
          attempts: number
          campaign_id: string
          channel: Database["public"]["Enums"]["channel"]
          contact_id: string
          created_at: string
          held_reason: string | null
          id: string
          send_at_utc: string
          status: Database["public"]["Enums"]["queue_status"]
          step_id: string
        }
        Insert: {
          attempts?: number
          campaign_id: string
          channel?: Database["public"]["Enums"]["channel"]
          contact_id: string
          created_at?: string
          held_reason?: string | null
          id?: string
          send_at_utc: string
          status?: Database["public"]["Enums"]["queue_status"]
          step_id: string
        }
        Update: {
          attempts?: number
          campaign_id?: string
          channel?: Database["public"]["Enums"]["channel"]
          contact_id?: string
          created_at?: string
          held_reason?: string | null
          id?: string
          send_at_utc?: string
          status?: Database["public"]["Enums"]["queue_status"]
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "send_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "send_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "send_queue_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "sequence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_steps: {
        Row: {
          campaign_id: string
          channel: Database["public"]["Enums"]["channel"]
          created_at: string
          delay_days: number
          id: string
          kind: Database["public"]["Enums"]["campaign_kind"]
          step_order: number
          template_id: string
        }
        Insert: {
          campaign_id: string
          channel?: Database["public"]["Enums"]["channel"]
          created_at?: string
          delay_days?: number
          id?: string
          kind: Database["public"]["Enums"]["campaign_kind"]
          step_order: number
          template_id: string
        }
        Update: {
          campaign_id?: string
          channel?: Database["public"]["Enums"]["channel"]
          created_at?: string
          delay_days?: number
          id?: string
          kind?: Database["public"]["Enums"]["campaign_kind"]
          step_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressions: {
        Row: {
          created_at: string
          id: string
          reason: Database["public"]["Enums"]["suppression_reason"]
          scope: Database["public"]["Enums"]["suppression_scope"]
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: Database["public"]["Enums"]["suppression_reason"]
          scope?: Database["public"]["Enums"]["suppression_scope"]
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: Database["public"]["Enums"]["suppression_reason"]
          scope?: Database["public"]["Enums"]["suppression_scope"]
          value?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          attachments: string[]
          body: string
          channel: Database["public"]["Enums"]["channel"]
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["campaign_kind"]
          language: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          attachments?: string[]
          body: string
          channel?: Database["public"]["Enums"]["channel"]
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["campaign_kind"]
          language?: string
          name: string
          subject?: string
          updated_at?: string
        }
        Update: {
          attachments?: string[]
          body?: string
          channel?: Database["public"]["Enums"]["channel"]
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["campaign_kind"]
          language?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write: { Args: never; Returns: boolean }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role: "ceo" | "marketing" | "merchandiser" | "viewer"
      campaign_kind:
        | "introduction"
        | "category"
        | "collection"
        | "proof"
        | "follow_up"
        | "event"
      campaign_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "scheduled"
        | "running"
        | "paused"
        | "done"
      channel: "email" | "whatsapp" | "sms" | "voice"
      contact_status:
        | "never_contacted"
        | "introduction_sent"
        | "conversation_started"
        | "buyer_replied"
        | "waiting_for_buyer"
        | "no_reply"
        | "follow_up_required"
        | "enquiry_received"
        | "active_lead"
      mailbox_sync_status: "idle" | "running" | "error" | "disabled"
      outreach_event_type:
        | "queued"
        | "sent"
        | "delivered"
        | "opened"
        | "clicked"
        | "replied"
        | "bounced"
        | "complained"
        | "unsubscribed"
        | "stopped"
      queue_status: "queued" | "held" | "sent" | "cancelled"
      role_priority: "high" | "medium" | "low"
      source_id:
        | "email"
        | "dns"
        | "gmail"
        | "apollo"
        | "website"
        | "linkedin"
        | "manual"
      suppression_reason:
        | "unsubscribe"
        | "bounce"
        | "complaint"
        | "manual"
        | "human_owned"
      suppression_scope: "email" | "domain"
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
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
      app_role: ["ceo", "marketing", "merchandiser", "viewer"],
      campaign_kind: [
        "introduction",
        "category",
        "collection",
        "proof",
        "follow_up",
        "event",
      ],
      campaign_status: [
        "draft",
        "pending_approval",
        "approved",
        "scheduled",
        "running",
        "paused",
        "done",
      ],
      channel: ["email", "whatsapp", "sms", "voice"],
      contact_status: [
        "never_contacted",
        "introduction_sent",
        "conversation_started",
        "buyer_replied",
        "waiting_for_buyer",
        "no_reply",
        "follow_up_required",
        "enquiry_received",
        "active_lead",
      ],
      mailbox_sync_status: ["idle", "running", "error", "disabled"],
      outreach_event_type: [
        "queued",
        "sent",
        "delivered",
        "opened",
        "clicked",
        "replied",
        "bounced",
        "complained",
        "unsubscribed",
        "stopped",
      ],
      queue_status: ["queued", "held", "sent", "cancelled"],
      role_priority: ["high", "medium", "low"],
      source_id: [
        "email",
        "dns",
        "gmail",
        "apollo",
        "website",
        "linkedin",
        "manual",
      ],
      suppression_reason: [
        "unsubscribe",
        "bounce",
        "complaint",
        "manual",
        "human_owned",
      ],
      suppression_scope: ["email", "domain"],
    },
  },
} as const
