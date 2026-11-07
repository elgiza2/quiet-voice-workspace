/** Browser/server-safe media routing; no provider catalogue imports. */
export function detectMediaIntent(text: string): "image" | "video" | null {
  if (/(?:بلاش|بدون|من غير|don't|do not)\s*(?:صور|فيديو|image|video)/i.test(text)) return null;
  const verb = /(?:اعمل|اعملي|ارسم|صمم|ولد|ولّد|انشئ|أنشئ|عايز|عاوز|محتاج|سوي|create|generate|make|draw|design|render|animate)/i;
  if (!verb.test(text)) return null;
  if (/(?:فيديو|كليب|ريلز|\bvideo\b|\bclip\b|\banimation\b)/i.test(text)) return "video";
  if (/(?:صورة|صوره|صور|بوستر|لوجو|شعار|رسمة|\bimage\b|\bphoto\b|\bpicture\b|\bposter\b|\blogo\b)/i.test(text)) return "image";
  return null;
}
