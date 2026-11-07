import { useEffect, useState } from "react";
import { Download, Trash2, Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ResourceList({ kind, query = "", botId }: { kind: "files" | "routines"; query?: string; botId?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const table = kind === "files" ? "agent_documents" : "agent_routines";
  const refresh = async () => {
    const db = supabase as any;
    let request = db.from(table).select("*").order("created_at", { ascending: false }).limit(100);
    if (kind === "routines" && botId) {
      const { data, error: convError } = await db.from("conversations").select("id").eq("bot_id", botId);
      if (convError) { setError(convError.message); setLoading(false); return; }
      request = request.in("conversation_id", (data || []).map((c: any) => c.id));
    }
    const { data, error: readError } = await request;
    setRows(data || []); setError(readError?.message || ""); setLoading(false);
  };
  useEffect(() => { void refresh(); }, [kind, botId]);
  const remove = async (id: string) => {
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) toast.error(error.message); else await refresh();
  };
  const download = (row: any) => {
    const url = URL.createObjectURL(new Blob([row.content], { type: row.mime || "text/plain" }));
    const link = document.createElement("a"); link.href = url; link.download = row.name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (loading) return <p className="p-4 text-muted-foreground" role="status">Loading…</p>;
  if (error) return <p className="p-4 text-destructive" role="alert">{error}</p>;
  const shown = rows.filter((r) => `${r.name || r.title} ${r.goal || ""}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="px-4">{!shown.length && <p className="py-8 text-muted-foreground">{kind === "files" ? "No saved files" : "No routines"}</p>}{shown.map((row) => <div key={row.id} className="flex items-start gap-2 border-b border-border py-3">
    <div className="min-w-0 flex-1"><strong className="block break-words">{row.name || row.title}</strong>{kind === "routines" && <><p className="text-sm text-muted-foreground break-words">{row.goal}</p><small>{row.active ? `Next: ${new Date(row.next_run_at).toLocaleString()}` : "Paused"}</small>{row.last_error && <p className="text-sm text-destructive">{row.last_error}</p>}</>}</div>
    {kind === "files" ? <Button variant="ghost" size="icon-sm" aria-label={`Download ${row.name}`} onClick={() => download(row)}><Download /></Button> : <Button variant="ghost" size="icon-sm" aria-label={row.active ? `Pause ${row.title}` : `Resume ${row.title}`} onClick={async () => { const { error } = await supabase.from("agent_routines").update({ active: !row.active }).eq("id", row.id); if (error) toast.error(error.message); else await refresh(); }}>{row.active ? <Pause /> : <Play />}</Button>}
    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${row.name || row.title}`} onClick={() => void remove(row.id)}><Trash2 /></Button>
  </div>)}</div>;
}