import { supabaseAdmin } from '@/lib/supabase/admin';
import { ipService, IPService } from './ip-service';
import { SecurityAlert } from './types';

export interface FraudCheckResult {
  blocked: boolean;
  reason?: string;
  details?: any;
}

export class FraudDetectionService {
  private ipService: IPService;

  constructor(service?: IPService) {
    this.ipService = service || ipService;
  }

  /**
   * Check for transaction fraud based on IP overlap
   */
  async checkTransactionFraud(buyerId: string, sellerId: string, currentIp: string): Promise<FraudCheckResult> {
    if (buyerId === sellerId) return { blocked: true, reason: 'Self-transaction not allowed' };
    
    // 1. Check if Buyer IP matches any of Seller's recent IPs
    const sellerIPs = await this.ipService.getUserIPs(sellerId, 20); // Last 20 IPs
    const sellerIpAddresses = new Set(sellerIPs.map(i => i.ip_address));

    if (sellerIpAddresses.has(currentIp)) {
      await this.createAlert({
        type: 'IP_MATCH_WARNING',
        user_id: buyerId,
        related_user_id: sellerId,
        ip_address: currentIp,
        severity: 'medium',
        details: { message: 'Buyer using Seller IP (Allowed for now)', seller_ips: Array.from(sellerIpAddresses) }
      });
      // Allow transaction but log it
      console.warn(`[FRAUD MONITOR] IP Match detected but allowed: ${currentIp}`);
      // return { blocked: true, reason: 'Security Alert: Suspicious network activity detected.' };
    }

    // 2. Check deeply: Have they EVER shared an IP? (Maybe too strict, let's stick to recent or specific window)
    // For now, let's check if Buyer's history overlaps with Seller's history significantly.
    // This query might be expensive, so we'll do a simpler check:
    // Check if they share the SAME IP in the last 7 days.
    
    const admin = supabaseAdmin();
    // RPC call is optional/enhancement, wrap in try-catch to avoid breaking if not deployed
    try {
        const { data: sharedIps, error } = await admin.rpc('check_shared_ip', {
            uid1: buyerId,
            uid2: sellerId,
            days: 7
        });
        
        if (!error && sharedIps && sharedIps.length > 0) {
             await this.createAlert({
                type: 'IP_SHARED_HISTORY',
                user_id: buyerId,
                related_user_id: sellerId,
                ip_address: sharedIps[0].ip_address,
                severity: 'medium', // Downgraded from critical
                details: { message: 'Users have shared IP history (Monitor Only)', shared_ips: sharedIps }
            });
            console.warn(`[FRAUD MONITOR] Shared IP history detected but allowed`);
            // return { blocked: true, reason: 'Security Alert: Shared history detected.' };
        }
    } catch (e) {
        // Ignore RPC error if function missing
        console.warn('check_shared_ip RPC failed or missing', e);
    }
    
    // Fallback: Check Buyer History vs Seller History (Top 5)
    const buyerIPs = await this.ipService.getUserIPs(buyerId, 5);
    for (const bip of buyerIPs) {
        if (sellerIpAddresses.has(bip.ip_address)) {
            await this.createAlert({
                type: 'IP_HISTORY_MATCH',
                user_id: buyerId,
                related_user_id: sellerId,
                ip_address: bip.ip_address,
                severity: 'medium', // Downgraded from high
                details: { message: 'Historical IP Match detected (Monitor Only)' }
            });
            console.warn(`[FRAUD MONITOR] Historical IP match detected but allowed: ${bip.ip_address}`);
            // return { blocked: true, reason: 'Security Alert: Suspicious account relation detected.' };
        }
    }

    return { blocked: false };
  }

  async createAlert(alert: Partial<SecurityAlert>): Promise<void> {
    const admin = supabaseAdmin();
    await admin.from('security_alerts').insert({
        ...alert,
        status: 'new',
        created_at: new Date().toISOString()
    });
  }
}

export const fraudDetectionService = new FraudDetectionService();
