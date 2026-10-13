// La app opera hoy en Argentina: un celular local de 10 dígitos se guarda
// como 549 + código de área + número. También se admiten números internacionales
// escritos con + y código de país.
export function normalizeCustomerPhone(input: string): string | null {
  const trimmed = input.trim()
  if (!/^[+\d\s().-]+$/.test(trimmed)) return null
  let digits = trimmed.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1)
  if (digits.length === 10) digits = `549${digits}`
  else if (digits.startsWith('54') && digits.length === 12) digits = `549${digits.slice(2)}`
  // Un número internacional distinto de Argentina debe incluir + o 00.
  else if (!digits.startsWith('549') && !trimmed.startsWith('+') && !trimmed.startsWith('00')) return null
  if (digits.startsWith('549') && digits.length !== 13) return null
  return /^\d{8,15}$/.test(digits) ? digits : null
}
