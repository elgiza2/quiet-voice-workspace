import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import "../styles/app.css";
import { reportLovableError } from "../lib/lovable-error-reporting";

// First-paint colours match the stored theme. Do not render a fake app frame
// here: on a slow or interrupted connection it looks like an endless loader.
const BOOT_STYLE = `
:root { color-scheme: dark; }
html, body { background-color: #000; margin: 0; }
#root { min-height: 100dvh; background-color: #000; }
html[data-theme="dark"] { color-scheme: dark; }
html[data-theme="dark"], html[data-theme="dark"] body { background-color: #000; }
html[data-theme="dark"] #root { background-color: #000; }
`;

const THEME_BOOT_SCRIPT = `
(function(){try{
  var h=document.documentElement;
  h.setAttribute("data-theme","dark");
  h.classList.add("dark");
  h.classList.remove("light");
  h.style.colorScheme="dark";
}catch(e){}})();
`;

const GARAMOND_STYLE = `
@font-face {
  font-family: "ITC Garamond Std Narrow"; font-weight: 300; font-style: normal; font-display: swap;
  src: url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-LtNarrow_i2zcip.woff2") format("woff2"),
       url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-LtNarrow_soc5vc.woff") format("woff");
}
@font-face {
  font-family: "ITC Garamond Std Narrow"; font-weight: 400; font-style: normal; font-display: swap;
  src: url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-BkNarrow_xjfoc0.woff2") format("woff2"),
       url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-BkNarrow_xjfoc0.woff") format("woff");
}
@font-face {
  font-family: "ITC Garamond Std Narrow"; font-weight: 400; font-style: italic; font-display: swap;
  src: url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-BkNarrowIta_hiy9ld.woff2") format("woff2"),
       url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-BkNarrowIta_rlarxo.woff") format("woff");
}
@font-face {
  font-family: "ITC Garamond Std Narrow"; font-weight: 500; font-style: normal; font-display: swap;
  src: url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-BkNarrow_xjfoc0.woff2") format("woff2"),
       url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-BkNarrow_xjfoc0.woff") format("woff");
}
`;

const TELEGRAM_SCRIPT = `(function () {
  try {
    var inTelegram =
      /[?#&]tgWebApp/.test(location.href) ||
      "TelegramWebviewProxy" in window ||
      /Telegram/i.test(navigator.userAgent);
    if (!inTelegram) return;
    document.write('<script src="https://telegram.org/js/telegram-web-app.js"><\\/script>');
  } catch (e) {}
})();`;

const GTM_SCRIPT = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NBZ77LRT');`;

const CLARITY_SCRIPT = `(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "ythzqtrpnz");`;

const DEFERRED_FONTS_SCRIPT = `(function () {
  var HREF =
    "https://fonts.googleapis.com/css2?family=Inter:wght@700&family=Instrument+Serif:ital@0;1&family=Barlow:wght@300;400;500;600&family=DM+Sans:wght@400;500;600;700&family=Noto+Serif+Arabic:wght@400;600;700&family=Almarai:wght@300;400;700;800&family=Cairo:wght@400;500;600;700&family=Tajawal:wght@400;500;700&family=Readex+Pro:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Sora:wght@400;500;600;700;800&family=Archivo+Black&family=Manrope:wght@400;500;600;700&display=swap";
  var EXTRA =
    "https://db.onlinewebfonts.com/c/e66905e07608167a84e6ad52f638c3c6?family=Helvetica+Now+Var";
  function add(href) {
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.appendChild(l);
  }
  function go() {
    try {
      var c = navigator.connection || {};
      if (c.saveData) return;
      if (/2g/.test(c.effectiveType || "")) return;
    } catch (e) {}
    var run = function () { add(HREF); add(EXTRA); };
    if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 800);
  }
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
})();`;

const SPECULATION_SCRIPT = `(function () {
  try {
    var nav = navigator;
    var c = nav.connection || {};
    var slow = c.saveData === true || /(^|-)(2g|slow-2g)$/.test(c.effectiveType || "");
    var weak = (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4;
    if (slow || weak) return;
    var add = function () {
      var s = document.createElement("script");
      s.type = "speculationrules";
      s.textContent = JSON.stringify({
        prerender: [
          {
            source: "document",
            where: {
              and: [
                { href_matches: "/*" },
                { not: { href_matches: "/api/*" } },
                { not: { href_matches: "/auth/*" } },
              ],
            },
            eagerness: "moderate",
          },
        ],
        prefetch: [
          { source: "document", where: { href_matches: "/*" }, eagerness: "conservative" },
        ],
      });
      document.body.appendChild(s);
    };
    if (document.readyState === "complete") setTimeout(add, 1200);
    else addEventListener("load", function () { setTimeout(add, 1200); });
  } catch (e) {}
})();`;

const ORG_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "/#organization",
      name: "Ceyo",
      url: "/",
      logo: "/app-icon-512.png",
      sameAs: [],
      description:
        "Personal bots and group chats in one calm place.",
    },
    {
      "@type": "WebSite",
      "@id": "/#website",
      name: "Ceyo",
      url: "/",
      publisher: { "@id": "/#organization" },
      inLanguage: ["en", "ar"],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "/#software",
      name: "Ceyo",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "/",
      description:
        "Personal bots and group chats in one calm place.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
      publisher: { "@id": "/#organization" },
    },
  ],
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm opacity-70">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm opacity-70">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { name: "google", content: "notranslate" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Ceyo" },
      { name: "application-name", content: "Ceyo" },
      { name: "theme-color", content: "#ffffff" },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "format-detection", content: "telephone=no" },
      { title: "Ceyo — Your Personal Bots" },
      {
        name: "description",
        content:
          "Ceyo gives you a main bot that creates new bots and group chats for you. Super intelligence, made personal.",
      },
      {
        property: "og:title",
        content: "Ceyo — Your Personal Bots",
      },
      {
        property: "og:description",
        content:
          "Ceyo gives you a main bot that creates new bots and group chats for you. Super intelligence, made personal.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { property: "og:site_name", content: "Ceyo" },
      { property: "og:locale", content: "en_US" },
      { property: "og:locale:alternate", content: "ar_EG" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/app-icon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/app-icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/app-icon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/app-icon-180.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "preconnect",
        href: "https://kcrssdgsefhpzoidlhhm.supabase.co",
        crossOrigin: "anonymous",
      },
      { rel: "dns-prefetch", href: "https://kcrssdgsefhpzoidlhhm.supabase.co" },
      { rel: "preconnect", href: "https://d8j0ntlcm91z4.cloudfront.net", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://d8j0ntlcm91z4.cloudfront.net" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// AdRoll retargeting pixel. Loaded lazily after the app is interactive so the
// third-party request never competes with the first paint, and re-fired on SPA
// navigation because the loader only counts one pageView per document.
// IMPORTANT: the tag only starts after the visitor accepted cookies through
// Ceyo's own banner (megsy_cookies_accepted === "true"). Loading it earlier
// makes AdRoll/NextRoll show its full-screen Didomi consent dialog, which
// covers the pricing/checkout UI.
const ADROLL_SCRIPT = `
(function(){
  var start = function(){
    try {
      if (localStorage.getItem("megsy_cookies_accepted") !== "true") return;
    } catch (e) { return; }
    if (window.__adroll_loaded) return;
    var w = window, d = document;
    // Consent was already collected by Ceyo's own banner: suppress the
    // AdRoll/NextRoll (Didomi) dialog, which otherwise overlays the whole app
    // and swallows clicks on the chat composer and the checkout buttons.
    try {
      var cs = d.createElement('style');
      cs.textContent = '#adroll_consent_container,#adroll_consent_banner,#didomi-host,.didomi-popup-open,.adroll_consent_container{display:none!important;pointer-events:none!important;visibility:hidden!important}';
      d.head.appendChild(cs);
      var strip = function(){
        var nodes = d.querySelectorAll('#adroll_consent_container,#didomi-host');
        for (var i = 0; i < nodes.length; i++) { try { nodes[i].remove(); } catch (er) {} }
        d.documentElement.classList.remove('didomi-popup-open');
        d.body && d.body.classList.remove('didomi-popup-open');
      };
      new MutationObserver(strip).observe(d.documentElement, { childList: true, subtree: true });
      strip();
    } catch (er) {}

    w.adroll_adv_id = "U7L76NUFIBDU5JJZWFGSPY";
    w.adroll_pix_id = "YH6HQKQYMVBAFP6KK4M5WU";
    w.adroll_version = "2.0";
    w.adroll_tag_source = w.adroll_tag_source || "manual";
    w.__adroll_loaded = true;
    w.adroll = w.adroll || [];
    w.adroll.f = ['setProperties','identify','track','identify_email','get_cookie'];
    for (var a = 0; a < w.adroll.f.length; a++) {
      w.adroll[w.adroll.f[a]] = w.adroll[w.adroll.f[a]] || (function(n){
        return function(){ w.adroll.push([n, arguments]); };
      })(w.adroll.f[a]);
    }
    var e = d.createElement('script');
    var o = d.getElementsByTagName('script')[0];
    e.async = 1;
    e.src = "https://s.adroll.com/j/" + w.adroll_adv_id + "/roundtrip.js";
    o.parentNode.insertBefore(e, o);
    w.adroll.track("pageView");
    var last = location.pathname;
    var onNav = function(){
      if (location.pathname === last) return;
      last = location.pathname;
      try { w.adroll.track("pageView"); } catch (err) {}
    };
    w.addEventListener("megsy:navigation", onNav);
    w.addEventListener("popstate", onNav);
    // If consent arrives after boot (user clicks Accept in the Ceyo banner),
    // start the pixel then.
    w.addEventListener("megsy:cookies-accepted", start);
  };
  if (window.requestIdleCallback) requestIdleCallback(start, { timeout: 4000 });
  else setTimeout(start, 2500);
})();
`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" className="dark" translate="no" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: GTM_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: CLARITY_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: BOOT_STYLE }} />
        <style dangerouslySetInnerHTML={{ __html: GARAMOND_STYLE }} />
        <script dangerouslySetInnerHTML={{ __html: TELEGRAM_SCRIPT }} />
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: DEFERRED_FONTS_SCRIPT }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ORG_JSON_LD }} />
      </head>
      <body>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-NBZ77LRT"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <defs>
            <filter id="megsy-glass-warp" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.008 0.014"
                numOctaves="2"
                seed="7"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="28"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
            {/* A tighter wavelength for small panes: at 0.045 the noise varies on
                roughly the same pitch as the dotted canvas, so a pane's rim really
                drags the dots with it instead of shifting the whole grid evenly. */}
            <filter
              id="megsy-glass-warp-tight"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.045 0.05"
                numOctaves="2"
                seed="9"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="16"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
        <div id="root">{children}</div>
        <script dangerouslySetInnerHTML={{ __html: SPECULATION_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ADROLL_SCRIPT }} />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
