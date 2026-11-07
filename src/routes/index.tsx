import { createFileRoute } from "@tanstack/react-router";
import { SpaMount } from "@/lib/spaMount";

// The home page is the Ceyo SPA itself (same mount as the catch-all `$` route).
export const Route = createFileRoute("/")({
  ssr: false,
  component: SpaMount,
  head: () => ({
    meta: [
      { title: "Ceyo — Your Personal Bots and Group Chats" },
      {
        name: "description",
        content:
          "Meet your main Ceyo bot, create personal bots, coordinate group chats and pick up every conversation from one calm home.",
      },
      { property: "og:title", content: "Ceyo — Your Personal Bots and Group Chats" },
      {
        property: "og:description",
        content:
          "Create personal bots and coordinated group chats, then continue every conversation from one clean, animated home.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Ceyo — Your Personal Bots and Group Chats" },
      {
        name: "twitter:description",
        content:
          "Create personal bots and coordinated group chats, then continue every conversation from one clean, animated home.",
      },
    ],
  }),
});
