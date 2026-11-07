import { z } from "zod";

export const documentInput = z.object({ name: z.string().trim().min(1).max(200), mime: z.string().max(150), content: z.string().min(1).max(100000) });
export const routineInput = z.object({ title: z.string().trim().min(1).max(100), goal: z.string().trim().min(1).max(4000), interval_hours: z.union([z.literal(24), z.literal(168)]) });
export function nextRoutineRun(hours: number, from = new Date()) {
  if (hours !== 24 && hours !== 168) throw new Error("Choose daily or weekly");
  return new Date(from.getTime() + hours * 3600000).toISOString();
}
export function validateVaultDetail(kind: string, detail: string) {
  if (kind === "card" && !/^\d{4}$/.test(detail.trim())) throw new Error("Enter only the last 4 digits, never the full card number or security code");
  return detail.trim();
}
export async function readTextAttachment(file: File) {
  if (file.size > 100000) throw new Error(`${file.name}: maximum text file size is 100 KB`);
  if (!/\.(txt|md|csv|json|js|ts|tsx|jsx|py|html|css|xml|yaml|yml|log|sql)$/i.test(file.name)) throw new Error(`${file.name}: use a text, code, CSV or JSON file; image, video and PDF analysis is not connected`);
  const parsed = documentInput.parse({ name: file.name, mime: file.type || "text/plain", content: await file.text() });
  if (!parsed.name || !parsed.mime || !parsed.content) throw new Error("Empty document");
  return { name: parsed.name, mime: parsed.mime, content: parsed.content };
}