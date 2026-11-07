import ReminderWatcher from "@/components/life/ReminderWatcher";
import { CeyoConfirmHost } from "@/components/common/CeyoConfirm";
import { useEffect, useState, Suspense } from "react";
import { BrowserRouter } from "react-router-dom";

import { TooltipProvider } from "@/components/ui/tooltip";
import { CostConfirmationHost } from "@/components/billing/CostConfirmationHost";
import PageViewTracker from "@/components/analytics/PageViewTracker";
import ErrorBoundary, { RouteErrorBoundary } from "@/components/common/ErrorBoundary";
import TranslationWrapper from "@/components/common/TranslationWrapper";
import { PromoBannerProvider } from "@/components/promo/PromoBannerContext";
import { ZoneProvider } from "@/contexts/ZoneContext";
import { ConfirmProvider } from "@/components/common/ConfirmDialog";
import { DynamicNotifications } from "@/components/notifications/DynamicNotifications";
import { supabase } from "@/integrations/supabase/client";
import { subscribeAuthEvents } from "@/lib/authStore";
import { clearAllSnapshots } from "@/lib/pageSnapshot";

import { SettingsShell } from "@/routes-app/lazyPages";
import {
  LazyFallback,
  DeferredRoutes,
  ScrollToTop,
  InternalLinkInterceptor,
} from "@/routes-app/routeHelpers";
import { AppRoutes } from "@/routes-app/AppRoutes";
import { applyTheme } from "@/lib/theme";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { loadTikTokPixel, trackTikTokFunnelEvent } from "@/lib/analytics/tiktokPixel";

/** Watches background jobs / agent runs and notifies the user when they finish. */
const BackgroundJobNotifier = lazyWithRetry(
  () => import("@/lib/notifications/BackgroundJobNotifier"),
);

/** Theme: light (white + pink) by default, dark available; auth screens always dark. */
const useAppChrome = () => {
  useEffect(() => {
    // The old page-snapshot overlay is gone for good — purge any entries
    // still sitting in this browser's localStorage.
    document.getElementById("snapshot-preview")?.remove();
    clearAllSnapshots();
    const root = document.getElementById("root");
    root?.removeAttribute("data-snapshot-preview");
    root?.removeAttribute("aria-busy");
    root?.classList.add("app-booted");
  }, []);

  useEffect(() => {
    const html = document.documentElement;

    const apply = () => applyTheme();

    apply();
    // Language/direction is owned by authI18n (English + Egyptian Arabic).


    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("popstate", apply);
    window.addEventListener("megsy:theme", apply as EventListener);
    mq.addEventListener?.("change", apply);

    // SPA navigations emit no popstate, so observe them directly instead of
    // polling: patch the two history methods the router uses and re-apply.
    const history = window.history as History & { __megsyThemePatched?: boolean };
    const patch = (method: "pushState" | "replaceState") => {
      const original = history[method].bind(history);
      return ((...args: Parameters<History["pushState"]>) => {
        const result = original(...args);
        // BrowserRouter may initialise its history during render. Notify the
        // outer TanStack shell on the next microtask so React never receives a
        // nested router update while the inner router is still rendering.
        queueMicrotask(() => window.dispatchEvent(new Event("megsy:navigation")));
        return result;
      }) as History["pushState"];
    };
    let restoreHistory: (() => void) | undefined;
    if (!history.__megsyThemePatched) {
      const originalPush = history.pushState;
      const originalReplace = history.replaceState;
      history.pushState = patch("pushState");
      history.replaceState = patch("replaceState");
      history.__megsyThemePatched = true;
      restoreHistory = () => {
        history.pushState = originalPush;
        history.replaceState = originalReplace;
        history.__megsyThemePatched = false;
      };
    }
    window.addEventListener("megsy:navigation", apply);

    const savedAccent = localStorage.getItem("accent");
    if (savedAccent) html.style.setProperty("--primary", savedAccent);

    return () => {
      window.removeEventListener("popstate", apply);
      window.removeEventListener("megsy:theme", apply as EventListener);
      window.removeEventListener("megsy:navigation", apply);
      mq.removeEventListener?.("change", apply);
      restoreHistory?.();
    };
  }, []);
};


const clearUserCaches = () => {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("megsy_cache_")) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
};

const useAuthSession = () => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeAuthEvents((event, session) => {
      const userId = session?.user?.id || null;
      const lastUserId = localStorage.getItem("megsy_last_user_id");

      if (userId && lastUserId && userId !== lastUserId) clearUserCaches();
      if (userId) localStorage.setItem("megsy_last_user_id", userId);

      if (event === "SIGNED_OUT") {
        localStorage.removeItem("megsy_last_user_id");
        clearAllSnapshots();
        clearUserCaches();
      }


      // TikTok funnel: CompleteRegistration, once per account, only for an
      // account created in the last 10 minutes (a real sign-up, not a login).
      if (userId && event === "SIGNED_IN") {
        const createdAt = session?.user?.created_at ? Date.parse(session.user.created_at) : NaN;
        if (Number.isFinite(createdAt) && Date.now() - createdAt < 10 * 60 * 1000) {
          trackTikTokFunnelEvent("CompleteRegistration", {
            eventId: `signup-${userId}`,
            contentId: "account",
            contentName: "Account created",
            once: true,
          });
        }
      }


      setCurrentUserId(userId);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return currentUserId;
};

const App = () => {
  useAppChrome();
  const currentUserId = useAuthSession();

  useEffect(() => {
    loadTikTokPixel();
  }, []);

  return (
    <TranslationWrapper>
      <TooltipProvider>
          <ErrorBoundary>
            <BrowserRouter>
              <ZoneProvider>
                <PromoBannerProvider>
                  <ConfirmProvider>
                    <DynamicNotifications>
                    <ScrollToTop />
                    <PageViewTracker />
                    <ReminderWatcher />
                    <InternalLinkInterceptor />

                    <Suspense fallback={null}>
                      <CostConfirmationHost />
                      <CeyoConfirmHost />
                      <BackgroundJobNotifier />
                    </Suspense>

                    <Suspense fallback={<LazyFallback />}>
                      <RouteErrorBoundary>
                        <SettingsShell>
                          <DeferredRoutes>
                            {AppRoutes({ currentUserId })}
                          </DeferredRoutes>
                        </SettingsShell>
                      </RouteErrorBoundary>
                    </Suspense>
                    </DynamicNotifications>
                  </ConfirmProvider>
                </PromoBannerProvider>
              </ZoneProvider>
            </BrowserRouter>
          </ErrorBoundary>
      </TooltipProvider>
    </TranslationWrapper>
  );
};

export default App;
