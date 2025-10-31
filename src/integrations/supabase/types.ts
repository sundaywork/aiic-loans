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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      loan_applications: {
        Row: {
          approved_amount: number | null
          created_at: string
          driver_license_url: string | null
          face_photo_url: string | null
          id: string
          interest_rate: number
          pending_notes: string | null
          rejection_reason: string | null
          requested_amount: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          taxi_back_url: string | null
          taxi_front_url: string | null
          terms_weeks: number
          updated_at: string
          user_id: string
          weekly_payment: number | null
        }
        Insert: {
          approved_amount?: number | null
          created_at?: string
          driver_license_url?: string | null
          face_photo_url?: string | null
          id?: string
          interest_rate?: number
          pending_notes?: string | null
          rejection_reason?: string | null
          requested_amount: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          taxi_back_url?: string | null
          taxi_front_url?: string | null
          terms_weeks: number
          updated_at?: string
          user_id: string
          weekly_payment?: number | null
        }
        Update: {
          approved_amount?: number | null
          created_at?: string
          driver_license_url?: string | null
          face_photo_url?: string | null
          id?: string
          interest_rate?: number
          pending_notes?: string | null
          rejection_reason?: string | null
          requested_amount?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          taxi_back_url?: string | null
          taxi_front_url?: string | null
          terms_weeks?: number
          updated_at?: string
          user_id?: string
          weekly_payment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          application_id: string
          created_at: string
          end_date: string | null
          id: string
          interest_rate: number
          interests: number | null
          loan_no: string | null
          next_payment_date: string
          paid_by: string | null
          principal_amount: number
          remaining_balance: number
          signed_date: string | null
          start_date: string
          status: string
          terms_remaining: number
          terms_weeks: number
          total_amount: number
          updated_at: string
          user_id: string
          weekly_payment: number
        }
        Insert: {
          application_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          interest_rate: number
          interests?: number | null
          loan_no?: string | null
          next_payment_date: string
          paid_by?: string | null
          principal_amount: number
          remaining_balance: number
          signed_date?: string | null
          start_date: string
          status?: string
          terms_remaining: number
          terms_weeks: number
          total_amount: number
          updated_at?: string
          user_id: string
          weekly_payment: number
        }
        Update: {
          application_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          interest_rate?: number
          interests?: number | null
          loan_no?: string | null
          next_payment_date?: string
          paid_by?: string | null
          principal_amount?: number
          remaining_balance?: number
          signed_date?: string | null
          start_date?: string
          status?: string
          terms_remaining?: number
          terms_weeks?: number
          total_amount?: number
          updated_at?: string
          user_id?: string
          weekly_payment?: number
        }
        Relationships: [
          {
            foreignKeyName: "loans_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          loan_id: string
          notes: string | null
          paid_by: string | null
          payment_date: string
          recorded_by: string | null
          remaining_balance_after: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          loan_id: string
          notes?: string | null
          paid_by?: string | null
          payment_date?: string
          recorded_by?: string | null
          remaining_balance_after: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          loan_id?: string
          notes?: string | null
          paid_by?: string | null
          payment_date?: string
          recorded_by?: string | null
          remaining_balance_after?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          bank_account: string | null
          client_no: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          id1_number: string | null
          id1_type: string | null
          id2_number: string | null
          id2_type: string | null
          late_history: number | null
          occupation: string | null
          phone_number: string | null
          taxi_company_id: string | null
          updated_at: string
          vehicle_number_plate: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          client_no?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          id1_number?: string | null
          id1_type?: string | null
          id2_number?: string | null
          id2_type?: string | null
          late_history?: number | null
          occupation?: string | null
          phone_number?: string | null
          taxi_company_id?: string | null
          updated_at?: string
          vehicle_number_plate?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          client_no?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          id1_number?: string | null
          id1_type?: string | null
          id2_number?: string | null
          id2_type?: string | null
          late_history?: number | null
          occupation?: string | null
          phone_number?: string | null
          taxi_company_id?: string | null
          updated_at?: string
          vehicle_number_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_taxi_company_id_fkey"
            columns: ["taxi_company_id"]
            isOneToOne: false
            referencedRelation: "taxi_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      taxi_companies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
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
      app_role: "user" | "admin"
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
      app_role: ["user", "admin"],
    },
  },
} as const
