/** Permanent per-user workspace (server-only).
 *  Files persist across sessions in the `agent-workspace` storage bucket,
 *  namespaced by user id. Safe paths only (no .., no absolute). */
const BUCKET = "agent-workspace";
const MAX_FILE = 25 * 1024 * 1024;

function cleanPath(raw: string): string | null {
  const clean = String(raw || "")
    .trim()
    .replace(/^[./\\]+/, "")
    .replace(/\\/g, "/");
  if (!clean || clean.includes("..") || clean.startsWith("/") || clean.length > 200) return null;
  if (!/^[\w.\- /]+$/.test(clean)) return null;
  return clean;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function saveWorkspaceFile(
  userId: string,
  rawPath: string,
  content?: unknown,
  contentBase64?: unknown,
  mimeType?: unknown,
): Promise<{
  ok: boolean;
  error?: string;
  path?: string;
  name?: string;
  url?: string;
  mime?: string;
  size?: number;
}> {
  const clean = cleanPath(rawPath);
  if (!clean) return { ok: false, error: "Invalid path. Use e.g. reports/summary.md" };
  const bytes: Uint8Array = contentBase64
    ? Uint8Array.from(atob(String(contentBase64)), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(String(content ?? ""));
  if (!bytes.length) return { ok: false, error: "The file is empty; nothing was saved." };
  if (bytes.length > MAX_FILE) return { ok: false, error: "File larger than 25 MB; split it." };
  const mime = String(mimeType || "application/octet-stream").slice(0, 100);
  try {
    const db = await admin();
    const path = `${userId}/${clean}`;
    const up = await db.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (up.error) {
      // Bucket may not exist yet: fall back to agent-files so nothing is lost.
      const fb = await db.storage
        .from("agent-files")
        .upload(path, bytes, { contentType: mime, upsert: true });
      if (fb.error) return { ok: false, error: `Could not save: ${fb.error.message}` };
      const signed = await db.storage.from("agent-files").createSignedUrl(path, 60 * 60 * 24 * 365);
      const name = clean.split("/").pop() || "file";
      return { ok: true, path: clean, name, url: signed.data?.signedUrl, mime, size: bytes.length };
    }
    const signed = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signed.error || !signed.data)
      return { ok: false, error: "Could not create a download link." };
    const name = clean.split("/").pop() || "file";
    return { ok: true, path: clean, name, url: signed.data.signedUrl, mime, size: bytes.length };
  } catch (e: any) {
    return { ok: false, error: `Could not save: ${String(e?.message || e).slice(0, 200)}` };
  }
}

export async function readWorkspaceFile(
  userId: string,
  rawPath: string,
): Promise<{ ok: boolean; error?: string; path?: string; content?: string }> {
  const clean = cleanPath(rawPath);
  if (!clean) return { ok: false, error: "Invalid path." };
  try {
    const db = await admin();
    for (const bucket of [BUCKET, "agent-files"]) {
      const dl = await db.storage.from(bucket).download(`${userId}/${clean}`);
      if (!dl.error && dl.data) {
        const text = await dl.data.text().catch(() => null);
        if (text === null)
          return { ok: false, error: "Binary file — use the download link from save." };
        if (text.length > 30_000)
          return { ok: true, path: clean, content: text.slice(0, 30_000) + "\n…[truncated]" };
        return { ok: true, path: clean, content: text };
      }
    }
    return {
      ok: false,
      error: `No such file: ${clean}. Use list_workspace_files to see what exists.`,
    };
  } catch (e: any) {
    return { ok: false, error: `Could not read: ${String(e?.message || e).slice(0, 200)}` };
  }
}

export async function listWorkspaceFiles(
  userId: string,
  prefix = "",
): Promise<{ ok: boolean; error?: string; files: string[] }> {
  const cleanPrefix = String(prefix || "")
    .replace(/^[./\\]+/, "")
    .replace(/\\/g, "/")
    .replace(/\.\./g, "");
  try {
    const db = await admin();
    const seen = new Set<string>();
    for (const bucket of [BUCKET, "agent-files"]) {
      const ls = await db.storage.from(bucket).list(userId, { limit: 100 });
      if (!ls.error && Array.isArray(ls.data)) {
        for (const item of ls.data) {
          const name = String((item as any)?.name || "");
          if (name && (!cleanPrefix || name.startsWith(cleanPrefix))) seen.add(name);
        }
      }
    }
    return { ok: true, files: [...seen].sort().slice(0, 100) };
  } catch (e: any) {
    return {
      ok: false,
      error: `Could not list: ${String(e?.message || e).slice(0, 200)}`,
      files: [],
    };
  }
}
