/**
 * The value typed next to 「受信」: empty = no value (null), true / false = boolean, a number = number,
 * anything else = text (so text that looks like a number cannot be sent). Shared by the Web preview
 * and the Unity preview.
 */
export function parseReceiveValue(text: string): unknown {
  const raw = text.trim();
  if (raw === '') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return isNaN(Number(raw)) ? raw : Number(raw);
}
