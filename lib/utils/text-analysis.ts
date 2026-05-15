
/**
 * Detecta si un texto contiene información de contacto (email, teléfono, dirección, url).
 * Útil para moderación de preguntas y respuestas.
 */
export function containsContactInfo(text: string): { detected: boolean; reason?: string } {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\b[a-z0-9]+\.(com|mx|net|org|edu|gov)\b)/i;
  // Teléfono: 10 dígitos o más, permitiendo espacios, puntos o guiones
  const phoneRegex = /\b(?:\d[\s.-]*){10,}\b/;
  // Dirección: palabras clave seguidas de números
  const addressRegex = /\b(calle|av\.|avenida|col\.|colonia|domicilio|direcci[oó]n|cp|c\.p\.|código postal)\s+.*\d+/i;
  
  if (emailRegex.test(text)) return { detected: true, reason: 'correo electrónico' };
  if (urlRegex.test(text)) return { detected: true, reason: 'enlaces web' };
  if (phoneRegex.test(text)) return { detected: true, reason: 'número de teléfono' };
  if (addressRegex.test(text)) return { detected: true, reason: 'dirección o datos de contacto' };
  
  return { detected: false };
}
