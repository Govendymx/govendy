// Utilidades de validación

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function validateRequired(value: any, fieldName: string): void {
  if (value === null || value === undefined || value === '') {
    throw new Error(`${fieldName} es requerido`);
  }
}

export function validatePositiveNumber(value: number, fieldName: string): void {
  if (typeof value !== 'number' || value <= 0 || !Number.isFinite(value)) {
    throw new Error(`${fieldName} debe ser un número positivo`);
  }
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function containsContactInfo(text: string): { detected: boolean; reason?: string } {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\b[a-z0-9]+\.(com|mx|net|org|edu|gov)\b)/i;
  // Detectar 10+ dígitos (pueden tener separadores)
  const phoneRegex = /\b(?:\d[\s.-]*){10,}\b/;
  // Detectar 10+ palabras de números seguidas (ej: "uno dos tres...")
  const phoneWordsRegex = /(?:\b(?:cero|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b[\s.,-]*){10,}/i;
  const addressRegex = /\b(calle|av\.|avenida|col\.|colonia|domicilio|direcci[oó]n|cp|c\.p\.|código postal)\s+.*\d+/i;
  
  if (emailRegex.test(text)) return { detected: true, reason: 'correo electrónico' };
  if (urlRegex.test(text)) return { detected: true, reason: 'enlaces web' };
  if (phoneRegex.test(text)) return { detected: true, reason: 'número de teléfono' };
  if (phoneWordsRegex.test(text)) return { detected: true, reason: 'número de teléfono (escrito)' };
  if (addressRegex.test(text)) return { detected: true, reason: 'dirección o datos de contacto' };
  
  return { detected: false };
}
