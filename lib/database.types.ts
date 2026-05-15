export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          first_name?: string | null
          last_name?: string | null
          avatar_url: string | null
          website: string | null
          email: string | null
          role: string | null
          created_at: string | null
          manual_reputation_score?: number | null
          manual_sales_count?: number | null
          admin_notes?: string | null
          is_official_store?: boolean
          official_store_name?: string | null
          official_store_banner_url?: string | null
          official_store_brand_color?: string | null
          is_pro?: boolean
          pro_subscription_start?: string | null
          pro_subscription_end?: string | null
        }
        Insert: {
          id: string
          full_name?: string | null
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          website?: string | null
          email?: string | null
          role?: string | null
          created_at?: string | null
          manual_reputation_score?: number | null
          manual_sales_count?: number | null
          admin_notes?: string | null
          is_official_store?: boolean
          official_store_name?: string | null
          official_store_banner_url?: string | null
          official_store_brand_color?: string | null
          is_pro?: boolean
          pro_subscription_start?: string | null
          pro_subscription_end?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          website?: string | null
          email?: string | null
          role?: string | null
          created_at?: string | null
          manual_reputation_score?: number | null
          manual_sales_count?: number | null
          admin_notes?: string | null
          is_official_store?: boolean
          official_store_name?: string | null
          official_store_banner_url?: string | null
          official_store_brand_color?: string | null
          is_pro?: boolean
          pro_subscription_start?: string | null
          pro_subscription_end?: string | null
        }
      }
      pro_subscription_logs: {
        Row: {
          id: string
          user_id: string
          operation_id: string
          action: string
          days_added: number
          amount: number
          payment_method: string | null
          previous_end_date: string | null
          new_end_date: string | null
          admin_id: string | null
          created_at: string
          metadata: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          operation_id: string
          action: string
          days_added: number
          amount: number
          payment_method?: string | null
          previous_end_date?: string | null
          new_end_date?: string | null
          admin_id?: string | null
          created_at?: string
          metadata?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          operation_id?: string
          action?: string
          days_added?: number
          amount?: number
          payment_method?: string | null
          previous_end_date?: string | null
          new_end_date?: string | null
          admin_id?: string | null
          created_at?: string
          metadata?: Json | null
        }
      }
      listings: {
        Row: {
          id: string
          title: string
          description: string | null
          price: number
          status: string
          seller_id: string
          created_at: string
          images: string[] | null
          is_featured: boolean
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          price: number
          status?: string
          seller_id: string
          created_at?: string
          images?: string[] | null
          is_featured?: boolean
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          price?: number
          status?: string
          seller_id?: string
          created_at?: string
          images?: string[] | null
          is_featured?: boolean
        }
      }
      // Add other tables as needed or use 'any' for flexibility if types are complex
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
