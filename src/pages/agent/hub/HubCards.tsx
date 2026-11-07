import { useMemo, useState } from "react";
import { ArrowUp, Check, KeyRound } from "lucide-react";
import { IntegrationLogo } from "@/components/chat/integrations/IntegrationRow";
import { integrations, type Integration } from "@/lib/integrationsData";

type Ar = boolean;

/* ---------- Connect app card: "Let Ceyo access your repos" + Authorize ---------- */

export type ConnectApp = { id?: string; name: string; description?: string; domain?: string; connected?: boolean };

const findIntegration = (a: ConnectApp): Integration => {
  const key = (a.id || a.name || "").toLowerCase().replace(/[\s_-]+/g, "");
  const hit = integrations.find((i) => [i.id, i.app, i.name].some((v) => (v || "").toLowerCase().replace(/[\s_-]+/g, "") === key));
  return hit ?? ({ id: key, name: a.name, app: key, domain: a.domain || `${key}.com`, description: a.description || "" } as unknown as Integration);
};

/** Accepts the many shapes the agent may send: {apps:[…]}, {app}, {service}, {name}. */
export function readConnectApps(data: Record<string, any>): ConnectApp[] {
  const list = Array.isArray(data.apps) ? data.apps : Array.isArray(data.services) ? data.services : [data];
  return list
    .map((x: any) => (typeof x === "string" ? { name: x } : { id: x.id || x.app || x.slug, name: x.name || x.app || x.service || x.title, description: x.description || x.reason || x.summary, domain: x.domain, connected: !!x.connected }))
    .filter((x: ConnectApp) => !!x.name);
}

export function ConnectAppsCard({ apps, title, ar, onAuthorize }: { apps: ConnectApp[]; title?: string; ar: Ar; onAuthorize: (app: ConnectApp) => void }) {
  if (!apps.length) return null;
  return (
    <div className="cx-card">
      {title && <div className="cx-card-title" dir="auto">{title}</div>}
      {apps.map((a, i) => {
        const item = findIntegration(a);
        return (
          <div className="cx-app-row" key={(a.id || a.name) + i}>
            <span className="cx-app-logo"><IntegrationLogo item={item} size={36} /></span>
            <span className="cx-app-text">
              <b dir="auto">{a.name}</b>
              <small dir="auto">{a.description || (item as any).description || (ar ? "اربطه علشان البوت يقدر يستخدمه" : "Connect so your bot can use it")}</small>
            </span>
            {a.connected ? (
              <span className="cx-app-done"><Check size={15} />{ar ? "متصل" : "Connected"}</span>
            ) : (
              <button type="button" className="cx-pill-btn" onClick={() => onAuthorize(a)}>{ar ? "ربط" : "Authorize"}</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Secret / key request ---------- */

export function SecretCard({ name, ar, onOpen }: { name: string; ar: Ar; onOpen: () => void }) {
  return (
    <div className="cx-card">
      <div className="cx-app-row">
        <span className="cx-app-logo cx-app-key"><KeyRound size={18} /></span>
        <span className="cx-app-text"><b dir="auto">{name}</b><small>{ar ? "محتاج المفتاح ده علشان يكمل" : "Needed to continue"}</small></span>
        <button type="button" className="cx-pill-btn" onClick={onOpen}>{ar ? "إضافة" : "Add"}</button>
      </div>
    </div>
  );
}

/* ---------- Question card: options as rows + "something else" free text ---------- */

export function ChoiceCard({ question, options, allowFreeText = true, answered, ar, onAnswer }: {
  question?: string; options: string[]; allowFreeText?: boolean; answered?: boolean; ar: Ar; onAnswer: (v: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const done = !!answered || !!picked;
  const opts = useMemo(() => options.filter(Boolean).slice(0, 8), [options]);
  const send = (v: string) => { const t = v.trim(); if (!t || done) return; setPicked(t); onAnswer(t); };
  return (
    <div className="cx-card" data-done={done}>
      {question && <div className="cx-card-title" dir="auto">{question}</div>}
      <div className="cx-choices">
        {opts.map((o, i) => (
          <button key={o + i} type="button" className="cx-choice" disabled={done} data-picked={picked === o} onClick={() => send(o)}>
            <span className="cx-choice-n">{i + 1}</span>
            <span dir="auto" className="cx-choice-label">{o}</span>
            {picked === o && <Check size={16} />}
          </button>
        ))}
        {(allowFreeText || !opts.length) && !done && (typing || !opts.length ? (
          <form className="cx-choice-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input autoFocus={opts.length > 0} dir="auto" value={text} onChange={(e) => setText(e.target.value)} placeholder={ar ? "اكتب اللي عايزه…" : "Type your answer…"} />
            <button type="submit" disabled={!text.trim()} aria-label={ar ? "إرسال" : "Send"}><ArrowUp size={16} /></button>
          </form>
        ) : (
          <button type="button" className="cx-choice cx-choice-other" onClick={() => setTyping(true)}>
            <span dir="auto" className="cx-choice-label">{ar ? "حاجة تانية…" : "Something else…"}</span>
          </button>
        ))}
        {picked && !opts.includes(picked) && <div className="cx-choice cx-choice-free" data-picked="true"><span dir="auto" className="cx-choice-label">{picked}</span><Check size={16} /></div>}
      </div>
    </div>
  );
}
