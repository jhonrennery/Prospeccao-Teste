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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      leads: {
        Row: {
          created_at: string
          estimated_value: number | null
          id: string
          notes: string | null
          place_id: string
          status: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_value?: number | null
          id?: string
          notes?: string | null
          place_id: string
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_value?: number | null
          id?: string
          notes?: string | null
          place_id?: string
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_enrichment: {
        Row: {
          confidence_score: number | null
          created_at: string
          email: string | null
          id: string
          place_id: string
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          email?: string | null
          id?: string
          place_id: string
          source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          email?: string | null
          id?: string
          place_id?: string
          source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_enrichment_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          address: string | null
          category: string | null
          created_at: string
          email: string | null
          google_maps_url: string | null
          id: string
          instagram: string | null
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          place_id: string | null
          rating: number | null
          search_job_id: string | null
          total_reviews: number | null
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          created_at?: string
          email?: string | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          place_id?: string | null
          rating?: number | null
          search_job_id?: string | null
          total_reviews?: number | null
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          created_at?: string
          email?: string | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          place_id?: string | null
          rating?: number | null
          search_job_id?: string | null
          total_reviews?: number | null
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_search_job_id_fkey"
            columns: ["search_job_id"]
            isOneToOne: false
            referencedRelation: "search_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      search_jobs: {
        Row: {
          created_at: string
          has_website: boolean | null
          id: string
          location: string
          max_results: number | null
          minimum_rating: number | null
          radius_km: number | null
          segment: string
          status: string
          total_found: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          has_website?: boolean | null
          id?: string
          location: string
          max_results?: number | null
          minimum_rating?: number | null
          radius_km?: number | null
          segment: string
          status?: string
          total_found?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          has_website?: boolean | null
          id?: string
          location?: string
          max_results?: number | null
          minimum_rating?: number | null
          radius_km?: number | null
          segment?: string
          status?: string
          total_found?: number | null
          updated_at?: string
          user_id?: string
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
      whatsapp_chats: {
        Row: {
          chat_jid: string
          created_at: string
          id: string
          is_archived: boolean
          is_group: boolean
          last_message_at: string | null
          metadata: Json
          session_id: string
          subject: string | null
          unread_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_jid: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_group?: boolean
          last_message_at?: string | null
          metadata?: Json
          session_id: string
          subject?: string | null
          unread_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_jid?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_group?: boolean
          last_message_at?: string | null
          metadata?: Json
          session_id?: string
          subject?: string | null
          unread_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_chats_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          avatar_url: string | null
          contact_jid: string
          created_at: string
          full_name: string | null
          id: string
          is_business: boolean
          lid: string | null
          metadata: Json
          phone_number: string | null
          profile_name: string | null
          push_name: string | null
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          contact_jid: string
          created_at?: string
          full_name?: string | null
          id?: string
          is_business?: boolean
          lid?: string | null
          metadata?: Json
          phone_number?: string | null
          profile_name?: string | null
          push_name?: string | null
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          contact_jid?: string
          created_at?: string
          full_name?: string | null
          id?: string
          is_business?: boolean
          lid?: string | null
          metadata?: Json
          phone_number?: string | null
          profile_name?: string | null
          push_name?: string | null
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message_id: string
          payload: Json
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message_id: string
          payload?: Json
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message_id?: string
          payload?: Json
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          baileys_message_id: string
          chat_id: string | null
          chat_jid: string
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          id: string
          media_caption: string | null
          media_mime_type: string | null
          media_url: string | null
          message_direction: Database["public"]["Enums"]["whatsapp_message_direction"]
          message_status: Database["public"]["Enums"]["whatsapp_message_status"]
          message_type: string
          push_name: string | null
          quoted_message_id: string | null
          raw_payload: Json
          read_at: string | null
          recipient_jid: string | null
          sender_jid: string | null
          sent_at: string | null
          session_id: string
          text_content: string | null
          user_id: string
        }
        Insert: {
          baileys_message_id: string
          chat_id?: string | null
          chat_jid: string
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          media_caption?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_direction: Database["public"]["Enums"]["whatsapp_message_direction"]
          message_status?: Database["public"]["Enums"]["whatsapp_message_status"]
          message_type?: string
          push_name?: string | null
          quoted_message_id?: string | null
          raw_payload?: Json
          read_at?: string | null
          recipient_jid?: string | null
          sender_jid?: string | null
          sent_at?: string | null
          session_id: string
          text_content?: string | null
          user_id: string
        }
        Update: {
          baileys_message_id?: string
          chat_id?: string | null
          chat_jid?: string
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          media_caption?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_direction?: Database["public"]["Enums"]["whatsapp_message_direction"]
          message_status?: Database["public"]["Enums"]["whatsapp_message_status"]
          message_type?: string
          push_name?: string | null
          quoted_message_id?: string | null
          raw_payload?: Json
          read_at?: string | null
          recipient_jid?: string | null
          sender_jid?: string | null
          sent_at?: string | null
          session_id?: string
          text_content?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_session_auth: {
        Row: {
          auth_group: string
          auth_key: string
          auth_value: Json
          created_at: string
          id: string
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_group: string
          auth_key: string
          auth_value: Json
          created_at?: string
          id?: string
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_group?: string
          auth_key?: string
          auth_value?: Json
          created_at?: string
          id?: string
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_session_auth_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sessions: {
        Row: {
          created_at: string
          device_jid: string | null
          error_message: string | null
          id: string
          last_connected_at: string | null
          last_seen_at: string | null
          metadata: Json
          name: string
          phone_number: string | null
          qr_expires_at: string | null
          qr_payload: string | null
          session_status: Database["public"]["Enums"]["whatsapp_session_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_jid?: string | null
          error_message?: string | null
          id?: string
          last_connected_at?: string | null
          last_seen_at?: string | null
          metadata?: Json
          name?: string
          phone_number?: string | null
          qr_expires_at?: string | null
          qr_payload?: string | null
          session_status?: Database["public"]["Enums"]["whatsapp_session_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_jid?: string | null
          error_message?: string | null
          id?: string
          last_connected_at?: string | null
          last_seen_at?: string | null
          metadata?: Json
          name?: string
          phone_number?: string | null
          qr_expires_at?: string | null
          qr_payload?: string | null
          session_status?: Database["public"]["Enums"]["whatsapp_session_status"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      whatsapp_message_direction: "inbound" | "outbound"
      whatsapp_message_status:
        | "queued"
        | "sent"
        | "server_ack"
        | "delivered"
        | "read"
        | "received"
        | "failed"
      whatsapp_session_status:
        | "disconnected"
        | "connecting"
        | "qr_ready"
        | "connected"
        | "reconnecting"
        | "error"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "moderator", "user"],
      whatsapp_message_direction: ["inbound", "outbound"],
      whatsapp_message_status: [
        "queued",
        "sent",
        "server_ack",
        "delivered",
        "read",
        "received",
        "failed",
      ],
      whatsapp_session_status: [
        "disconnected",
        "connecting",
        "qr_ready",
        "connected",
        "reconnecting",
        "error",
      ],
    },
  },
} as const
