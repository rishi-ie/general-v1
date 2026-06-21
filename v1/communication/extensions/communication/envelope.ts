export function generateId(): string {
  const t = Date.now();
  const r = Math.random().toString(36).slice(2, 10);
  const p = Math.random().toString(36).slice(2, 6);
  return `${t.toString(36)}-${r}-${p}`;
}
