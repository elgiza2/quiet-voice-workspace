import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";

export const SettingsShell = lazy(() =>
  import("@/components/settings/SettingsShell").then((m) => ({ default: m.SettingsShell })),
);
export const AuthPage = lazy(() => import("@/pages/auth/AuthPage"));
export const AppleCallbackPage = lazy(() => import("@/pages/auth/AppleCallbackPage"));
export const OAuthCallbackPage = lazy(() => import("@/pages/auth/OAuthCallbackPage"));
export const OAuthAuthorizePage = lazy(() => import("@/pages/auth/OAuthAuthorizePage"));
export const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage"));
export const ChangeEmailPage = lazy(() => import("@/pages/auth/ChangeEmailPage"));
export const ChangePasswordPage = lazy(() => import("@/pages/auth/ChangePasswordPage"));
export const TwoFactorPage = lazy(() => import("@/pages/auth/TwoFactorPage"));
export const MfaChallengePage = lazy(() => import("@/pages/auth/MfaChallengePage"));
export const DeleteAccountPage = lazy(() => import("@/pages/auth/DeleteAccountPage"));
export const AcceptInvitePage = lazy(() => import("@/pages/auth/AcceptInvitePage"));
export const LegalDocPage = lazy(() => import("@/pages/legal/LegalDocPage"));
export const DocsPage = lazy(() => import("@/pages/docs/DocsPage"));
export const AgentHubPage = lazy(() => import("@/pages/agent/AgentHubPage"));
