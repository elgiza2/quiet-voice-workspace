import { useEffect, useState } from "react";
import { Download, FileText, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function FilePreview({ id, name, content: supplied }: { id?: string; name: string; content?: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(supplied || "");
  const [error, setError] = useState("");
  const drawing = /\.(svg|html?)$/i.test(name);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setOpen(true);
    if (supplied || !id || content) return;
    setLoading(true); setError("");
    const { data, error: failure } = await supabase.from("agent_documents").select("content").eq("id", id).maybeSingle();
    if (failure || !data) setError("Could not load this file."); else setContent(data.content);
    setLoading(false);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="chat-file-preview">
    <Button variant="ghost" className="chat-file-open" onClick={() => void load()}><FileText size={20} /><span>{name}</span><Eye size={16} /></Button>
    {open && <div className="chat-file-body"><div className="chat-file-tools"><Button variant="ghost" size="icon" disabled={!content} aria-label="Download file" title="Download file" onClick={download}><Download size={17} /></Button><Button variant="ghost" size="icon" aria-label="Close preview" title="Close preview" onClick={() => setOpen(false)}><X size={17} /></Button></div>{loading ? <div className="h-8 animate-pulse bg-muted" /> : error ? <p role="alert">{error}</p> : <>{drawing && <iframe sandbox="" referrerPolicy="no-referrer" title={name} srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">${content}`} className="chat-drawing-preview" />}<pre dir="auto">{content}</pre></>}</div>}
  </div>;
}

export function AttachmentPreview({ file }: { file: File }) {
  const [url, setUrl] = useState(""); const [text, setText] = useState("");
  useEffect(() => {
    let active = true;
    if (/^(image|video)\//.test(file.type)) { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }
    if (file.size <= 100000 && /\.(txt|md|csv|json|js|ts|py|html|css|sql)$/i.test(file.name)) void file.text().then((value) => { if (active) setText(value); });
    return () => { active = false; };
  }, [file]);
  return <details className="chat-attachment"><summary>{file.name}</summary>{url ? file.type.startsWith("video/") ? <video controls src={url} /> : <img src={url} alt={file.name} /> : <pre>{text || "Preview unavailable"}</pre>}</details>;
}