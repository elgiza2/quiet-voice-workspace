/** First-run setup: profile → what you do → create your primary bot. */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, User, Code2, Palette, GraduationCap, Briefcase, Clapperboard, HelpCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { forceDarkTheme } from "@/lib/theme";
import { AgentForm, type AgentFormValue } from "@/pages/agent/hub/HubPanels";
import { Button } from "@/components/ui/button";
import "@/styles/onboarding.css";

const TYPES = [
  { id: "developer", t: "Developer", I: Code2 },
  { id: "designer", t: "Designer", I: Palette },
  { id: "student", t: "Student", I: GraduationCap },
  { id: "business", t: "Business owner", I: Briefcase },
  { id: "creator", t: "Content creator", I: Clapperboard },
  { id: "other", t: "Something else", I: HelpCircle },
];
const AGES = Array.from({ length: 108 }, (_, i) => i + 13);
const ROW = 48;

async function toAvatar(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
  const k = Math.max(s / img.width, s / img.height), w = img.width * k, h = img.height * k;
  const context = c.getContext("2d");
  if (!context) throw new Error("Couldn't prepare your photo.");
  context.drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
  img.close();
  return c.toDataURL("image/jpeg", 0.85);
}

function AgeWheel({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  useEffect(() => { const el = ref.current; if (el) { el.scrollTop = AGES.indexOf(value) * ROW; setScrollTop(el.scrollTop); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = () => {
    const el = ref.current; if (!el) return;
    setScrollTop(el.scrollTop);
    const n = AGES[Math.round(el.scrollTop / ROW)];
    if (n && n !== value) onChange(n);
  };
  return (
    <div className="ob-wheel">
      <div className="ob-wheel-band" aria-hidden />
      <div ref={ref} className="ob-wheel-scroll" onScroll={onScroll} role="listbox" aria-label="Age">
        <div style={{ height: ROW }} />
        {AGES.map((a, i) => {
          const d = Math.min(Math.abs(i * ROW - scrollTop) / ROW, 2.5);
          return (
            <Button variant="ghost" key={a} type="button" role="option" aria-selected={a === value} className="ob-wheel-item"
              style={{ opacity: 1 - d * 0.32, transform: `scale(${1 - d * 0.1}) rotateX(${(i * ROW - scrollTop) / ROW * -18}deg)` }}
              onClick={() => ref.current?.scrollTo({ top: i * ROW, behavior: "smooth" })}>{a}</Button>
          );
        })}
        <div style={{ height: ROW }} />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const nav = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [age, setAge] = useState(22);
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => forceDarkTheme(), []);
  useEffect(() => {
    let alive = true;
    setLoading(true); setLoadError("");
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!alive) return;
        if (error) throw error;
        if (!data.user) return nav("/auth?mode=signup", { replace: true });
        const { data: p, error: profileError } = await supabase.from("profiles").select("display_name,avatar_url,onboarding_completed").eq("id", data.user.id).maybeSingle();
        if (profileError || !p) throw new Error("Profile unavailable");
        if (!alive) return;
        if (p.onboarding_completed) return nav("/", { replace: true });
        setUid(data.user.id);
        if (p.display_name) setName(p.display_name);
        if (p.avatar_url) setAvatar(p.avatar_url);
      } catch { if (alive) setLoadError("Couldn't load your account. Try again."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [nav, retry]);

  const finish = async (v: AgentFormValue) => {
    if (!uid || busy) return;
    setBusy(true); setErr("");
    try {
      const { data, error } = await supabase.rpc("complete_onboarding", {
        p_name: name.trim(), p_avatar: avatar ?? "", p_age: age, p_type: type,
        p_bot_name: v.name, p_description: v.description ?? "", p_instructions: v.prompt ?? "", p_look: (v.look ?? {}) as never,
      });
      if (error || !data) throw new Error("Setup failed");
      nav("/", { replace: true });
    } catch { setErr("Couldn't finish setup. Your changes weren't partially saved. Try again."); }
    finally { setBusy(false); }
  };

  if (loading || loadError) return <div className="ob"><main className="ob-main ob-recovery">
    <h1>Ceyo</h1>{loadError ? <p role="alert" className="ob-sub">{loadError}</p> : <div role="status" aria-label="Preparing setup" className="my-6 h-8 w-8 animate-pulse rounded-full bg-muted" />}
    {loadError && <Button variant="neutral" className="ob-btn" onClick={() => setRetry((v) => v + 1)}>Retry</Button>}
  </main></div>;

  return (
    <div className="ob" dir="ltr">
      <header className="ob-top">
        {step > 0 ? <Button variant="ghost" size="icon" className="ob-back" disabled={busy} onClick={() => setStep(step - 1)} aria-label="Back"><ArrowLeft size={20} /></Button> : <span style={{ width: 40 }} />}
        <div className="ob-dots">{[0, 1, 2].map((d) => <span key={d} className={d === step ? "on" : ""} />)}</div>
        <span style={{ width: 40 }} />
      </header>
      {step === 2 && (
        <main className="ob-main ob-bot" key={step}>
          <h1>Create your main bot</h1>
          <p className="ob-sub">Your main assistant. You can change it anytime.</p>
          <AgentForm lang="en" title="" cta="Create" busy={busy} error={err} onSubmit={(v) => void finish(v)} onCancel={() => setStep(1)} />
        </main>
      )}
      {step < 2 && <main className="ob-main" key={step}>
        {step === 0 && (
          <>
            <h1>Tell us about you</h1>
            <p className="ob-sub">So your bots know who they're helping.</p>
            <Button variant="ghost" type="button" className="ob-photo" onClick={() => file.current?.click()} aria-label="Your photo">
              {avatar ? <img src={avatar} alt="" /> : <span className="ob-initial">{name.trim()[0]?.toUpperCase() || <User size={34} />}</span>}
              <span className="ob-photo-badge"><Camera size={14} /></span>
            </Button>
            <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setAvatar(await toAvatar(f)); setErr(""); } catch { setErr("Couldn't open this photo. Choose another image."); } } }} />
            {err && <p role="alert">{err}</p>}
            <input className="ob-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={40} />
            <p className="ob-label">How old are you?</p>
            <AgeWheel value={age} onChange={setAge} />
            <Button variant="neutral" className="ob-btn" disabled={name.trim().length < 2} onClick={() => setStep(1)}>Continue</Button>
          </>
        )}
        {step === 1 && (
          <>
            <h1>What do you do?</h1>
            <p className="ob-sub">We'll tune your bots to fit you.</p>
            <div className="ob-opts">
              {TYPES.map(({ id, t, I }) => (
                <Button variant="ghost" key={id} aria-pressed={type === id} className={`ob-opt ${type === id ? "on" : ""}`} onClick={() => setType(id)}><I size={22} />{t}</Button>
              ))}
            </div>
            <Button variant="neutral" className="ob-btn" disabled={!type} onClick={() => setStep(2)}>Continue</Button>
          </>
        )}
      </main>}
    </div>
  );
}
