import { z } from "zod";

export const speechInput = z.object({
  text: z.string().trim().min(1).max(5000),
  voiceId: z.string().uuid(),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).default("en"),
});

export type Voice = { id: string; name: string; language: string };

export function speechText(text: string) {
  return text.replace(/```[\s\S]*?```/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\[\[speaker:[^\]]*\]\]/g, "").replace(/[#*_`>]/g, "").trim();
}