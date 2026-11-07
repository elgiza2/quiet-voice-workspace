# Roadmap

## Voice call repair — 2026-11-07 09:10 UTC
- [x] Reproduced manual Record/Stop requirement: automatic speech-ended submit and post-playback listening added; fixed stale-error suppression and persistent audio playback with manual autoplay recovery.
- [x] Circular neutral call; legacy dialog blue shadow isolated, restore/resize clamped inside conversation.
- [x] Test account: automatic recorded Arabic speech → transcription 200 → agent 15 → speech 200 and actual playback without autoplay bypass; minimize/drag/restore inside 434×764 and desktop checked, no page errors. 22 targeted tests passed; README updated. Physical phone/iOS/Telegram microphone remains unverified.

## Pricing, navigation, calls and chat media — 2026-11-07
- [x] Pricing fits 434×764 for all three plans; preserve prices, cache completed setup in-session and add restrained navigation animation without account-loading text.
- [x] Correct recording MIME and use direct Cartesia transcription; ID-based reply playback, draggable/minimized robot call works through an actual recorded-sample → chat → speech UI test. Latest user goal returned 15; normalize historical speaker/incomplete content.
- [x] Persisted agent-file preview/download, sandboxed drawing preview and local attachment previews added. Agent Sky key saved to service-only Vault; existing media client connected instead of stub.
- [ ] Complete image/video generation verification: Agent Sky returned 402 insufficient_credits; requires provider top-up. Existing paid-plan/credit contracts and missing signing configuration must be integrated without bypassing enforcement before production flow verification.
- [ ] Persist call lifecycle across leaving the chat/app: minimized calls currently persist only while that chat remains mounted, not across page departure or app closure.
- [x] Test account login, no-scroll plans, current-goal answer, real file read-back and full sample-audio call checked; 33 targeted tests passed, screenshots reviewed and README updated with exact limits. Real device microphone, media generation and cross-page calls are not claimed verified.

## Company and legal pages — 2026-11-07
- [x] Complete About, Contact, Privacy, Terms, Subscription Terms, Cookies and Security under Megsy LLC; remove unsupported deadlines/caps and disclose analytics/voice/encryption boundaries.
- [x] Add public navigation, settings links and seven leaf metadata heads; all pages opened signed-out, internal navigation and mail contact verified, mobile/desktop screenshots checked, no page errors/overflow; routing test passed and build OK. README updated. Legal approval and hosted tracking configuration remain unverified.

## Current completion pass — 2026-11-07 08:23 UTC
- [x] Replace the cancelled Telegram connector request with Supabase Vault storage and direct Telegram calls; getMe, webhook, send and service-only Vault permissions verified. No new Lovable credentials.
- [x] Verify signed-in calculation (229.74), Example Domain reading and completed background report saved/read through chat. Composio pool configured; external account execution still awaits owner authorization.
- [x] Add account-load retry and atomic primary-bot/profile completion; two recovery tests passed. Mobile setup display checked using response interception, not a new production account.
- [x] Replace README with the living successor-agent guide, explicit encryption limits, independent-hosting requirements and current verification.
- [x] Reconcile obsolete provider/Inngest blockers below. 22 targeted tests passed; build OK. README names unimplemented work separately.
- [ ] Protected Telegram key-entry and encrypted provider pool remain programming work; current message-based entry is not a secure form. Do not label it complete.
- [ ] Durable job leases/runtime lifetime and production scheduler still need implementation plus a stable hosting endpoint; local completed-job delivery is verified.

## Service credentials and Telegram operations
- [ ] Add Telegram-initiated protected credential entry; current operator identity and Vault bot token are configured, but provider keys still arrive as messages and pool values are plaintext.
- [x] Inventory configured secret names and current versus legacy service dependencies without values; see docs/service-credentials-inventory.md.
- [x] Define Telegram admin scope and secure credential entry outside chat; tested authorized failover classification, not wired into live providers yet.
- [ ] Implement and verify approved administrative alerts and credential-pool failover end-to-end; direct Telegram transport and operator scope now work, legacy connector references are obsolete.
- [x] Reconcile external Supabase service pool with runtime; live Cerebras and Browserbase calls passed. No gateway dependency in Telegram administration.

## Agent voice messages and avatar changes
- [x] Complete call cancellation/error recovery, recoverable catalogue loading and durable automatic bot voices; 10 real bots read back with 10 unique saved voices, cancellation and missing-provider recovery verified.
- [x] Remove speech buttons below text replies and move real voice/language preferences into agent settings; saved Arabic preference read back from the real account.
- [x] Implement automatic user language, distinct bot voices, recording-aware replies and private cached audio. Real Arabic voice-message playback verified; 18 targeted tests passed.
- [x] Remove star avatars and vary bot shapes; mobile/desktop screenshots and recording playback verified without page errors.
- [ ] Verify a new agent reply delivered as a voice message; Cerebras is now configured, this end-to-end audio test remains open. Recordings stay on the sending device.
- [x] Handle missing chat dependencies as explicit terminal error events instead of page-level 503; real recording submission retained the screen and showed a persistent alert. 13 regression tests passed.

## Cartesia voice connection
- [x] Connect authenticated Cartesia voice catalogue and speech generation, keeping credentials private.
- [x] Add voice/language choice, playable downloadable replies, and microphone recording support in current chat/calls.
- [x] Test real Arabic/English generation, endpoint security and playback; 60 tests pass. Recorded speech was transcribed and sent through the signed-in call UI. See docs/cartesia-verification-2026-11-07.md.
- [x] Complete new agent reply spoken in signed-in call; automatic speech-ended turns now verified locally, not full-duplex live audio or a physical-device test.

## Seven deep performance investigations and free voice services
- [x] Complete seven independent source investigations and signed-in mobile/desktop performance measurements.
- [x] Identify measured causes separately from unverified candidates and document prioritized remedies in docs/performance-and-voice-2026-11-07.md; no performance changes applied in this diagnostic request.
- [x] Compare official AI voice free allowances, Arabic support and account/payment limitations; provider connection and audio quality are not verified.

## Full verification and real computer — current request
- [x] Sign in and check real home/history, settings, pricing, memory and Vault save/read-back; current chat failed on missing Cerebras configuration. See current verification report for exact coverage.
- [x] Repair account-loading recovery, unsafe execution and misleading controls; add regression tests, repeat affected live checks, and harden legacy source guards.
- [x] Restore current chat/web provider configuration; live calculation and page reading passed. External integration account authorization remains separate.
- [ ] Connect isolated computer execution; blocked on authorized execution-provider configuration and owner-scoped integration.
- [ ] Finish agent-mediated file/group/delegation, voice/native/payment/scheduled tests; blocked on service/owner/platform configuration.
- [ ] Verify legacy security fixes on the hosted backend and rotate the exposed provider credential; user-managed deployment/provider access unavailable here.
- [ ] Complete /chat/not-found routing review, legal approval and legacy security repairs; transactional onboarding is now implemented and tested for recovery.
- [x] Record tested outcomes, source-versus-hosted distinction and remaining limitations in docs/current-verification-2026-11-07.md.

## Pricing and Vault reference redesign
- [x] Match pricing layout and selection controls to the supplied screenshots without changing prices or payment behavior.
- [x] Match Vault categories, list and add-item forms to the supplied screenshots while retaining account-scoped safe storage.
- [x] Verify mobile/desktop appearance in an isolated rendering of the actual components; plan switching, safe card-label add and search passed, along with nine existing tests. Real-account checks remain unavailable for the external unmanaged backend.

## Complete audited gaps — current request
- [x] Repair persistent memory; imported fact persisted after reload and was recalled through signed-in chat.
- [x] Send actual text/code/CSV/JSON contents; uploaded CSV read correctly and downloaded contents matched. Binary image/video/PDF analysis remains blocked on a supported analysis service.
- [x] Reject empty/exhausted completions, retain delegation transcripts and align job-ID polling. Two specialists returned 209.75 and 50; combined answer persisted after reload.
- [x] Connect daily/weekly routine creation, management and signed execution; a due routine produced a persisted chat answer, duplicate invocation did no work, unsigned invocation returned 401.
- [ ] Automatic routines and durable jobs after app closure require stable hosting and scheduler plus running-job recovery; Inngest was removed. Local background result delivery is verified.
- [x] Make Vault account-scoped and enforce last-four-only card labels; validation tests passed. Local Vault is not a password or credential store.
- [ ] Connect actual computer/code execution; blocked until an isolated execution service is available.
- [ ] Activate Google Play purchases; blocked on signed Android app, Play products and verification credentials.
- [ ] Verify external account actions; blocked on account-owner OAuth approval.
- [ ] Verify marketing and inbox delivery; blocked on recipient consent/campaign content and inbox confirmation.

## Full live audit — 2026-11-07
- [x] Sign in to the supplied test account; exercise chat, team creation, simple delegation, complex research and computer requests through the live UI.
- [x] Review settings, memory, integrations and remaining app features; all 38 existing tests passed.
- [x] Record evidence and incomplete features in `docs/live-audit-2026-11-07.md`; this audit did not repair application code.

## Google Play and owned-domain email
- [ ] Configure Android billing for package `si.ceyo.app`; real activation requires Play product IDs, authorized purchase verification, and a signed Android application.
- [x] Store Hostinger SMTP settings as secrets and add an operator-only script to configure native Supabase Auth with read-back verification.
- [x] Activate Hostinger verification email on hosted Supabase Auth; settings applied and read back, OTP send accepted.
- [ ] User confirms the verification email arrived in the inbox from support@ceyo.si.
- [ ] Marketing mail via owned Hostinger mailbox remains separate from Auth and subject to provider limits; campaign sending is not configured.

## Ceyo executable agents
- [x] Make the chat composer smaller and hide its inner scrollbar.
- [x] Update the Composio project key through the secure form; account and tool listing API checks returned 200.
- [x] Fix duplicate thinking loaders and shifting message positions during live sends and history reconciliation; targeted tests passed.
- [x] Add real bot/group creation, role assignment and persistent delegation results to the primary agent.
- [x] Connect Composio account management and integration approval cards inside chat with multiple accounts per app.
- [x] Secure Inngest serving and durable idempotent result delivery; unsigned requests rejected.
- [ ] Inngest synchronization: app.ceyo.si does not resolve, confirmed by Inngest's sync response; publish/connect the domain first. Inline work remains available.
- [x] Authenticated bot/group creation and simple delegation checked using the supplied test account; Gmail authorization card rendered.
- [ ] Complete integration OAuth and real execution: account-owner authorization is required; not performed during the audit.
- [ ] Arbitrary code execution/full bot computer: only Browserbase web reading is configured; a code-execution service is not connected.
- [x] Run targeted message, tool-input and steering tests.

- [x] Fix old chat loading character and keep sent messages visible during history refreshes; four targeted tests passed. Authenticated live-chat verification is unavailable for the external unmanaged backend.

- [x] Make the signed-in home a Grok-style bot/group hub with the existing animated characters.
- [x] Add bot/group creation, categories, hidden chats, global search, profiles and editing while preserving real agent chats.
- [x] Verify the new hub on mobile/desktop and run seven targeted tests; authenticated end-to-end coverage remains limited by the external unmanaged backend.

- [x] Redesign Tasks with Orange point icon and five character images; restrict active tasks to the five requested types.
- [x] Remove main Agents +; remove Earn tasks and rename Earn to Referral with Telegram-only invite links.
- [x] Inline manual TON/USDT-TON checkout; strict reference matching and atomic settlement with transaction reuse prevention.
- [x] Synchronize returning Telegram profile photos and fullscreen/safe-area events; native Back navigation.
- [x] Remove visible old sharing/help branding; restore readable shimmering thinking text.
- [x] 13 targeted tests passed; public Tasks and inline Crypto navigation checked on mobile without runtime errors.
- [ ] Real transfer and authenticated read-back: unavailable without a real payment/session; other networks are disabled pending reliable verification.
- [ ] X follow and ORANGE purchase rewards: require X account verification and cryptographic wallet ownership proof; opening links never grants points.
- [ ] Verify fullscreen, native Back and profile image inside an actual Telegram client.

- [x] Rename Megsy/Nova AI → Orange AI (UI + translations + support links @Torekr)
- [x] Telegram login (Mini App initData → session) + /api/public/telegram-auth
- [x] Reward tasks migration (telegram_join, daily_checkin; old Trustpilot/X tasks deactivated)
- [x] /tasks page — server-verified completion, credits awarded by /api/tasks/complete
- [x] Telegram button on the sign-in page
- [x] Crypto wallet addresses saved as secrets (TON / ETH / BSC / SOL / TRON)
- [x] crypto_payments migration
- [x] /api/crypto/invoice — invoice creation + on-chain verification + fulfilment
- [x] Legacy crypto page now uses the manual panel; current checkout keeps crypto inline.
- [x] Bot /start auto-link: webhook route deployed and registered (verified via getWebhookInfo)
- [x] New bot token: TELEGRAM_BOT_TOKEN secret replaced
- [x] Bot admin panel /101 — user count + add/edit/delete tasks (name, link, image)
- [x] Bot /start welcome image + two daily channel posts (English, bold captions, Open Orange AI button) + admin "post now" button
- [x] Orange AI logo + favicon/icons applied from the uploaded circular logo
- [x] reward_tasks image_url column + tasks UI shows task image
- [ ] Additional payment networks require transaction-specific secure verification; wallet-connect is no longer requested.
- [ ] Publish (Vercel token exposed in chat — do not use; publish via Lovable instead)

- [x] Start message rewrite (bold, characters, community + buy ORANGE buttons), daily user notifications, Telegram-only login, full-screen Mini App with top safe area
- [ ] Confirm /start and daily notification in real Telegram
- [x] Short start message + characters image, fixed broken images on Vercel, tasks (channel/X/ORANGE) with verification, Telegram Back button, crypto replaces Google Pay
- [ ] Bot must be admin in @oraien for channel-join verification
- [x] Tasks entry in app menu, real full screen, Telegram back button, crypto page Buffer crash, start image characters together, combined crypto icon
- [x] Tasks page: compact rows (image, name, Go button)
- [x] Telegram profile photo not showing
- [x] Chat thinking text not showing
- [x] Remove two extra buttons next to copy/like/dislike in chat
- [ ] Real TON/USDT wallet payment test (needs user's wallet)
- [x] New tasks added via bot appear in the app tasks page (allowlist removed, image_url used)
- [x] Regenerated 5 task images sized for small circular rows
- [x] Welcome post published to channel (msg 375, button opens Mini App via t.me/Noveaibot?startapp)
- [x] Channel post button opens Mini App
- [x] Deleted 10 oldest Vercel projects (all 204)
- [x] Vercel account blocked (fair use) — published on Lovable instead: https://nova-quest-rewards-hub.lovable.app
- [x] Updated all links (manifest, bot, TON payment, slides) to the Lovable URL
- [x] Webhook + menu button re-registered with secret token; /start verified (200 ok)
- [x] Telegram sign-in race fix shipped in this publish
- [x] One-off channel post scheduled for 2026-10-24 02:00 UTC (fires on next bot traffic)

## Ceyo full rebuild
- [x] Fix settings scrolling on mobile and verify the full settings list can reach its footer.
- [x] Match the settings home, Account, Usage and Vault screens to the supplied references.
- [x] Add Bot Computer and Permissions screens with persistent local rules.
- [x] Finish Devices, Import Memory, Appearance and Language controls.
- [x] Verify all settings screens and local interactions on a 390px mobile viewport with no page errors.
- [ ] Bot Computer reset requires a connected backend computer; permission rules currently persist locally and authenticated memory/device actions need a real external session.
- [x] New Ceyo landing page
- [x] Remove all old pages from the app; rename to Ceyo, English UI, no "AI" wording

## Group chat (Grok-style)
- [x] Chat screen: floating header pill, bubbles per bot, mentions, working line, error toast, swipe for times
- [x] Long-press message sheet: reactions, reply, mark unread, copy, select, request ID, report
- [x] Find in chat bar
- [x] Group profile, Routines, Library, Members, Edit name, Avatar (upload; generate not connected)
- [x] Smoother page-open animation

- [x] Ceyo: black sign-in, redesigned verification-code screen, Megsy text replaced, old unreachable pages removed.
- [x] Compact pricing, bot edit voice/speed/language, bot profile Computer/Notifications/Share as Template, chat + attachments menu, faster bottom-sheet page opens.
- [ ] Replace Primary Bot: needs backend support to change the primary bot.
- [x] Text/code/CSV/JSON attachments now persist with actual contents and the agent reads them with read_file; binary media analysis is not connected.
- [x] Remove New conversation from chat + menu.
- [x] Polish edit-bot fields and pricing; stop preloading and delete all remaining old pages and their unused code.

- [x] Clean unused files; integration + question cards in chat.
- [x] Mic recording animation; empty composer shows voice-call button (1:1 chats only) with Grok-style call bar.

- [x] Subscription management page (Premium): Google Play manage/cancel + change plan.
- [x] Clone legal + docs pages into Ceyo: grok-bot terms, X subscription terms, privacy policy, docs overview (https://cursor.com/en-US/terms/grok-bot, https://x.ai/legal/x-subscription-terms-of-service, https://x.ai/legal/privacy-policy, https://docs.x.ai/grok-bot/overview).

- [x] Deep clean: removed Megsy referral pages/assets, invite-code logic, old notes; new clean database tables (profiles, roles, bots, groups, chats, settings)
- [ ] Remove unused old server functions (payments/media) — blocked by tool restriction
- [ ] App still reads the old backend address; reconnect the Supabase project in Lovable settings

- [x] Single robot loader with rotating text, hides instantly; no "Used tool" lines or empty reply rows; chat stays pinned while replies grow.
- [x] Stop endless reply retries when a reply fails.
- [x] Verified signed-in: team request creates group + role-named members; group delegation with live web research replies.
- [x] Audit computer/code, imported memory and app connection: computer/code disconnected, memory endpoint returned 404, Gmail card rendered; details in the live audit report.
- [x] Floating chat composer (messages scroll beneath it)

- [x] Fix lag + reply restarting from the beginning (group chat stream)
- [x] Home header: transparent, no borders, floating buttons
- [x] Replace Inngest with free built-in background jobs
