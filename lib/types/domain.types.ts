// Tipos de dominio de la aplicación

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'disputed';

export type CheckoutStatus = 'created' | 'pending' | 'paid' | 'failed' | 'cancelled';

export type PaymentMethod = 'mercadopago' | 'bank_transfer' | 'bank_deposit' | 'oxxo' | 'pocketcash' | 'pending_payment';

export type OrderSource = 'checkout' | 'auction';

export type DisputeStatus = 'open' | 'resolved' | 'closed';
export type DisputeReasonCode = 'not_received' | 'damaged' | 'not_as_described' | 'missing_items' | 'other';
export type DisputeSenderRole = 'buyer' | 'seller' | 'admin' | 'user';

export type ListingStatus = 'draft' | 'active' | 'sold' | 'paused' | 'blocked';
export type ListingSaleType = 'direct' | 'auction';
export type ListingGender = 'Mujer' | 'Hombre' | 'Unisex';
export type ListingCondition = 'nuevo' | 'usado' | 'casi_nuevo';

export type SupportConversationStatus = 'open' | 'closed';
export type SupportSenderRole = 'user' | 'admin';

export type ChatSenderRole = 'buyer' | 'seller' | 'admin' | 'user';

export interface Order {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  subtotal: number;
  shipping_fee: number;
  commission_fee: number;
  total: number;
  created_at: string;
  paid_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  shipping_label_url?: string | null;
  shipping_label_uploaded_at?: string | null;
  tracking_number?: string | null;
  shipping_carrier?: string | null;
  paid_to_seller_at?: string | null;
  coupon_code?: string | null;
  coupon_discount?: number | null;
  shipping_subsidy?: number | null;
  shipping_option_id?: string | null;
  delivery_proof_url?: string | null;
  shipping_full_name?: string | null;
  shipping_phone?: string | null;
  shipping_address?: any;
  order_source?: OrderSource | null;
  isr_withheld?: number | null;
  iva_withheld?: number | null;
}

export interface CheckoutSession {
  id: string;
  buyer_id: string;
  order_ids: string[];
  payment_method: PaymentMethod;
  status: CheckoutStatus;
  amount: number;
  reference_code?: string | null;
  paid_confirmed_at?: string | null;
  paid_confirmed_by?: string | null;
  paid_confirmed_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type?: string | null;
  title?: string | null;
  body?: string | null;
  link_to?: string | null;
  data?: any;
  is_read: boolean;
  created_at: string;
}

export interface ListingQuestion {
  id: string;
  listing_id: string;
  seller_id: string;
  asker_id: string;
  question_text: string;
  answer_text?: string | null;
  created_at: string;
  answered_at?: string | null;
  is_deleted: boolean;
}

export interface SellerWithdrawal {
  id: string;
  seller_id: string;
  amount_cents: number;
  order_ids: string[];
  status: 'pending' | 'completed' | 'failed';
  mp_transfer_id?: string | null;
  error_message?: string | null;
  account_details?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dispute {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  opened_by: string;
  reason_code: DisputeReasonCode;
  reason_text: string;
  status: DisputeStatus;
  admin_decision?: string | null;
  admin_note?: string | null;
  return_guide_url?: string | null;
  return_tracking?: string | null;
  return_guide_charged_to?: string | null;
  return_guide_cost?: number | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string;
  sender_role: DisputeSenderRole;
  body: string;
  attachments?: any[];
  created_at: string;
}

export interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description?: string | null;
  price: number;
  currency: string;
  images: string[];
  status: ListingStatus;
  gender?: ListingGender | null;
  size?: string | null;
  color?: string | null;
  category?: string | null;
  free_shipping?: boolean;
  condition?: ListingCondition | null;
  stock?: number | null;
  brand?: string | null;
  model?: string | null;
  color_variants?: string[] | null;
  size_variants?: string[] | null;
  size_stock?: Record<string, number> | null;
  size_type?: 'clothing' | 'shoes' | null;
  sale_type: ListingSaleType;
  is_featured?: boolean;
  featured_fee?: number;
  auction_start_at?: string | null;
  auction_end_at?: string | null;
  auction_starting_bid?: number;
  auction_bid_increment?: number;
  auction_highest_bid?: number;
  auction_highest_bidder_id?: string | null;
  description_blocks?: any;
  description_blocks_meta?: any;
  expires_at?: string | null;
  view_count?: number;
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  shipping_by_seller?: boolean;
  shipping_price?: number | null;
  shipping_carrier?: string | null;
  shipping_subsidy?: number | null;
  allow_personal_delivery?: boolean;
  handling_days?: number | null;
  wholesale_tiers?: any;
  subcategory?: string | null;
  attributes?: Record<string, any> | null;
  tags?: string[] | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_reason?: string | null;
  created_at: string;
  updated_at: string;
}


export interface SupportConversation {
  id: string;
  created_by: string;
  subject: string;
  status: SupportConversationStatus;
  last_message_at: string;
  assigned_admin_id?: string | null;
  assigned_at?: string | null;
  last_read_by_admin_at?: string | null;
  last_read_by_user_at?: string | null;
  last_delivered_to_user_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: SupportSenderRole;
  body: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  created_at: string;
}

export interface Bid {
  id: string;
  listing_id: string;
  bidder_id: string;
  amount: number;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface OrderMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role?: ChatSenderRole | null;
  body: string;
  attachments?: any[] | null;
  created_at: string;
}

export interface CreateOrderData {
  buyer_id: string;
  seller_id: string;
  payment_method: PaymentMethod;
  status?: OrderStatus;
  subtotal: number;
  shipping_fee: number;
  commission_fee: number;
  total: number;
  shipping_address?: any;
  shipping_full_name?: string;
  shipping_phone?: string;
  coupon_code?: string | null;
  coupon_discount?: number | null;
  shipping_subsidy?: number | null;
  shipping_option_id?: string | null;
  shipping_carrier?: string | null;
  /** true = envío gestionado por vendedor (shipping_fee va al vendedor)
   *  false = envío GoVendy/plataforma (shipping_fee queda en la plataforma)
   *  ⚠️ CRÍTICO para payoutNet(): sin este campo el cálculo de ganancias es incorrecto */
  shipping_by_seller?: boolean | null;
  /** 'checkout' = venta directa, 'auction' = subasta */
  order_source?: OrderSource | null;
}

export interface UpdateOrderData {
  status?: OrderStatus;
  paid_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  shipping_label_url?: string | null;
  shipping_label_uploaded_at?: string | null;
  label_downloaded_at?: string | null;
  tracking_number?: string | null;
  shipping_carrier?: string | null;
  paid_to_seller_at?: string | null;
}

export interface CreateNotificationData {
  user_id: string;
  type?: string;
  title: string;
  body: string;
  link_to?: string;
  data?: any;
  is_read?: boolean;
}

export interface CreateQuestionData {
  listing_id: string;
  seller_id: string;
  asker_id: string;
  question_text: string;
}

export interface AnswerQuestionData {
  answer_text: string;
}

export interface CreateWithdrawalData {
  seller_id: string;
  amount_cents: number;
  order_ids: string[];
  status: 'pending' | 'completed' | 'failed';
  mp_transfer_id?: string;
  error_message?: string;
  account_details?: string | null;
}

export interface PayoutBalance {
  disponible: number;
  por_liberar: number;
  estimado: number;
  can_withdraw: boolean;
  mercadopago_configured: boolean;
  orders_disponible: number;
  guide_deduction: number;
}

export interface CreateDisputeData {
  order_id: string;
  buyer_id: string;
  seller_id: string;
  opened_by: string;
  reason_code: DisputeReasonCode;
  reason_text?: string;
}

export interface CreateDisputeMessageData {
  dispute_id: string;
  sender_id: string;
  sender_role: DisputeSenderRole;
  body: string;
  attachments?: any[];
}

export interface CreateListingData {
  seller_id: string;
  title: string;
  description?: string | null;
  price: number;
  currency?: string;
  images: string[];
  status?: ListingStatus;
  gender?: ListingGender | null;
  size?: string | null;
  color?: string | null;
  category?: string | null;
  subcategory?: string | null;
  attributes?: Record<string, any> | null;
  tags?: string[] | null;
  free_shipping?: boolean;
  handling_days?: number | null;
  condition?: ListingCondition | null;
  stock?: number | null;
  brand?: string | null;
  model?: string | null;
  color_variants?: string[] | null;
  size_variants?: string[] | null;
  size_stock?: Record<string, number> | null;
  size_type?: 'clothing' | 'shoes' | null;
  sale_type?: ListingSaleType;
  is_featured?: boolean;
  featured_fee?: number;
  auction_start_at?: string | null;
  auction_end_at?: string | null;
  auction_starting_bid?: number;
  auction_bid_increment?: number;
  description_blocks?: any;
  description_blocks_meta?: any;
  shipping_by_seller?: boolean;
  shipping_price?: number | null;
  shipping_carrier?: string | null;
  shipping_subsidy?: number | null;
  allow_personal_delivery?: boolean;
  expires_at?: string | null;
  view_count?: number;
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
}

export interface UpdateListingData {
  title?: string;
  description?: string | null;
  price?: number;
  images?: string[];
  status?: ListingStatus;
  gender?: ListingGender | null;
  size?: string | null;
  color?: string | null;
  category?: string | null;
  free_shipping?: boolean;
  condition?: ListingCondition | null;
  stock?: number | null;
  color_variants?: string[] | null;
  size_variants?: string[] | null;
  size_stock?: Record<string, number> | null;
  size_type?: 'clothing' | 'shoes' | null;
  sale_type?: ListingSaleType;
  is_featured?: boolean;
  featured_fee?: number;
  auction_start_at?: string | null;
  auction_end_at?: string | null;
  auction_starting_bid?: number;
  auction_bid_increment?: number;
  auction_highest_bid?: number;
  auction_highest_bidder_id?: string | null;
  description_blocks?: any;
  description_blocks_meta?: any;
  expires_at?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_reason?: string | null;
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  shipping_by_seller?: boolean;
  shipping_price?: number | null;
  shipping_carrier?: string | null;
  shipping_subsidy?: number | null;
  allow_personal_delivery?: boolean;
  handling_days?: number | null;
}

export interface CreateSupportConversationData {
  created_by: string;
  subject: string;
}

export interface CreateSupportMessageData {
  conversation_id: string;
  sender_id: string;
  sender_role: SupportSenderRole;
  body: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
}

export interface CreateBidData {
  listing_id: string;
  bidder_id: string;
  amount: number;
}

export interface ApplyCouponParams {
  code: string;
  cartItems: Array<{ listingId: string; quantity: number }>;
}

export interface CouponDiscountResult {
  discountBySeller: Record<string, number>;
  coupon: Coupon;
}

export interface CreateOrderMessageData {
  order_id: string;
  sender_id: string;
  sender_role?: ChatSenderRole;
  body: string;
  attachments?: any[];
}
