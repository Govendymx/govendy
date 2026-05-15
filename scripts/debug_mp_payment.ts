
import { MercadoPagoConfig, Payment } from 'mercadopago';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

async function checkPayment() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const paymentId = '145980787307';

  console.log('--- Debugging MercadoPago Payment ---');
  console.log('Access Token exists:', !!accessToken);
  if (accessToken) console.log('Access Token prefix:', accessToken.substring(0, 10) + '...');
  console.log('Target Payment ID:', paymentId);

  if (!accessToken) {
    console.error('ERROR: No Access Token found in .env.local');
    return;
  }

  try {
    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);

    console.log('Fetching payment...');
    const result = await payment.get({ id: paymentId });

    console.log('--- PAYMENT FOUND ---');
    console.log('ID:', result.id);
    console.log('Status:', result.status);
    console.log('Status Detail:', result.status_detail);
    console.log('Amount:', result.transaction_amount);
    console.log('External Reference:', result.external_reference);
    console.log('Date Created:', result.date_created);
  } catch (error: any) {
    console.error('--- ERROR FETCHING PAYMENT ---');
    console.error('Status:', error.status);
    console.error('Message:', error.message);
    if (error.cause) console.error('Cause:', error.cause);
    
    if (error.status === 404) {
      console.error('\nCONCLUSION: El ID de pago no existe para este Access Token.');
      console.error('Posibles causas:');
      console.error('1. El Access Token pertenece a una cuenta diferente a la que recibió el dinero.');
      console.error('2. El ID de pago es incorrecto.');
      console.error('3. El pago es de Sandbox pero el token es de Producción (o viceversa).');
    }
  }
}

checkPayment();
