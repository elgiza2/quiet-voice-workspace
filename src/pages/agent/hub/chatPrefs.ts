// Device-local chat extras: message reactions and custom group avatars.
export const REACTIONS = ["👍", "👎", "❤️", "😂", "🎉", "😮", "🔥", "👀", "🙏", "😢", "💯"];

const REACTIONS_KEY = "ceyo_reactions_v1";
const AVATAR_KEY = (id: string) => `ceyo_group_avatar_${id}`;

export function readReactions(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(REACTIONS_KEY) || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function writeReactions(v: Record<string, string>) {
  try { localStorage.setItem(REACTIONS_KEY, JSON.stringify(v)); } catch { /* storage full */ }
}

export function readGroupAvatar(id: string): string | null {
  try { return localStorage.getItem(AVATAR_KEY(id)); } catch { return null; }
}

export function writeGroupAvatar(id: string, dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(AVATAR_KEY(id), dataUrl);
    else localStorage.removeItem(AVATAR_KEY(id));
    window.dispatchEvent(new Event("ceyo-group-avatar"));
  } catch { /* storage full */ }
}

/** Shrinks an image file to a small square data URL so it fits device storage. */
export function fileToAvatar(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 25 * 1024 * 1024) return reject(new Error("Images up to 25 MB."));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d")!;
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image.")); };
    img.src = url;
  });
}
