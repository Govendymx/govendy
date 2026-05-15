export type WalletTransactionType = 'credit' | 'debit';
export type WalletReferenceType = 'order' | 'refund' | 'admin_gift' | 'cashback' | 'withdrawal' | 'manual_adjustment' | 'subscription' | 'p2p_transfer' | 'payout' | 'gift_card' | 'shipping' | 'live_hours';

export interface Wallet {
  user_id: string;
  balance: number;
  currency: string;
  is_frozen: boolean;
  pocket_cash_number?: string; // 16-digit Virtual Card Number
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: WalletTransactionType;
  amount: number;
  concept: string;
  reference_type: WalletReferenceType;
  reference_id?: string | null;
  created_at: string;
}

export interface CashbackConfig {
  enabled: boolean;
  percentage: number; // e.g. 5 for 5%
  welcome_bonus: number; // Fixed amount for new users
}
