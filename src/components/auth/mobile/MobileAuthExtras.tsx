/** @doc Mobile auth extra screens (OTP, set/reset password, forgot) — clean black Ceyo layout. */
import { ArrowLeft, Eye, EyeOff, Mail } from "lucide-react";
import { useRef } from "react";
import "@/styles/auth-extras.css";
import { t as authT, tf as authTf, useUserLang } from "@/lib/authI18n";

type ExtraScreen = "otp-signup" | "otp-2fa" | "otp-reset" | "set-password" | "reset-password" | "forgot-password";

interface Props {
  screen: ExtraScreen;
  email: string;
  otpValues: string[];
  onOtpChange: (i: number, v: string) => void;
  onOtpKeyDown: (i: number, e: React.KeyboardEvent) => void;
  onOtpPaste: (e: React.ClipboardEvent<HTMLInputElement>, i: number) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  showNewPassword: boolean;
  setShowNewPassword: (v: boolean) => void;
  isSubmitting: boolean;
  countdown: number;
  onResendOtp: () => void;
  onSubmitSetPassword: () => void;
  region?: "arab" | "global";
  setRegion?: (r: "arab" | "global") => void;
  onSubmitResetPassword: () => void;
  onSubmitForgotPassword: () => void;
  onBack: () => void;
}

const meta = (s: ExtraScreen) => {
  switch (s) {
    case "otp-signup": return { title: authT("verifyEmailTitle"), sub: (e: string) => authTf("otpSubTemplate", { email: e }), cta: authT("createAccount") };
    case "otp-2fa": return { title: authT("twoFATitle"), sub: (e: string) => authTf("otp2faSubTemplate", { email: e }), cta: authT("signIn") };
    case "otp-reset": return { title: authT("verifyEmailTitle"), sub: (e: string) => authTf("otp2faSubTemplate", { email: e }), cta: authT("resetPassword") };
    case "set-password": return { title: authT("setPasswordTitle"), sub: () => authT("atLeast8"), cta: authT("createAccount") };
    case "reset-password": return { title: authT("chooseNewPasswordTitle"), sub: () => authT("atLeast8"), cta: authT("resetPassword") };
    case "forgot-password": return { title: authT("forgotTitle"), sub: (e: string) => authTf("forgotSubTemplate", { email: e }), cta: authT("sendResetCode") };
  }
};

export default function MobileAuthExtras(p: Props) {
  useUserLang();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const m = meta(p.screen);
  const isOtp = p.screen.startsWith("otp-");
  const isPwd = p.screen === "set-password" || p.screen === "reset-password";
  const ready = isPwd ? p.newPassword.trim().length >= 8 : true;
  const submit = () => {
    if (p.screen === "set-password") p.onSubmitSetPassword();
    else if (p.screen === "reset-password") p.onSubmitResetPassword();
    else if (p.screen === "forgot-password") p.onSubmitForgotPassword();
  };

  return (
    <main className="ceyo-auth" dir="ltr">
      <header className="ceyo-auth-top">
        <button type="button" className="ceyo-auth-back" onClick={p.onBack} aria-label={authT("back")}><ArrowLeft size={20} /></button>
        <span className="ceyo-auth-brand">Ceyo</span>
        <span style={{ width: 40 }} />
      </header>

      <section className="ceyo-auth-body">
        <div className="ceyo-auth-icon"><Mail size={22} /></div>
        <h1>{m.title}</h1>
        <p>{m.sub(p.email)}</p>

        <form onSubmit={(e) => { e.preventDefault(); if (!isOtp) submit(); }} className="ceyo-auth-form">
          {isOtp && (
            <div className="ceyo-otp">
              {p.otpValues.map((v, i) => (
                <input
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code"
                  name={i === 0 ? "otp" : `otp-${i}`}
                  maxLength={i === 0 ? 6 : 1}
                  value={v}
                  aria-label={`Digit ${i + 1}`}
                  className={v ? "filled" : ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    if (raw.length > 1) {
                      p.onOtpPaste({ preventDefault() {}, stopPropagation() {}, clipboardData: { getData: () => raw } } as unknown as React.ClipboardEvent<HTMLInputElement>, i);
                      return;
                    }
                    p.onOtpChange(i, raw);
                    if (raw && i < 5) refs.current[i + 1]?.focus();
                  }}
                  onKeyDown={(e) => {
                    p.onOtpKeyDown(i, e);
                    if (e.key === "Backspace" && !p.otpValues[i] && i > 0) refs.current[i - 1]?.focus();
                  }}
                  onPaste={(e) => p.onOtpPaste(e, i)}
                  autoFocus={i === 0}
                />
              ))}
            </div>
          )}

          {isPwd && (
            <div className="ceyo-auth-field">
              <input type={p.showNewPassword ? "text" : "password"} autoComplete="new-password" placeholder={authT("atLeast8")} value={p.newPassword} onChange={(e) => p.setNewPassword(e.target.value)} autoFocus />
              <button type="button" onClick={() => p.setShowNewPassword(!p.showNewPassword)} aria-label="toggle password">
                {p.showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}

          {p.screen === "forgot-password" && (
            <div className="ceyo-auth-field"><input type="email" value={p.email} disabled /></div>
          )}

          {!isOtp && (
            <button type="submit" className="ceyo-auth-cta" disabled={p.isSubmitting || !ready}>
              {p.isSubmitting ? <span className="ceyo-auth-spin" /> : m.cta}
            </button>
          )}

          {isOtp && (
            <div className="ceyo-auth-resend">
              {p.isSubmitting ? (
                <span className="ceyo-auth-muted"><span className="ceyo-auth-spin light" /> {authT("verifying")}</span>
              ) : p.countdown > 0 ? (
                <span className="ceyo-auth-muted">{authTf("resendInSecondsTemplate", { n: p.countdown })}</span>
              ) : (
                <button type="button" onClick={p.onResendOtp}>{authT("resendCode")}</button>
              )}
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
