# Performance and voice investigation — 2026-11-07

## Scope and evidence

Seven independent read-only investigations covered bootstrap, home rendering, authentication, data fetching, chat execution, mobile layout, and voice services. Signed-in Chromium checks used the supplied test account. No credentials are included here. Application behavior was not modified: this request was diagnosis and provider research.

Mobile tests used 434 × 716 and 4× CPU throttling; desktop used 1280 × 1800 without throttling. These are local development-preview measurements, not published-production, physical-phone GPU, or true INP measurements. Each steady-state sample lasted about ten seconds. The temporary animation override existed only in the test browser.

## Measured findings

- The actual primary chat opens through the home bot button, with a `chat=bot:…` query. `/chat` redirected home; the first direct-path sample therefore measured home, not chat.
- Home repeatedly issued two each of groups, bots, profiles and conversations queries in a ten-second sample: eight directory requests without user input. Jobs added one or two further queries.
- Actual idle chat issued two or three full-history requests while the directory refresh continued behind it. Repeated samples showed 13–21 main-thread tasks exceeding 50 ms and 3.56–5.79 seconds of cumulative long-task duration. Frame p95 ranged from 50 to 133 ms. This reproduces substantial chat jank under mobile CPU constraints.
- The corresponding home samples usually had 0–3 long tasks, 0–158 ms cumulative long-task duration and about 16.8 ms p95 frame spacing. Settings had no observed long tasks in the initial sample.
- Home had 167 declared active animations; chat had 325, including hidden directory and message avatars. Disabling orb animations reduced home animation count to one but did not produce a consistent long-task improvement. Animation count alone is NOT the demonstrated primary CPU bottleneck; weak-device GPU impact remains unverified.
- A chat CPU sample attributed non-idle work to React development JSX, `fmtTime` in HubChat, garbage collection, scrollHeight reads and Clarity. `fmtTime` repeatedly calls `toLocaleTimeString` with options for every message. This supports repeated message rendering/date formatting/layout as optimization targets, not an exact allocation of all delay.
- Live requests returned 404 for legacy `scheduled_nudges`, `page_views`, `background_jobs`, and `subscriptions`; profile requests also returned 400. These establish stale integrations against missing schema, not database execution slowness.
- Database diagnostics' highest-total-work listed messages query averaged 1.44 ms, maximum 13.10 ms across 973 calls. Bots averaged 0.26 ms and groups 0.36 ms. Statistics reset/window and correspondence to every external-client request were not established. The observed rows do not support blaming multi-second lag on SQL execution.
- The first home navigation transferred approximately 18 MB across 250 resources in Vite development, including unbundled libraries. This is NOT production bundle size. Recorded navigation DOM completion was about 318 ms; the script's roughly 14-second total included deliberate observation waits, not a 14-second load time.

## Seven source investigations

### 1. Bootstrap and routing

`src/lib/spaMount.tsx:30–58` waits for boot before app resolution and uses a null fallback. `src/App.tsx:187–195` wraps all pages in a lazy settings shell that is just a small provider (`src/components/settings/SettingsShell.tsx:4–15`). The home statically imports chat and panels (`src/pages/agent/AgentHubPage.tsx:28–31`), which include Markdown, voice and rich cards. `src/styles/app.css:11–47` imports supposedly deferred legacy CSS globally. Three separate prefetch schedulers exist, including an unguarded settings import after 600 ms (`AgentHubPage.tsx:81`). TanStack mounts an inner React Router SPA with custom history interception. These are startup candidates; production transfer/parse attribution remains missing.

### 2. Home rendering

`AgentHubPage.tsx:124–140` refreshes every five seconds, replaces group arrays even if unchanged, then forces a full workspace reload. Workspace-change events can force it twice. `src/lib/agentsky/store.ts:35–56` replaces the complete subscribed snapshot. `HubParts.tsx:22–73` reads avatar preferences and resolves members during rendering; `botLooks.ts:44–61` reparses the stored map per avatar. Orbs are CSS/DOM, not WebGL. Existing styling disables several effects; do not claim a 3D-rendering bottleneck.

### 3. Authentication and stability

`src/integrations/supabase/patchAuth.ts:34–44` converts thrown authentication failures into null-user success, so network failures can be interpreted as logout. `src/lib/ownProfile.ts:28–57` lacks identity/generation protection across invalidation. `useActiveAccount.ts:63–137` and `useCredits.ts:19–73` allow stale overlapping reads. Account settings mounts two `useMe()` consumers. Onboarding separately inserts a bot then updates profile (`OnboardingPage.tsx:82–96`), so partial failures/retries can create duplicates. These are code-supported stability risks, not failures deliberately reproduced through destructive account tests.

### 4. Requests and lifecycle

Hub polls fan out into four directory queries. Idle chat reloads full history every five seconds (`HubChat.tsx:294–298`, `useAgentSession.ts:21–35`, `client.ts:231–255`). No application pagination exists on message history. Storage loads complete document contents to calculate sizes (`CeyoSettings.tsx:253–265`). Global job polling has no teardown (`client.ts:136–153`). `BackgroundJobNotifier.tsx:104–147` can install subscriptions after unmount if its seed request finishes late. Most ordinary component intervals do have cleanup; this is not a claim of universally leaking timers.

### 5. Chat and models

Each event reconstructs transcript (`useAgentSession.ts:171`, `transcript.ts:293–357`) and rerenders Markdown (`HubChat.tsx:494–501`). Full history is retained in multiple event/transcript copies. `HubChat.tsx:62–65,476` recreates locale-time formatting work per row. Main agent execution is Cerebras-backed; missing provider configuration was verified in the earlier audit and is distinct from UI lag. Browser-local run coordination does not establish cross-device execution locking. Upstream EOF is not validated with a completion marker (`agentLoop.server.ts:131–165`). Browser tool calls lack cancellation/timeouts. Active Hub rendering is ordinary Markdown/native cards, not the documented OpenUI renderer.

### 6. Mobile layout and translation

Swipe state updates the whole chat per pointer move (`HubChat.tsx:450–455`). A ResizeObserver is rebuilt every render (`:286–292`), while layout effects and callbacks read/write scrollHeight. Arabic DOM translation observes the full body and queues non-deduplicated walks (`egyptianDom.ts:217–255`), with three navigation passes. Home opts out of translation; these traversal costs remain a separate Arabic-route candidate, not measured blame for the English test. Blur/GPU cost and real keyboard/Safari behavior remain unverified.

### 7. Voice implementation

Current dictation/calls use browser SpeechRecognition and speechSynthesis (`HubChat.tsx:144–156`, `VoiceCall.tsx:19–55`), not a connected cloud voice service. Cloud transcription exists but is not used by the current composer. Voice preferences are not passed to the call; spoken replies are cut to 1,200 characters. Unsupported recognition and errors can fail silently, and a failed/identical reply can leave call phase stuck. Physical microphone and cloud-provider quality tests were not performed.

## Prioritized remedies — proposed, not applied

1. Stop rebuilding unchanged chat history and directory state; deduplicate concurrent refreshes and reuse stable message rows/date formatters. Retain event-driven result delivery and a recovery mechanism for changes from other devices. Measure identical idle/long-chat tasks before and after.
2. Isolate message rendering from swipe/tick state; create a stable scroll observer, coalesce scroll writes, and batch streamed updates without losing optimistic-message identity. Test long history, sending, stop, switching and background completion.
3. Remove or explicitly gate obsolete backend watchers; repair auth error semantics and out-of-order account reads with regression tests. Do not silently disable real features to conceal errors.
4. Split home chat/editing features at interaction boundaries; remove unnecessary settings preload and shell waterfall. Verify cold production asset sizes and navigation before claiming a loading reduction.
5. Only then tune offscreen/unused animation work and blur on low-end devices. The animation-only test did not establish the main bottleneck.

Changing polling freshness, replacing providers, onboarding transactions, or database/security architecture should be implemented as explicit scoped work with appropriate tests; none were changed in this investigation.

## Official voice allowances checked 2026-11-07

| Service | Recurring free amount | Material limits |
|---|---|---|
| Groq Whisper STT | 28,800 audio seconds/day (8 hours), 7,200/hour, 2,000 requests/day, 20/minute | Shared per organization, not per app user; account limits can differ. Arabic transcription supported. This is STT, not voice generation. |
| Google Cloud TTS Standard/WaveNet | 4 million characters/month | Both list the same SKU: do not add them into 8 million. Billing required; automatic charges above allowance. Verify specific Arabic voice/dialect. |
| Google Cloud TTS Neural2 | 1 million characters/month | Specific voice-family allowance, not all Google models. Billing required. |
| Azure Speech | 5 hours realtime STT/month and 500,000 neural TTS characters/month | Requires Azure account/resource; verify F0 region/voice limits. Egyptian Arabic appears in official locale matrix. |
| Gemini Developer API TTS | Free-tier model access | Exact active quota depends on project/model; no guaranteed large universal credit amount verified. Preview and data-use caveats apply. Not the same free allowance as Google Cloud TTS. |
| ElevenLabs Free | 10,000 credits/month | Model-dependent consumption; free content is not commercially licensed. Not an appropriate free commercial backend for this app. |

Recommended evaluation: Groq Whisper for large-volume Arabic input plus Google Cloud TTS for large-volume output if billing activation is acceptable; Azure for explicitly Egyptian-locale voice comparison. No connection, provider signup, billing activation or cloud audio generation was performed.

Sources:
- https://console.groq.com/docs/rate-limits
- https://console.groq.com/docs/speech-to-text
- https://console.groq.com/docs/text-to-speech
- https://console.groq.com/docs/models.md
- https://cloud.google.com/text-to-speech/pricing
- https://cloud.google.com/text-to-speech
- https://azure.microsoft.com/en-us/pricing/free-services
- https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
- https://ai.google.dev/gemini-api/docs/pricing
- https://aistudio.google.com/docs/rate-limits
- https://elevenlabs.io/pricing
- https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform