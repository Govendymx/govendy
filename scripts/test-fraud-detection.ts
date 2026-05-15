
import { FraudDetectionService, FraudCheckResult } from '../lib/security/fraud-detection';
import { IPService } from '../lib/security/ip-service';
import { UserIP, GeoLocation } from '../lib/security/types';

// Mock IP Service
class MockIPService extends IPService {
  private ipStore: Record<string, UserIP[]> = {};

  constructor(initialData: Record<string, string[]>) {
    super();
    for (const [uid, ips] of Object.entries(initialData)) {
      this.ipStore[uid] = ips.map((ip, i) => ({
        id: `mock-${i}`,
        user_id: uid,
        ip_address: ip,
        detected_at: new Date().toISOString()
      }));
    }
  }

  async getUserIPs(userId: string, limit = 5): Promise<UserIP[]> {
    return this.ipStore[userId] || [];
  }

  async recordUserIP(userId: string, ip: string): Promise<void> {
    if (!this.ipStore[userId]) this.ipStore[userId] = [];
    this.ipStore[userId].unshift({
        id: 'new',
        user_id: userId,
        ip_address: ip,
        detected_at: new Date().toISOString()
    });
  }
}

// Mock Fraud Service to avoid DB calls
class TestFraudDetectionService extends FraudDetectionService {
  public alerts: any[] = [];

  async createAlert(alert: any): Promise<void> {
    this.alerts.push(alert);
    console.log(`[MOCK ALERT] Created: ${alert.type} - ${alert.severity}`);
  }
}

async function runTests() {
  console.log('--- STARTING FRAUD DETECTION TESTS ---');

  const sellerId = 'seller-123';
  const buyerId = 'buyer-456';
  const cleanBuyerId = 'buyer-789';

  const mockIPs = {
    [sellerId]: ['192.168.1.1', '10.0.0.1'], // Seller uses these
    [buyerId]: ['192.168.1.1'],              // Bad buyer has same IP in history
    [cleanBuyerId]: ['8.8.8.8']              // Good buyer
  };

  const mockIpService = new MockIPService(mockIPs);
  const fraudService = new TestFraudDetectionService(mockIpService);

  // Test 1: Clean Transaction
  console.log('\nTest 1: Clean Transaction (Different IPs)');
  const res1 = await fraudService.checkTransactionFraud(cleanBuyerId, sellerId, '8.8.8.8');
  assert(res1.blocked === false, 'Clean transaction should not be blocked');
  console.log('✅ Passed');

  // Test 2: Current IP Match (Buyer uses Seller's IP now)
  console.log('\nTest 2: Current IP Match (Buyer using Seller IP)');
  const res2 = await fraudService.checkTransactionFraud(cleanBuyerId, sellerId, '192.168.1.1');
  assert(res2.blocked === true, 'Should block when current IP matches Seller IP');
  assert(res2.reason?.includes('Suspicious network'), 'Reason should match');
  console.log('✅ Passed');

  // Test 3: Historical Match (Buyer has used Seller's IP in past)
  console.log('\nTest 3: Historical Match (Buyer history overlaps Seller)');
  // Buyer 456 has '192.168.1.1' in history. Seller has it too.
  // Current IP is neutral '1.1.1.1'
  const res3 = await fraudService.checkTransactionFraud(buyerId, sellerId, '1.1.1.1');
  assert(res3.blocked === true, 'Should block when history overlaps');
  assert(res3.reason?.includes('Suspicious account relation'), 'Reason should match');
  console.log('✅ Passed');

  console.log('\n--- ALL TESTS PASSED ---');
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
}

runTests().catch(e => console.error(e));
