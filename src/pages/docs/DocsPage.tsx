/** Ceyo documentation — the guide pages, one topic per screen. */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronLeft, Search } from "lucide-react";
import overviewMd from "@/content/docs/overview.md?raw";
import getStartedMd from "@/content/docs/get-started.md?raw";
import botsMd from "@/content/docs/bots.md?raw";
import chatMd from "@/content/docs/chat-and-collaboration.md?raw";
import computerMd from "@/content/docs/computer-and-apps.md?raw";
import skillsMd from "@/content/docs/skills-routines-and-automations.md?raw";
import mobileMd from "@/content/docs/mobile.md?raw";
import sharedMd from "@/content/docs/shared-bots.md?raw";
import teamsMd from "@/content/docs/teams-and-enterprises.md?raw";
import "@/styles/ceyo.css";

const DOCS = [
  { slug: "overview", label: "Overview", source: overviewMd },
  { slug: "get-started", label: "Get started", source: getStartedMd },
  { slug: "bots", label: "Bots", source: botsMd },
  { slug: "chat-and-collaboration", label: "Chat", source: chatMd },
  { slug: "computer-and-apps", label: "Computer & apps", source: computerMd },
  { slug: "skills-routines-and-automations", label: "Skills & routines", source: skillsMd },
  { slug: "mobile", label: "Mobile", source: mobileMd },
  { slug: "shared-bots", label: "Shared bots", source: sharedMd },
  { slug: "teams-and-enterprises", label: "Teams", source: teamsMd },
];

export default function DocsPage() {
  const nav = useNavigate();
  const { slug: raw } = useParams<{ slug: string }>();
  const active = DOCS.find((d) => d.slug === (raw || "overview")) || DOCS[0];
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.title = `${active.label} | Ceyo Docs`;
    setQuery("");
  }, [active.slug]);

  const shown = query.trim()
    ? DOCS.filter((d) => d.source.toLowerCase().includes(query.trim().toLowerCase()))
    : DOCS;

  return (
    <div className="agent-hub ceyo-page ceyo-docs" data-no-translate>
      <header className="ceyo-top">
        <button type="button" className="gx-round" aria-label="Back" onClick={() => nav("/")}>
          <ChevronLeft size={20} />
        </button>
        <h1>Docs</h1>
        <span className="ceyo-top-action" />
      </header>

      <div className="ceyo-docs-search">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the docs"
          aria-label="Search the docs"
        />
      </div>

      <div className="ceyo-docs-chips" role="tablist">
        {shown.map((d) => (
          <button
            key={d.slug}
            type="button"
            role="tab"
            aria-selected={d.slug === active.slug}
            data-on={d.slug === active.slug}
            onClick={() => nav(d.slug === "overview" ? "/docs" : `/docs/${d.slug}`)}
          >
            {d.label}
          </button>
        ))}
        {query.trim() && shown.length === 0 && <span className="ceyo-docs-none">No pages match “{query.trim()}”.</span>}
      </div>

      <div className="ceyo-scroll">
        <div className="cx-md">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) =>
                href && href.startsWith("/") ? (
                  <Link to={href}>{children}</Link>
                ) : (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                ),
            }}
          >
            {active.source}
          </Markdown>
        </div>
      </div>
    </div>
  );
}
