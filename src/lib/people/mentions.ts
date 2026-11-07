/** Bots that a message addresses with @Name (case-insensitive, Arabic names supported). */
export function mentionedBots<T extends { name: string }>(text: string, bots: T[]): T[] {
  const lower = text.toLowerCase();
  return bots.filter((b) => lower.includes(`@${b.name.toLowerCase()}`));
}
