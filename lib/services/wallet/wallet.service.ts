import { supabaseAdmin } from '@/lib/supabase/admin';
import { Wallet, WalletTransaction, WalletReferenceType } from '@/lib/types/wallet.types';

function shouldFallback(err: any): boolean {
  const code = String(err?.code || '').toUpperCase();
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === '42P01' || // undefined_table
    code === '42883' || // undefined_function
    code.startsWith('PGRST') ||
    msg.includes('manage_pocket_funds') ||
    msg.includes('function') ||
    msg.includes('procedure') ||
    msg.includes('does not exist') ||
    msg.includes('wallet_transaction_type') ||
    msg.includes('column \"type\" is of type'.replace(/\\"/g, '"')) ||
    msg.includes('column "type" is of type')
  );
}

export class WalletService {
  /**
   * Obtiene el wallet de un usuario. Retorna null si no existe.
   */
  static async getWallet(userId: string): Promise<Wallet | null> {
    const { data, error } = await supabaseAdmin()
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return data as Wallet;
  }

  /**
   * Crea un wallet para un usuario con saldo 0.
   */
  static async createWallet(userId: string): Promise<Wallet> {
    const { data, error } = await supabaseAdmin()
      .from('wallets')
      .insert({ user_id: userId, balance: 0 })
      .select()
      .single();
    if (error) throw error;
    return data as Wallet;
  }

  /**
   * Obtiene el wallet o lo crea si no existe.
   */
  static async getOrCreateWallet(userId: string): Promise<Wallet> {
    let wallet = await this.getWallet(userId);
    if (!wallet) {
      wallet = await this.createWallet(userId);
    }
    return wallet;
  }

  /**
   * Agrega fondos (Crédito) al wallet de un usuario de forma ATÓMICA.
   */
  static async addFunds(
    userId: string,
    amount: number,
    concept: string,
    refType: WalletReferenceType,
    refId?: string
  ): Promise<WalletTransaction> {
    try {
      const { data, error } = await supabaseAdmin().rpc('manage_pocket_funds', {
        p_user_id: userId,
        p_amount: amount,
        p_type: 'credit',
        p_concept: concept,
        p_ref_type: refType,
        p_ref_id: refId,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        throw new Error(result?.message || 'add_funds_failed');
      }
      const { data: txn, error: txnError } = await supabaseAdmin()
        .from('wallet_transactions')
        .select('*')
        .eq('id', result.transaction_id)
        .single();
      if (txnError) throw txnError;
      return txn as WalletTransaction;
    } catch (e: any) {
      if (!shouldFallback(e)) {
        throw e;
      }
      const admin = supabaseAdmin();
      const w = await this.getOrCreateWallet(userId);
      if (refId) {
        const { data: existing } = await admin
          .from('wallet_transactions')
          .select('*')
          .eq('wallet_id', userId)
          .eq('type', 'credit')
          .eq('reference_type', refType)
          .eq('reference_id', refId)
          .maybeSingle();
        if (existing) return existing as WalletTransaction;
      }
      const ins = await admin
        .from('wallet_transactions')
        .insert({
          wallet_id: userId,
          type: 'credit',
          amount,
          concept,
          reference_type: refType,
          reference_id: refId || null,
        })
        .select('*')
        .single();
      if (ins.error) throw ins.error;
      const newBalance = Number(w.balance) + Number(amount);
      const up = await admin.from('wallets').update({ balance: newBalance }).eq('user_id', userId);
      if (up.error) throw up.error;
      return ins.data as WalletTransaction;
    }
  }

  /**
   * Deduce fondos (Débito) del wallet de un usuario de forma ATÓMICA.
   */
  static async deductFunds(
    userId: string,
    amount: number,
    concept: string,
    refType: WalletReferenceType,
    refId?: string
  ): Promise<WalletTransaction> {
    try {
      const { data, error } = await supabaseAdmin().rpc('manage_pocket_funds', {
        p_user_id: userId,
        p_amount: amount,
        p_type: 'debit',
        p_concept: concept,
        p_ref_type: refType,
        p_ref_id: refId,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        throw new Error(result?.message || 'deduct_funds_failed');
      }
      const { data: txn, error: txnError } = await supabaseAdmin()
        .from('wallet_transactions')
        .select('*')
        .eq('id', result.transaction_id)
        .single();
      if (txnError) throw txnError;
      return txn as WalletTransaction;
    } catch (e: any) {
      if (!shouldFallback(e)) {
        throw e;
      }
      const admin = supabaseAdmin();
      const w = await this.getOrCreateWallet(userId);
      if (refId) {
        const { data: existing } = await admin
          .from('wallet_transactions')
          .select('*')
          .eq('wallet_id', userId)
          .eq('type', 'debit')
          .eq('reference_type', refType)
          .eq('reference_id', refId)
          .maybeSingle();
        if (existing) return existing as WalletTransaction;
      }
      const current = Number(w.balance);
      if (current < amount) {
        throw new Error('Saldo insuficiente');
      }
      const ins = await admin
        .from('wallet_transactions')
        .insert({
          wallet_id: userId,
          type: 'debit',
          amount,
          concept,
          reference_type: refType,
          reference_id: refId || null,
        })
        .select('*')
        .single();
      if (ins.error) throw ins.error;
      const newBalance = current - Number(amount);
      const up = await admin.from('wallets').update({ balance: newBalance }).eq('user_id', userId);
      if (up.error) throw up.error;
      return ins.data as WalletTransaction;
    }
  }

  /**
   * Transferencia P2P usando ID de PocketCash (16 dígitos).
   * Utiliza función RPC segura para atomicidad.
   */
  static async transferFunds(
    senderId: string,
    recipientCardNumber: string,
    amount: number,
    concept: string = 'Transferencia P2P'
  ): Promise<{ success: boolean; message: string; new_balance?: number }> {
    const { data, error } = await supabaseAdmin()
      .rpc('transfer_pocket_funds', {
        p_sender_id: senderId,
        p_recipient_card: recipientCardNumber,
        p_amount: amount,
        p_concept: concept
      });

    if (error) throw error;
    
    // Parse JSON result from RPC
    return data as { success: boolean; message: string; new_balance?: number };
  }


  /**
   * Procesa el pago de múltiples órdenes de forma ATÓMICA.
   */
  static async payOrdersBatch(userId: string, orders: { id: string; amount: number }[]): Promise<number> {
    if (orders.length === 0) {
      const w = await this.getOrCreateWallet(userId);
      return Number(w.balance);
    }

    const { data, error } = await supabaseAdmin()
      .rpc('pay_orders_batch_atomic', {
        p_user_id: userId,
        p_orders: orders
      });

    if (error) throw error;
    const result = data as any;
    
    if (!result.success) {
      throw new Error(result.message || 'Error procesando pago masivo');
    }

    return Number(result.new_balance);
  }

  /**
   * Procesa el cashback para una orden completada/entregada.
   * Verifica configuraciones y si ya se otorgó antes.
   */
  static async processOrderCashback(orderId: string): Promise<number> {
    try {
      const admin = supabaseAdmin();
      
      // 1. Obtener detalles de la orden
      const { data: ordDetails } = await admin
        .from('orders')
        .select('buyer_id, seller_id, total, subtotal, payment_method, created_at')
        .eq('id', orderId)
        .maybeSingle();

      if (!ordDetails || !ordDetails.buyer_id || (ordDetails.total || 0) <= 0) {
        return 0;
      }

      // Si pagó con PocketCash, no genera cashback
      if (ordDetails.payment_method === 'pocketcash') {
        return 0;
      }

      // 2. Verificar si ya se otorgó cashback para esta orden
      const { data: existingTx } = await admin
        .from('wallet_transactions')
        .select('id')
        .eq('reference_type', 'cashback')
        .eq('reference_id', orderId)
        .maybeSingle();

      if (existingTx) {
        // Ya se otorgó
        return 0;
      }

      // 3. Calcular Cashback Dinámico (Global + Tienda)
      const [settingsRes, sellerRes] = await Promise.all([
        admin.from('app_settings').select('*').single(),
        admin.from('profiles').select('store_cashback_enabled, store_cashback_percent').eq('id', ordDetails.seller_id).single()
      ]);

      const settings = settingsRes.data;
      const seller = sellerRes.data;
      const baseAmount = Number(ordDetails.subtotal) || Number(ordDetails.total) || 0;
      const orderDate = new Date(ordDetails.created_at);
      
      let globalAmount = 0;
      let storeAmount = 0;
      let globalPct = 0;
      let storePct = 0;

      // A. Global Cashback
      if (settings?.cashback_enabled) {
         const start = settings.cashback_start_date ? new Date(settings.cashback_start_date) : null;
         const end = settings.cashback_end_date ? new Date(settings.cashback_end_date) : null;
         const isActive = (!start || orderDate >= start) && (!end || orderDate <= end);
         
         if (isActive) {
             globalPct = Number(settings.cashback_percent) || 0;
             if (globalPct > 0) {
                 globalAmount = Number((baseAmount * (globalPct / 100)).toFixed(2));
             }
         }
      }

      // B. Store Cashback
      if (seller?.store_cashback_enabled) {
          storePct = Number(seller.store_cashback_percent) || 0;
          if (storePct > 0) {
              storeAmount = Number((baseAmount * (storePct / 100)).toFixed(2));
          }
      }

      const totalAmount = globalAmount + storeAmount;
      
      if (totalAmount <= 0) {
        return 0;
      }

      const descParts = [];
      if (globalAmount > 0) descParts.push(`Global ${globalPct}%`);
      if (storeAmount > 0) descParts.push(`Tienda ${storePct}%`);

      // 4. Agregar fondos
      await this.addFunds(
        ordDetails.buyer_id,
        totalAmount,
        `Cashback (${descParts.join(' + ')}) por compra #${orderId.slice(0, 8)}`,
        'cashback',
        orderId
      );

      return totalAmount;
    } catch (err) {
      console.error(`[WalletService] Error processing cashback for order ${orderId}:`, err);
      return 0;
    }
  }

  /**
   * Obtiene las transacciones de un usuario.
   */
  static async getTransactions(userId: string, limit = 50): Promise<WalletTransaction[]> {
    const { data, error } = await supabaseAdmin()
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data as WalletTransaction[];
  }
}
