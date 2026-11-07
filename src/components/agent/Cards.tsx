/** @doc Interactive cards inside agent turns: images/videos, video proposal, question, approval, task and plan. */
import { useEffect, useRef, useState } from "react";
import { Download, FileText, Film, Lock, Check, ListTodo, ShieldCheck, Sparkles, Loader2, Circle, CheckCircle2, RotateCw } from "lucide-react";
import { agentApi, mediaStatus, AgentApiError, type AgentRequest, type MediaModelInfo } from "@/lib/agentsky/client";
import type { MediaPayload, VideoProposal } from "@/lib/agentsky/transcript";

type Lang = "en" | "ar";
const tr = (lang: Lang, en: string, ar: string) => (lang === "ar" ? ar : en);
const DONE = new Set(["COMPLETED", "SUCCEEDED", "SUCCESS", "DONE"]);
const FAIL = new Set(["FAILED", "TIMED_OUT", "CANCELLED", "ERROR"]);

function ratio(aspect?: string) {
  const [w, h] = String(aspect || "1:1").split(":").map(Number);
  return w && h ? `${w} / ${h}` : "1 / 1";
}

/* ---------------- Media ---------------- */

export function MediaCard({ media, lang, aspect }: { media: MediaPayload; lang: Lang; aspect?: string }) {
  const [status, setStatus] = useState(media.status);
  const [urls, setUrls] = useState<string[]>(media.urls ?? []);
  const [error, setError] = useState<string | null>(null);
  const pending = !DONE.has(status) && !FAIL.has(status);

  useEffect(() => {
    if (!pending) return;
    let alive = true;
    let delay = 2500;
    const tick = async () => {
      try {
        const r = await mediaStatus(media.runId, media.token);
        if (!alive) return;
        setStatus(r.status);
        if (r.urls?.length) setUrls(r.urls);
        if (r.error) setError(r.error);
        if (!DONE.has(r.status) && !FAIL.has(r.status)) t = setTimeout(tick, (delay = Math.min(delay * 1.3, 8000)));
      } catch {
        if (alive) t = setTimeout(tick, 6000);
      }
    };
    let t = setTimeout(tick, 1500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [pending, media.runId, media.token]);

  const isVideo = media.kind === "video";
  const failed = FAIL.has(status);
  const cols = urls.length > 1 ? "grid-cols-2" : "grid-cols-1";

  return (
    <div className="ag-card ag-fade-in max-w-[520px]">
      {failed ? (
        <div className="ag-media p-8 text-center text-sm text-[color:var(--ag-muted)]" style={{ aspectRatio: "16 / 9" }}>
          {error || tr(lang, "This one didn't work. Ask me to try again.", "دي معرفتش تخلص. اطلب مني أجرب تاني.")}
        </div>
      ) : pending || !urls.length ? (
        <div className="ag-media overflow-hidden" style={{ aspectRatio: ratio(aspect) }}>
          <div className="ag-media__glow ag-gradient" />
          <div className="ag-media__shine" />
          {/* Skeleton shimmer + staged progress while the run executes */}
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/10 via-transparent to-black/20" />
          <div className="relative flex w-full max-w-[280px] flex-col items-center gap-3 px-6 text-sm font-medium">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-black/45 text-white backdrop-blur">
              {isVideo ? <Film size={20} /> : <Sparkles size={20} />}
            </span>
            <p className="text-center leading-snug">
              {isVideo ? tr(lang, "Making your video…", "بعمل الفيديو…") : tr(lang, "Making your image…", "بعمل الصورة…")}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
              <div className="ag-media__progress h-full w-1/3 rounded-full bg-white/85" />
            </div>
            <p className="line-clamp-2 text-center text-[12px] font-normal opacity-75">{media.prompt}</p>
          </div>
        </div>
      ) : (
        <div className={`grid ${cols} gap-[2px]`}>
          {urls.map((u, i) => (
            <div key={u} className="ag-media group" style={{ aspectRatio: ratio(aspect) }}>
              {isVideo ? <video src={u} controls playsInline loop /> : <img src={u} alt={media.prompt} loading="lazy" />}
              <a
                href={u}
                download={`megsy-${media.runId}-${i}.${isVideo ? "mp4" : "png"}`}
                target="_blank"
                rel="noreferrer"
                className="absolute end-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 focus:opacity-100"
                aria-label={tr(lang, "Download", "تحميل")}
              >
                <Download size={16} />
              </a>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 px-3.5 py-2.5 text-[12.5px] text-[color:var(--ag-muted)]">
        {isVideo ? <Film size={13} /> : <Sparkles size={13} />}
        <span className="truncate">{media.prompt}</span>
      </div>
    </div>
  );
}

/* ---------------- Video proposal ---------------- */

export function VideoProposalCard({
  proposal,
  models,
  tier,
  lang,
  onUpgrade,
}: {
  proposal: VideoProposal;
  models: MediaModelInfo[];
  tier: "free" | "pro";
  lang: Lang;
  onUpgrade: () => void;
}) {
  const videoModels = models.filter((m) => m.kind === "video");
  const [model, setModel] = useState(videoModels.find((m) => !m.locked)?.id ?? videoModels[0]?.id);
  const [duration, setDuration] = useState(proposal.duration || 5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<MediaPayload | null>(null);
  const key = useRef(crypto.randomUUID());

  if (started) return <MediaCard media={started} lang={lang} aspect={proposal.aspect} />;
  const chosen = videoModels.find((m) => m.id === model);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await agentApi.media({ kind: "video", prompt: proposal.prompt, aspect: proposal.aspect, duration, model, idempotencyKey: key.current });
      setStarted({ type: "megsy.media", kind: "video", runId: r.runId, token: r.token, status: r.status, urls: [], model: r.model, prompt: proposal.prompt });
    } catch (e) {
      const code = e instanceof AgentApiError ? e.code : "";
      setError(
        code === "free_limit"
          ? tr(lang, "You've used today's free video. Upgrade for more.", "خلصت الفيديو المجاني النهارده. اشترك عشان تعمل أكتر.")
          : code === "upgrade_required"
            ? tr(lang, "This model is for subscribers.", "النموذج ده للمشتركين.")
            : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ag-card ag-fade-in max-w-[520px]">
      <div className="ag-card__head">
        <span className="ag-gradient grid h-8 w-8 place-items-center rounded-xl text-white">
          <Film size={15} />
        </span>
        {tr(lang, "Ready to make this video", "جاهز أعمل الفيديو ده")}
      </div>
      <div className="ag-card__body space-y-3">
        <p className="rounded-2xl bg-[color:var(--ag-soft)] p-3 leading-relaxed">{proposal.prompt}</p>
        <div className="flex flex-wrap gap-2">
          {videoModels.map((m) => (
            <button
              key={m.id}
              type="button"
              className="ag-chip"
              data-selected={m.id === model}
              onClick={() => (m.locked ? onUpgrade() : setModel(m.id))}
            >
              {m.locked && <Lock size={12} />}
              {m.label}
              {m.tier === "free" && <span className="text-[11px] text-[color:var(--ag-muted)]">{tr(lang, "Free", "مجاني")}</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-[color:var(--ag-muted)]">{tr(lang, "Length", "المدة")}</span>
          {[5, 10].map((d) => (
            <button
              key={d}
              type="button"
              className="ag-chip !py-1.5"
              data-selected={d === duration}
              disabled={d > 5 && (tier === "free" || chosen?.tier === "free")}
              onClick={() => setDuration(d)}
            >
              {d}s
            </button>
          ))}
          <span className="ms-auto text-[color:var(--ag-muted)]">{proposal.aspect}</span>
        </div>
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[color:var(--ag-soft)] p-3 text-[13px]">
            <span>{error}</span>
            {tier === "free" && (
              <button type="button" className="ag-btn ag-btn--agent !h-8 !px-3 !text-[13px]" onClick={onUpgrade}>
                {tr(lang, "Upgrade", "اشترك")}
              </button>
            )}
          </div>
        )}
        <button type="button" className="ag-btn ag-btn--agent w-full" disabled={busy || !model} onClick={go}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {tr(lang, "Make video", "اعمل الفيديو")}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Question ---------------- */

export function QuestionCard({
  question,
  options,
  allowFreeText,
  answered,
  lang,
  onAnswer,
}: {
  question: string;
  options: string[];
  allowFreeText: boolean;
  answered: boolean;
  lang: Lang;
  onAnswer: (text: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState("");
  const done = answered || !!picked;
  const send = (v: string) => {
    if (!v.trim() || done) return;
    setPicked(v);
    onAnswer(v.trim());
  };
  return (
    <div className="ag-card ag-fade-in max-w-[560px]" data-done={done}>
      <div className="ag-card__head">{question}</div>
      <div className="ag-card__body space-y-2.5">
        {options.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <button key={o} type="button" className="ag-chip" disabled={done} data-selected={picked === o} onClick={() => send(o)}>
                {picked === o && <Check size={13} />}
                {o}
              </button>
            ))}
          </div>
        )}
        {(allowFreeText || !options.length) && !done && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <input className="ag-input !py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder={tr(lang, "Type your answer", "اكتب إجابتك")} />
            <button className="ag-btn ag-btn--primary" disabled={!text.trim()}>
              {tr(lang, "Send", "ابعت")}
            </button>
          </form>
        )}
        {done && <p className="text-[12.5px] text-[color:var(--ag-muted)]">{tr(lang, "Answered", "اتجاوب")}</p>}
      </div>
    </div>
  );
}

/* ---------------- Approval (AgentSky request) ---------------- */

export function ApprovalCard({ request, lang, onAnswer }: { request: AgentRequest; lang: Lang; onAnswer: (text: string) => void }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const opts = request.options?.length
    ? request.options
    : [
        { id: "approve", label: tr(lang, "Approve", "موافق") },
        { id: "deny", label: tr(lang, "Don't", "لأ") },
      ];
  return (
    <div className="ag-card ag-fade-in max-w-[560px]">
      <div className="ag-card__head">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[color:var(--ag-soft)]">
          <ShieldCheck size={16} />
        </span>
        <div className="min-w-0">
          <div>{request.kind === "approval" ? tr(lang, "Needs your OK", "محتاج موافقتك") : tr(lang, "Quick question", "سؤال سريع")}</div>
          {request.subject && <div className="truncate text-[12.5px] font-normal text-[color:var(--ag-muted)]">{request.subject}</div>}
        </div>
      </div>
      <div className="ag-card__body space-y-3">
        <p className="leading-relaxed">{request.question}</p>
        <div className="flex flex-wrap gap-2">
          {opts.map((o, i) => (
            <button
              key={o.id}
              type="button"
              disabled={!!chosen}
              className={`ag-btn ${i === 0 ? "ag-btn--primary" : "ag-btn--ghost"}`}
              onClick={() => {
                setChosen(o.id);
                onAnswer(o.label);
              }}
            >
              {chosen === o.id && <Check size={15} />}
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Task + plan ---------------- */

export function TaskCard({ title, dueAt, lang, onOpen }: { title: string; dueAt: string | null; lang: Lang; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="ag-card ag-fade-in flex w-full max-w-[420px] items-center gap-3 p-3 text-start">
      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[color:var(--ag-soft)]">
        <ListTodo size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block text-[12.5px] text-[color:var(--ag-muted)]">
          {dueAt ? new Date(dueAt).toLocaleString(lang === "ar" ? "ar-EG" : undefined, { dateStyle: "medium", timeStyle: "short" }) : tr(lang, "Added to your tasks", "اتضافت لمهامك")}
        </span>
      </span>
    </button>
  );
}

export function PlanCard({ title, steps, lang }: { title: string; steps: { title: string; status: string }[]; lang: Lang }) {
  const done = steps.filter((s) => s.status === "done").length;
  return (
    <div className="ag-card ag-fade-in max-w-[560px]">
      <div className="ag-card__head justify-between">
        <span className="truncate">{title || tr(lang, "Plan", "الخطة")}</span>
        <span className="text-[12.5px] font-normal text-[color:var(--ag-muted)]">
          {done}/{steps.length}
        </span>
      </div>
      <div className="ag-card__body space-y-1.5">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-2.5 text-[13.5px]">
            {s.status === "done" ? (
              <CheckCircle2 size={16} className="mt-0.5 flex-none text-[color:var(--ag-c1)]" />
            ) : s.status === "in_progress" ? (
              <RotateCw size={16} className="mt-0.5 flex-none animate-spin [animation-duration:2.5s]" />
            ) : (
              <Circle size={16} className="mt-0.5 flex-none text-[color:var(--ag-muted)]" />
            )}
            <span className={s.status === "done" ? "text-[color:var(--ag-muted)] line-through" : ""}>{s.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Files ---------------- */

function formatSize(n?: number) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FileCard({ name, url, content, mime, size, lang }: { name: string; url?: string; content?: string; mime?: string; size?: number; lang: Lang }) {
  const ext = (name.split(".").pop() || "file").slice(0, 4).toUpperCase();
  const download = () => {
    if (url) {
      window.open(url, "_blank", "noopener");
      return;
    }
    const blob = new Blob([content ?? ""], { type: mime || "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };
  return (
    <button type="button" onClick={download} className="ag-file ag-fade-in" title={tr(lang, "Download", "تحميل")}>
      <span className="ag-file__icon"><FileText size={16} /><span className="ag-file__ext">{ext}</span></span>
      <span className="min-w-0 flex-1 text-start">
        <span className="block truncate text-[13.5px] font-medium">{name}</span>
        <span className="block text-[12px] text-[color:var(--ag-muted)]">{formatSize(size) || tr(lang, "File", "ملف")}</span>
      </span>
      <Download size={15} className="flex-none text-[color:var(--ag-muted)]" />
    </button>
  );
}
