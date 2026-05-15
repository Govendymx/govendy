
export const MERCADOPAGO_FEES = {
  FIXED_FEE: 4.00,
  PERCENTAGE_FEE: 0.0349,
  IVA: 0.16,
};

export function calculateMercadoPagoFee(amount: number) {
  const { FIXED_FEE, PERCENTAGE_FEE, IVA } = MERCADOPAGO_FEES;
  
  const TOTAL_PERCENTAGE_LOAD = PERCENTAGE_FEE * (1 + IVA);
  const TOTAL_FIXED_LOAD = FIXED_FEE * (1 + IVA);
  
  // Calculate gross amount so that after fees, the recipient gets 'amount'
  // Gross = (Amount + FixedLoad) / (1 - PercentageLoad)
  const grossAmount = (amount + TOTAL_FIXED_LOAD) / (1 - TOTAL_PERCENTAGE_LOAD);
  
  // Round to 2 decimals
  const total = Math.round(grossAmount * 100) / 100;
  const fee = total - amount;
  
  return {
    originalAmount: amount,
    fee,
    total, // The amount the buyer pays
  };
}
