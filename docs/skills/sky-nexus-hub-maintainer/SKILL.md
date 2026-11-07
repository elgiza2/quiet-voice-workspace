---
name: sky-nexus-hub-maintainer
description: Maintain the Sky Nexus Hub repository, especially chat routing, Fast Chat streaming and thinking UI, AgentSky sessions, Browser Use fallback, tests, GitHub delivery, and Vercel deployment. Use when continuing or reviewing this repository's agent/chat work, changing provider routing, debugging delayed replies or lost thinking state, or deploying updates.
---

# Sky Nexus Hub Maintainer

## Purpose

Maintain the existing Sky Nexus Hub app without undoing its routing decisions. Read `references/project-context.md` before changing chat/provider behavior; it records the current architecture, changes made, safety boundaries, validation, and handoff state.

## Workflow

1. **Re-establish repository state.** Confirm the active directory, branch, remotes, `git status`, recent commit, current project configuration, and any new user changes. Do not assume the repository or deployment is still at the state in the handoff reference.
2. **Trace before changing.** For chat behavior, inspect `src/pages/chat/ChatPage.tsx`, `src/lib/chat/shouldUseFastChat.ts`, `src/lib/chat/fastChat.ts`, `src/lib/streamChat.ts`, `src/pages/chat/services/runChatStreamTurn.ts`, `src/pages/chat/services/runAgentSkyTurn.ts`, and the relevant Supabase functions. Follow actual dispatch/callbacks rather than relying on UI labels.
3. **Preserve the routing contract.** Ordinary text messages enter Fast Chat first; Fast Chat's model—not a front-end regex/media heuristic—decides whether to answer or emit its hidden escalation signal. Explicit user-selected modes/agents remain explicit. Fast Chat currently handles text, not attached multimodal inputs.
4. **Keep provider fallbacks safe.** AgentSky is distinct from Fast Chat's full-chat escalation. On transient AgentSky/provider/network failures, bounded reconnection may fall back to the repository's Browser Use Cloud task path. Never rerun after visible output or a non-thought/tool action; do not bypass authorization/plan failures or media policy. Browser Use Cloud is called through the server-side API/key vault, not by opening its sign-in website. Preserve fallback's same-turn UI/message reuse and cleanup.
5. **Maintain streaming invariants.** Keep reasoning separate from user-visible answer text, do not expose sentinels, preserve partial SSE frames and UTF-8 decoder flushing, handle missing final newline, keep the thinking/loading states until terminal/error/abort, and clear timers/listeners/controllers in all exits.
6. **Test narrowly, then build.** Run relevant Vitest suites and `npm run build`; run ESLint/Prettier for changed files where practical. The repository-wide lint baseline has unrelated legacy failures; report rather than mass-reformatting unrelated files. Run `git diff --check` before committing.
7. **GitHub delivery.** Only stage intended files, inspect the staged diff, commit with a descriptive message, and push to the confirmed project remote/branch when the user requests it. Never stage secrets, generated build output, `.env`, or unrelated user changes.
8. **Vercel deployment.** Check current Vercel connector login, list and identify the intended project/deployment, and confirm its Git linkage/production branch before publishing. If the Vercel MCP requests login, initiate its login flow and wait for the user to finish; do not invent or paste credentials. Do not deploy to an unverified project/domain. After publish, verify deployment status and URL from Vercel.

## Reference

Read [`references/project-context.md`](references/project-context.md) for the detailed repository map, routing and model/tool distinctions, fallback rules, file list, test outcomes, known limitations, and the last recorded GitHub/Vercel state. Re-check live files before relying on historic details.
