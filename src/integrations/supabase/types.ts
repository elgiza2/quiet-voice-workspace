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
  public: {
    Tables: {
      agent_action_requests: {
        Row: {
          account_id: string
          arguments: Json
          conversation_id: string
          created_at: string
          id: string
          result: Json | null
          status: string
          tool_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          arguments?: Json
          conversation_id: string
          created_at?: string
          id?: string
          result?: Json | null
          status?: string
          tool_slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          arguments?: Json
          conversation_id?: string
          created_at?: string
          id?: string
          result?: Json | null
          status?: string
          tool_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_action_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_documents: {
        Row: {
          content: string
          created_at: string
          id: string
          mime: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mime: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mime?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_jobs: {
        Row: {
          bot_id: string | null
          conversation_id: string
          created_at: string
          cursor_at: string
          error: string | null
          event_id: string | null
          goal: string
          id: string
          result: string | null
          status: string
          system_prompt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id?: string | null
          conversation_id: string
          created_at?: string
          cursor_at?: string
          error?: string | null
          event_id?: string | null
          goal: string
          id?: string
          result?: string | null
          status?: string
          system_prompt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string | null
          conversation_id?: string
          created_at?: string
          cursor_at?: string
          error?: string | null
          event_id?: string | null
          goal?: string
          id?: string
          result?: string | null
          status?: string
          system_prompt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_jobs_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memories: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_routine_runs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          result: string | null
          routine_id: string
          scheduled_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          result?: string | null
          routine_id: string
          scheduled_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          result?: string | null
          routine_id?: string
          scheduled_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_routine_runs_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "agent_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_routines: {
        Row: {
          active: boolean
          conversation_id: string
          created_at: string
          goal: string
          id: string
          interval_hours: number
          last_error: string | null
          last_result: string | null
          lease_until: string | null
          next_run_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          conversation_id: string
          created_at?: string
          goal: string
          id?: string
          interval_hours: number
          last_error?: string | null
          last_result?: string | null
          lease_until?: string | null
          next_run_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          conversation_id?: string
          created_at?: string
          goal?: string
          id?: string
          interval_hours?: number
          last_error?: string | null
          last_result?: string | null
          lease_until?: string | null
          next_run_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_routines_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_group_members: {
        Row: {
          bot_id: string
          created_at: string
          group_id: string
          position: number
        }
        Insert: {
          bot_id: string
          created_at?: string
          group_id: string
          position?: number
        }
        Update: {
          bot_id?: string
          created_at?: string
          group_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "bot_group_members_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "bot_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_groups: {
        Row: {
          avatar_url: string | null
          category: string
          coordinator_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          category?: string
          coordinator_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          category?: string
          coordinator_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_groups_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          instructions: string | null
          is_public: boolean
          look: Json
          model: string | null
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          is_public?: boolean
          look?: Json
          model?: string | null
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          is_public?: boolean
          look?: Json
          model?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          bot_id: string | null
          created_at: string
          group_id: string | null
          id: string
          is_hidden: boolean
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          is_hidden?: boolean
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          is_hidden?: boolean
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "bot_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          bot_id: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          role: string
          user_id: string
        }
        Insert: {
          bot_id?: string | null
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
          user_id: string
        }
        Update: {
          bot_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          language: string
          onboarding_completed: boolean
          primary_bot_id: string | null
          updated_at: string
          user_type: string | null
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          language?: string
          onboarding_completed?: boolean
          primary_bot_id?: string | null
          updated_at?: string
          user_type?: string | null
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
          onboarding_completed?: boolean
          primary_bot_id?: string | null
          updated_at?: string
          user_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_primary_bot_id_fkey"
            columns: ["primary_bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_api_keys: {
        Row: {
          api_key: string
          cooldown_until: string | null
          created_at: string
          failure_count: number
          id: string
          last_error: string | null
          last_used_at: string | null
          provider: string
          status: string
        }
        Insert: {
          api_key: string
          cooldown_until?: string | null
          created_at?: string
          failure_count?: number
          id?: string
          last_error?: string | null
          last_used_at?: string | null
          provider: string
          status?: string
        }
        Update: {
          api_key?: string
          cooldown_until?: string | null
          created_at?: string
          failure_count?: number
          id?: string
          last_error?: string | null
          last_used_at?: string | null
          provider?: string
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          language: string
          notifications: Json
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          language?: string
          notifications?: Json
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          language?: string
          notifications?: Json
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_agent_routines: {
        Args: never
        Returns: {
          active: boolean
          conversation_id: string
          created_at: string
          goal: string
          id: string
          interval_hours: number
          last_error: string | null
          last_result: string | null
          lease_until: string | null
          next_run_at: string
          title: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "agent_routines"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_onboarding: {
        Args: {
          p_age: number
          p_avatar: string
          p_bot_name: string
          p_description: string
          p_instructions: string
          p_look: Json
          p_name: string
          p_type: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      read_agentsky_api_key: { Args: never; Returns: string }
      read_telegram_bot_token: { Args: never; Returns: string }
      save_bot_group: {
        Args: {
          p_category?: string
          p_coordinator: string
          p_id?: string
          p_members: string[]
          p_name: string
        }
        Returns: {
          avatar_url: string | null
          category: string
          coordinator_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bot_groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      store_agentsky_api_key: { Args: { p_key: string }; Returns: undefined }
      store_telegram_bot_token: {
        Args: { p_token: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
