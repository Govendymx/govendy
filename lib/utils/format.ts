// Utilidades de formateo

export function formatMoney(amount: number, currency: string = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    ...options,
  };
  
  return d.toLocaleString('es-MX', defaultOptions);
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatAddress(address: any): string {
  if (!address) return '';
  
  const street = String(address?.address_street ?? '').trim();
  const ext = String(address?.ext_number ?? '').trim();
  const intn = String(address?.int_number ?? '').trim();
  const neigh = String(address?.neighborhood ?? '').trim();
  const city = String(address?.city ?? '').trim();
  const state = String(address?.state ?? '').trim();
  const zip = String(address?.zip_code ?? '').trim();

  const line1 = street
    ? `${street}${ext ? ` #${ext}` : ''}${intn ? ` Int ${intn}` : ''}`.trim()
    : '';
  const line2 = [neigh, [city, state].filter(Boolean).join(', '), zip].filter(Boolean).join('\n').trim();
  
  return [line1, line2].filter(Boolean).join('\n').trim();
}
