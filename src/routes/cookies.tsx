import { createFileRoute } from "@tanstack/react-router";
import { SpaMount } from "@/lib/spaMount";
import { documentHead } from "@/pages/legal/documents";
export const Route = createFileRoute("/cookies")({ ssr: false, component: SpaMount, head: () => documentHead("cookies") });