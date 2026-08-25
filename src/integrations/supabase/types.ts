export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** Canonical type keys used by dispatch-notification / appointment-notifications */
export type NotificationType =
  | "appointment_1_hour_15_minutes_before"
  | "appointment_1_hour_before"
  | "appointment_15_minutes_before"
  | "appointment_now"
  | "transaction_expense"
  | "transaction_income"
  | "shopping_list_created"
  | "shopping_item_added"
  | "shopping_list_finished"
  | "engagement_inactive_2d"
  | "budget_threshold"
  | "invoice_due"
  | string;

export type NotificationPreferenceRow = {
  user_id: string;
  push_enabled: boolean;
  in_app_enabled: boolean;
  appointment_enabled: boolean;
  transaction_expense_enabled: boolean;
  transaction_income_enabled: boolean;
  shopping_list_created_enabled: boolean;
  shopping_item_added_enabled: boolean;
  shopping_list_finished_enabled: boolean;
  engagement_inactive_2d_enabled: boolean;
  budget_threshold_enabled: boolean;
  invoice_due_enabled: boolean;
  created_at?: string;
  updated_at?: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Json;
  read_at: string | null;
  created_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at?: string;
  updated_at?: string;
};

// Loose table shape so existing app code keeps compiling until full
// generated types are restored. Notification tables are typed below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = {
  Row: any;
  Insert: any;
  Update: any;
  Relationships: [];
};

/**
 * Minimal Database typings focused on the PWA notification tables.
 * Other tables remain loosely typed (`any`) to match the previous empty types.ts.
 */
export type Database = {
  public: {
    Tables: {
      notifications: {
        Row: NotificationRow;
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationType;
          title?: string;
          body?: string;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: NotificationPreferenceRow;
        Insert: Partial<NotificationPreferenceRow> & { user_id: string };
        Update: Partial<NotificationPreferenceRow>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      [key: string]: AnyTable;
    };
    Views: {
      [key: string]: AnyTable;
    };
    Functions: {
      is_super_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      [key: string]: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Args: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Returns: any;
      };
    };
    Enums: {
      [key: string]: string;
    };
    CompositeTypes: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    };
  };
};
