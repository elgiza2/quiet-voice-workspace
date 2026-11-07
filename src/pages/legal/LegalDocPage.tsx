/** Ceyo legal documents — the full policy text rendered on a clean black page. */
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEGAL_DOCS, type LegalSlug } from "./documents";
import "@/styles/ceyo.css";
import "@/styles/company-pages.css";
export { LEGAL_DOCS } from "./documents";
export type { LegalSlug } from "./documents";

/** Markdown body with internal links kept inside the app router. */
export function DocMarkdown({ source }: { source: string }) {
  return (
    <div className="cx-md" data-no-translate>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            href && href.startsWith("/") ? (
              <Link to={href}>{children}</Link>
            ) : (
              <a href={href} target={href?.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer">
                {children}
              </a>
            ),
        }}
      >
        {source}
      </Markdown>
    </div>
  );
}

export default function LegalDocPage({ slug }: { slug: LegalSlug }) {
  const doc = LEGAL_DOCS[slug];
  const nav = useNavigate();

  useEffect(() => {
    document.title = `${doc.title} — Ceyo · Megsy LLC`;
  }, [doc.title]);

  return (
    <div className="agent-hub ceyo-page ceyo-company" data-no-translate>
      <header className="ceyo-top">
        <Button variant="ghost" size="icon" type="button" className="gx-round" aria-label="Back" onClick={() => nav("/")}>
          <ChevronLeft size={20} />
        </Button>
        <h1>Ceyo · Megsy LLC</h1>
        <span className="ceyo-top-action" />
      </header>
      <div className="ceyo-scroll company-scroll">
        <div className="company-layout">
          <nav className="company-nav" aria-label="Company & legal">
            <p className="company-label">COMPANY & LEGAL</p>
            {(Object.keys(LEGAL_DOCS) as LegalSlug[]).map((key) => <Button key={key} variant="ghost" className="company-link" asChild>
              <Link to={`/${key}`} aria-current={key === slug ? "page" : undefined}>{LEGAL_DOCS[key].title}</Link>
            </Button>)}
          </nav>
          <main><DocMarkdown source={doc.source} />
            <footer className="company-footer"><span>© 2026 Megsy LLC</span><a href="mailto:CEO@megsyai.com">CEO@megsyai.com</a></footer>
          </main>
        </div>
      </div>
    </div>
  );
}
