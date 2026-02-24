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
      account_connections: {
        Row: {
          created_at: string | null
          email: string
          id: string
          recipient_id: string | null
          requester_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          recipient_id?: string | null
          requester_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          recipient_id?: string | null
          requester_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_connections_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "account_connections_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      appointment_notifications_sent: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          notification_type: string
          sent_at: string
          webhook_response: string | null
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          notification_type: string
          sent_at?: string
          webhook_response?: string | null
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          notification_type?: string
          sent_at?: string
          webhook_response?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          date: string
          description: string | null
          id: string
          phone: string | null
          status: string
          time: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          id?: string
          phone?: string | null
          status?: string
          time?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          phone?: string | null
          status?: string
          time?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_phone_fkey"
            columns: ["phone"]
            isOneToOne: false
            referencedRelation: "registraAi_dados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_cards: {
        Row: {
          card_limit: number | null
          closing_day: number
          color: string | null
          created_at: string | null
          due_day: number
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_limit?: number | null
          closing_day: number
          color?: string | null
          created_at?: string | null
          due_day: number
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_limit?: number | null
          closing_day?: number
          color?: string | null
          created_at?: string | null
          due_day?: number
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      n8n_chat_histories_registra_ai: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          code: string
          created_at: string
          email: string | null
          expires_at: string
          full_name: string | null
          id: string
          phone: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email?: string | null
          expires_at: string
          full_name?: string | null
          id?: string
          phone: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          full_name?: string | null
          id?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount: number
          asaas_customer_id: string | null
          asaas_payment_id: string
          created_at: string | null
          due_date: string | null
          id: string
          invoice_url: string | null
          paid_at: string | null
          payment_method: string | null
          status: string
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          asaas_customer_id?: string | null
          asaas_payment_id: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status: string
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          asaas_customer_id?: string | null
          asaas_payment_id?: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_registrations: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_postal_code: string | null
          address_state: string | null
          address_street: string | null
          asaas_customer_id: string | null
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          boleto_url: string | null
          created_at: string | null
          email: string
          expires_at: string
          full_name: string
          id: string
          invoice_url: string | null
          paid_at: string | null
          password_hash: string
          payment_method: string | null
          phone: string
          pix_code: string | null
          pix_qr_code_url: string | null
          plan_id: string | null
          status: string
          terms_accepted_at: string | null
          updated_at: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          boleto_url?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          full_name: string
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          password_hash: string
          payment_method?: string | null
          phone: string
          pix_code?: string | null
          pix_qr_code_url?: string | null
          plan_id?: string | null
          status?: string
          terms_accepted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          boleto_url?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          password_hash?: string
          payment_method?: string | null
          phone?: string
          pix_code?: string | null
          pix_qr_code_url?: string | null
          plan_id?: string | null
          status?: string
          terms_accepted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_registrations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          interval: string
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          interval: string
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          interval?: string
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      registra_ai_compradores: {
        Row: {
          Celular: string | null
          Cliente: string
          "CPF / CNPJ": string | null
          created_at: string
          Email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          Celular?: string | null
          Cliente: string
          "CPF / CNPJ"?: string | null
          created_at?: string
          Email?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          Celular?: string | null
          Cliente?: string
          "CPF / CNPJ"?: string | null
          created_at?: string
          Email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      registraAi_dados: {
        Row: {
          ChatDesativado: string | null
          created_at: string | null
          "data agendada": string | null
          email: string | null
          Fluxo: string | null
          ia_ativa: boolean | null
          id: string
          "ID brevo": string | null
          "ID negociação": string | null
          id_conversa: string | null
          inicio_int: string | null
          nome: string | null
          qtdInteracao: number | null
          remarketing: string | null
          RMK_ATIVO: boolean | null
          rmkt_ja_enviado: boolean | null
          Teste_IA: string | null
          ultm_int: string | null
          updated_at: string | null
        }
        Insert: {
          ChatDesativado?: string | null
          created_at?: string | null
          "data agendada"?: string | null
          email?: string | null
          Fluxo?: string | null
          ia_ativa?: boolean | null
          id: string
          "ID brevo"?: string | null
          "ID negociação"?: string | null
          id_conversa?: string | null
          inicio_int?: string | null
          nome?: string | null
          qtdInteracao?: number | null
          remarketing?: string | null
          RMK_ATIVO?: boolean | null
          rmkt_ja_enviado?: boolean | null
          Teste_IA?: string | null
          ultm_int?: string | null
          updated_at?: string | null
        }
        Update: {
          ChatDesativado?: string | null
          created_at?: string | null
          "data agendada"?: string | null
          email?: string | null
          Fluxo?: string | null
          ia_ativa?: boolean | null
          id?: string
          "ID brevo"?: string | null
          "ID negociação"?: string | null
          id_conversa?: string | null
          inicio_int?: string | null
          nome?: string | null
          qtdInteracao?: number | null
          remarketing?: string | null
          RMK_ATIVO?: boolean | null
          rmkt_ja_enviado?: boolean | null
          Teste_IA?: string | null
          ultm_int?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          cancel_at_period_end: boolean | null
          cancelled_at: string | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          is_trial: boolean | null
          plan_id: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          cancel_at_period_end?: boolean | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end: string
          current_period_start: string
          id?: string
          is_trial?: boolean | null
          plan_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          cancel_at_period_end?: boolean | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          is_trial?: boolean | null
          plan_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          bank_account_id: string | null
          category: string
          created_at: string
          credit_card_id: string | null
          date: string | null
          description: string | null
          id: string
          installment_group_id: string | null
          installment_number: number | null
          payment_method: string | null
          phone: string | null
          total_installments: number | null
          transaction_date: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category: string
          created_at?: string
          credit_card_id?: string | null
          date?: string | null
          description?: string | null
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          payment_method?: string | null
          phone?: string | null
          total_installments?: number | null
          transaction_date?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category?: string
          created_at?: string
          credit_card_id?: string | null
          date?: string | null
          description?: string | null
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          payment_method?: string | null
          phone?: string | null
          total_installments?: number | null
          transaction_date?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_phone_fkey"
            columns: ["phone"]
            isOneToOne: false
            referencedRelation: "registraAi_dados"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      add_appointment: {
        Args: {
          p_date: string
          p_description: string
          p_phone: string
          p_time: string
          p_title: string
          p_user_id: string
        }
        Returns: Json
      }
      add_transaction_by_phone:
        | {
            Args: {
              amount: number
              category: string
              date: string
              description: string
              phone: string
              type: string
            }
            Returns: Json
          }
        | {
            Args: {
              amount: number
              category: string
              date: string
              description: string
              phone: string
              type: string
              user_id: string
            }
            Returns: Json
          }
      assign_super_admin_to_email: {
        Args: { user_email: string }
        Returns: undefined
      }
      cancel_transaction_by_phone:
        | {
            Args: { p_id: string; p_phone: string; p_user_id: string }
            Returns: Json
          }
        | { Args: { phone: string; transaction_id: string }; Returns: Json }
      check_user_subscription: {
        Args: { p_user_id: string }
        Returns: {
          days_remaining: number
          has_active_subscription: boolean
          subscription_status: string
        }[]
      }
      cleanup_expired_otp: { Args: never; Returns: undefined }
      cleanup_expired_pending_registrations: { Args: never; Returns: undefined }
      create_user_via_api: {
        Args: {
          user_email: string
          user_full_name: string
          user_password: string
        }
        Returns: Json
      }
      delete_appointment:
        | { Args: { p_appointment_id: string; p_phone: string }; Returns: Json }
        | {
            Args: {
              p_appointment_id: string
              p_phone: string
              p_user_id: string
            }
            Returns: Json
          }
      get_appointments_by_phone: {
        Args: { p_limit?: number; p_phone: string }
        Returns: Json
      }
      get_connected_user_ids: {
        Args: { user_uuid: string }
        Returns: {
          connected_user_id: string
        }[]
      }
      get_transactions_by_phone: {
        Args: { limit?: number; phone: string; type?: string }
        Returns: Json
      }
      get_user_id_by_phone: { Args: { phone_number: string }; Returns: string }
      get_user_role: {
        Args: { user_id_param: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          role_param: Database["public"]["Enums"]["app_role"]
          user_id_param: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      reset_user_password: {
        Args: { new_password: string; user_email: string }
        Returns: Json
      }
      user_exists_and_active: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      user_has_profile: { Args: { user_id_param: string }; Returns: boolean }
      validate_user_active: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      validate_user_has_profile: {
        Args: { user_id_param: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user"
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
      app_role: ["super_admin", "admin", "user"],
    },
  },
} as const
