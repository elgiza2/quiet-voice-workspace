import { Route, Navigate } from "react-router-dom";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { ProtectedRoute } from "./routeHelpers";
import { AnimatedShell } from "./AnimatedShell";
import { OnboardingGate } from "./OnboardingGate";
import {
  AuthPage,
  OAuthCallbackPage,
  AppleCallbackPage,
  OAuthAuthorizePage,
  ResetPasswordPage,
  ChangeEmailPage,
  ChangePasswordPage,
  TwoFactorPage,
  MfaChallengePage,
  DeleteAccountPage,
  AcceptInvitePage,
  LegalDocPage,
  DocsPage,
  AgentHubPage,
} from "./lazyPages";

const OnboardingPage = lazy(() => import("@/pages/onboarding/OnboardingPage"));
const CeyoSettings = lazy(() => import("@/pages/ceyo/CeyoSettings"));

const guard = (el: React.ReactNode, guest?: string) => <ProtectedRoute guestEntry={guest}>{el}</ProtectedRoute>;
const home = <Navigate to="/" replace />;

/** Ceyo: landing, sign-in, the bot home and settings. Everything else returns home. */
export const AppRoutes = (_props: { currentUserId: string | null }) => (
  <>
    <Route path="/" element={guard(<OnboardingGate><AgentHubPage /></OnboardingGate>, "/auth?mode=signup")} />
    <Route path="/index" element={guard(<OnboardingGate><AgentHubPage /></OnboardingGate>, "/auth?mode=signup")} />
    <Route path="/welcome" element={<Navigate to="/auth?mode=signup" replace />} />
    <Route path="/landing" element={<Navigate to="/auth?mode=signup" replace />} />
    <Route path="/onboarding" element={guard(<OnboardingPage />)} />

    <Route element={<AnimatedShell />}>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/signin" element={<AuthPage />} />
      <Route path="/signup" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage />} />
      <Route path="/auth/apple-callback" element={<AppleCallbackPage />} />
      <Route path="/auth/callback/:provider" element={<OAuthCallbackPage />} />
      <Route path="/auth/mfa" element={<MfaChallengePage />} />
      <Route path="/oauth/authorize" element={<OAuthAuthorizePage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/invite/:token" element={<AcceptInvitePage />} />
      <Route path="/settings/change-email" element={guard(<ChangeEmailPage />)} />
      <Route path="/settings/change-password" element={guard(<ChangePasswordPage />)} />
      <Route path="/settings/two-factor" element={guard(<TwoFactorPage />)} />
      <Route path="/settings/delete-account" element={guard(<DeleteAccountPage />)} />
    </Route>

    <Route path="/settings" element={guard(<CeyoSettings />)} />
    <Route path="/settings/:section" element={guard(<CeyoSettings />)} />
    <Route path="/settings/:section/:sub" element={guard(<CeyoSettings />)} />

    <Route path="/terms" element={<LegalDocPage slug="terms" />} />
    <Route path="/privacy" element={<LegalDocPage slug="privacy" />} />
    <Route path="/subscription-terms" element={<LegalDocPage slug="subscription-terms" />} />
    <Route path="/about" element={<LegalDocPage slug="about" />} />
    <Route path="/contact" element={<LegalDocPage slug="contact" />} />
    <Route path="/cookies" element={<LegalDocPage slug="cookies" />} />
    <Route path="/security" element={<LegalDocPage slug="security" />} />
    <Route path="/docs" element={<DocsPage />} />
    <Route path="/docs/:slug" element={<DocsPage />} />

    <Route path="/chat" element={home} />
    <Route path="*" element={home} />
  </>
);
