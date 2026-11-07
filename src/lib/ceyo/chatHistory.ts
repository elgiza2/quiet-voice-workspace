/** Storage/display speaker markers must never become model instructions. */
export function normalizeChatHistory(rows: { role: string; content: string; metadata?: unknown }[]) {
  return [...rows].reverse().filter((row) => {
    const meta = row.metadata as { incomplete?: boolean } | null;
    return row.content && !meta?.incomplete && ["user", "assistant"].includes(row.role);
  }).map((row) => ({ role: row.role, content: row.role === "assistant" ? row.content.replace(/\[\[speaker:[^\]]*\]\]/g, "").trim() : row.content }));
}