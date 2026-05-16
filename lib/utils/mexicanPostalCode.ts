/**
 * Normaliza un código postal mexicano a exactamente 5 dígitos ASCII (0-9).
 * Acepta dígitos de ancho completo (Unicode) y descarta separadores/espacios.
 */
export function normalizeMexicanCp(raw: string): string | null {
  const digits = String(raw ?? '')
    .trim()
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 48))
    .replace(/\D/g, '')
    .slice(0, 5);
  return digits.length === 5 ? digits : null;
}
