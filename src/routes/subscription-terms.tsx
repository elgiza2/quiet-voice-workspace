import { createFileRoute } from "@tanstack/react-router";
import { SpaMount } from "@/lib/spaMount";
import { documentHead } from "@/pages/legal/documents";
export const Route = createFileRoute("/subscription-terms")({ ssr: false, component: SpaMount, head: () => documentHead("subscription-terms") });