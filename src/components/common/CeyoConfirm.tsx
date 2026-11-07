import { useEffect, useState } from "react";

type Req = {
  title: string;
  body?: string;
  confirm: string;
  cancel?: string;
  danger?: boolean;
  input?: { placeholder?: string; value?: string };
  resolve: (v: string | null) => void;
};

let push: ((r: Req) => void) | null = null;

function open(r: Omit<Req, "resolve">) {
  return new Promise<string | null>((resolve) => {
    if (!push) return resolve(null);
    push({ ...r, resolve });
  });
}

/** Clean bottom card asking the user to confirm. Resolves true on confirm. */
export async function askConfirm(o: { title: string; body?: string; confirm: string; cancel?: string; danger?: boolean }) {
  return (await open(o)) !== null;
}

/** Bottom card with one text field. Resolves the trimmed text or null. */
export async function askText(o: { title: string; body?: string; confirm: string; cancel?: string; placeholder?: string; value?: string }) {
  const v = await open({ ...o, input: { placeholder: o.placeholder, value: o.value } });
  return v?.trim() || null;
}

export function CeyoConfirmHost() {
  const [req, setReq] = useState<Req | null>(null);
  const [text, setText] = useState("");
  useEffect(() => {
    push = (r) => { setText(r.input?.value || ""); setReq(r); };
    return () => { push = null; };
  }, []);
  if (!req) return null;
  const done = (v: string | null) => { req.resolve(v); setReq(null); };
  const ar = document.documentElement.dir === "rtl";
  return (
    <div className="cc-root" dir="auto">
      <div className="cc-scrim" onPointerDown={() => done(null)} />
      <div className="cc-card" role="alertdialog" aria-label={req.title}>
        <span className="cc-grip" />
        <h3>{req.title}</h3>
        {req.body && <p>{req.body}</p>}
        {req.input && (
          <input autoFocus className="cc-input" value={text} placeholder={req.input.placeholder} maxLength={40}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) done(text); }} />
        )}
        <button type="button" className={req.danger ? "cc-btn cc-danger" : "cc-btn cc-primary"} disabled={!!req.input && !text.trim()} onClick={() => done(req.input ? text : "ok")}>{req.confirm}</button>
        <button type="button" className="cc-btn cc-cancel" onClick={() => done(null)}>{req.cancel || (ar ? "إلغاء" : "Cancel")}</button>
      </div>
    </div>
  );
}
