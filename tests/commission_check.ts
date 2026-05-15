
import { PLAN_LIMITS } from '../lib/plans/limits';

async function runTest() {
    console.log('--- Verifying Commission Rates ---');
    
    // Verify Basic Plan
    const basicRate = PLAN_LIMITS.basic.commission_percent;
    if (basicRate !== 23) {
        console.error(`❌ FAILED: Basic Plan Commission should be 23%, found ${basicRate}%`);
        process.exit(1);
    } else {
        console.log(`✅ PASSED: Basic Plan Commission is 23%`);
    }

    // Verify Pro Plan
    const proRate = PLAN_LIMITS.pro.commission_percent;
    if (proRate !== 18) {
        console.error(`❌ FAILED: Pro Plan Commission should be 18%, found ${proRate}%`);
        process.exit(1);
    } else {
        console.log(`✅ PASSED: Pro Plan Commission is 18%`);
    }

    console.log('--- All Commission Tests Passed ---');
}

runTest();
