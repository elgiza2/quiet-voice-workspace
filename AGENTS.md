<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The signed-in `/` and `/index` render the AgentHub bot/group home while `/chat` preserves the full primary-agent workspace. Groups and their coordinator/member relationships persist through owner-scoped database access; browser metadata is reserved for local preferences. Why: groups created by bots and users share one source of truth.
- Chat sends render optimistic user events and reconcile them by persisted message ID; history refreshes retain unconfirmed user events, and new-chat creation bridges its first message until history arrives. Why: prevent sent-message flicker during asynchronous saves and session creation.
- Integration operations use verified user-owned Composio accounts and single-claim approval requests; background jobs deliver idempotently through persisted jobs/messages. Why: prevent cross-account actions, duplicate execution and lost results.

- Generative UI: chat models answer with a ```ui JSON block validated by src/components/chat/genui/schema.ts and rendered by GenUIBlock; the prompt lives in genui/prompt.ts and is copied into supabase/functions/_shared/genui.ts (used by chat-fast and chat-alibaba; Deno cannot import src) — keep both in sync. ui blocks render outside the markdown pipeline so math/sanitize plugins cannot break them.
- Chat HTML widgets: ```widget blocks render in a sandboxed iframe (allow-scripts only) via genui/HtmlWidget.tsx with a built-in stylesheet; replies go back through megsy.send/postMessage. Why: rich model-drawn UI without access to the app session.
- Chat interactive answers use the vendored thesysdev/open-intelligent-ui component catalogue with @openuidev/react-lang, lazy-loaded behind ClientOnly; native openui fences and translated legacy ui specs share this renderer. Why: preserve original library behavior without importing Next.js or changing the primary agent.
- OpenUI SearchImage uses the existing browser-safe search resolver, and its CSS tokens are scoped to the chat and derived from Megsy's theme. Why: retain real searched photos and prevent library styles from changing the rest of the app.
- Domain cards extend the existing OpenUI catalogue and reuse its photo resolver and rendered action children; instructions are shared by browser and agent prompts. Why: keep places, menus and schedules interactive without a separate renderer or booking engine.
- Chat transport attaches the caller's bearer session to local proxy requests and waits for completion or explicit cancellation without browser generation deadlines; reasoning-only or empty streams are not successful answers. Why: avoid unauthorized proxy fallback, discarded generation and false completion.
- Authorized chat requests report unavailable provider or memory dependencies as terminal session.error events with a persistent in-chat alert; never emit a successful answer or page-level 503 for these operational states. Why: preserve saved messages and keep the workspace usable without concealing unavailable replies.
- Manual crypto checkout shares one inline payment panel; only supported comment-bearing networks are offered, and confirmation calls the service-only atomic settlement function. Why: prevent reference ambiguity, reused transactions and partial credit activation.
- Reward task eligibility uses a shared allowlist and server-only atomic claims; unavailable external verification must not award points. Why: prevent arbitrary tasks and fabricated completions.
- Telegram fullscreen and inset events update shared safe-area variables, and profile pictures synchronize after verified Telegram sign-in. Why: keep native controls clear and returning-user identity current.
- Telegram sign-in uses one shared in-flight promise and relies on verifyOtp to persist its session. Why: startup and the auth page must not race single-use login tokens or publish duplicate sign-in transitions.
- Code that still reads tables from the previous backend imports the untyped client from src/integrations/supabase/legacyClient.ts; new code uses the typed client. Why: keep the build clean while features move to the new schema.
- Sign-in uses Supabase email OTP directly, and signed-in users without profiles.onboarding_completed are routed to /onboarding (profile → user type → primary bot). Avatars are stored as small data URLs because public storage buckets are blocked in this workspace. Why: no dependency on the old backend functions.
- Hosted Auth SMTP is configured through an operator-only Management API script with secret-store credentials and read-back verification, never a browser/public endpoint or custom OTP system. Why: preserve native authentication and keep mailbox and management credentials private.
- Current agents share owner-scoped agent_memories and agent_documents; file references require read_file and unsupported binaries must be rejected. Why: keep recall and actual document contents consistent across primary and specialist chats.
- Daily/weekly agent_routines use a database lease, unique scheduled run and signed operator endpoint, pause on failures, and deliver through deterministic message IDs. Why: avoid duplicate work and false scheduled success.
- The central loop rejects empty finals and exhausted step budgets; specialist tool events persist and interactive cards reach the caller. Why: incomplete tool work must not appear completed.
- Pricing and Vault presentation overrides are scoped in a shared stylesheet loaded after legacy styles; Vault editors retain the existing account-scoped data shape and last-four-only card validation. Why: reference styling must not alter other settings or expand sensitive-data storage.
- Unconfigured code execution fails closed and never evaluates model code in the application process; account-loading failures show retry rather than routing to onboarding. Why: prevent execution from escaping isolation and network failures from becoming destructive setup retries.
- Voice generation and transcription use authenticated binary HTTP routes; per-agent preferences persist in bots.look, recording origin in messages.metadata, and private recording blobs in browser IndexedDB. Calls and voice-message replies share the same voice resolver; text replies have no speech controls. Why: retain bot identity, private audio, and recording-aware history without public storage.
- Calls detect speech ending with lazy-loaded hark, submit complete recording containers and resume listening after playback; call position is conversation-relative and clamped on restore/resize. Why: automatic turn-taking without premature upload or offscreen restored controls.
- Automatic bot voice IDs are allocated once and persisted in bots.look.voiceSettings.autoVoiceId; roster changes reuse assignments. Why: adding or deleting bots must not change existing voice identities.
- Service keys (Cerebras, Browserbase, Composio) live in the server-only provider_api_keys pool, filled by the owner-only Telegram bot; env vars are fallback only. Why: keys rotate without redeploying.
- Long background tasks run as persisted agent_jobs triggered by a signed self-request to /api/public/ceyo-jobs, with queued leftovers retried by the routines endpoint; no Inngest. Why: free and atomic claim prevents double runs.
- Telegram key administration reads its bot token through service-role-only Supabase Vault RPCs and calls Telegram directly; never restore connector-gateway transport. Why: the owner requires portable credentials independent of Lovable.
- First-run setup uses the invoker-rights complete_onboarding RPC with a profile row lock and one transaction. Why: retries cannot create duplicate primary bots or partially finish profiles.
- Update README.md's current-work and verification sections after every implementation pass, keeping roadmap.md as the active task list. Why: successor agents need an accurate handoff rather than historical completion claims.
