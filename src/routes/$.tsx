import { createFileRoute } from "@tanstack/react-router";
import { SpaMount } from "@/lib/spaMount";

// Client-only: the whole Ceyo app (its own router included) mounts here.
// Dynamic imports inside `spaMount` keep every app module out of the SSR graph.
export const Route = createFileRoute("/$")({
  ssr: false,
  component: SpaMount,
  head: ({ params }) => {
    const path = String(params._splat || "Workspace");
    const section = (path === "settings/plans" || path === "pricing" ? "Plans" : path === "settings/vault" ? "Vault" : path.split("/")[0]).replace(/[-_]/g, " ");
    const name = section.charAt(0).toUpperCase() + section.slice(1);
    const title = `${name} — Ceyo`;
    const description = section === "Plans" ? "Compare Ceyo Plus, Pro and Ultra subscriptions and monthly or yearly pricing." : section === "Vault" ? "Your account's saved login labels, payment card labels and contact information in Ceyo." : `Explore ${name.toLowerCase()} in Ceyo, your workspace for creating and getting work done.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
});
