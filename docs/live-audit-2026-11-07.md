# Ceyo live audit — 2026-11-07 UTC

## Scope and verdict

Authenticated live checks used the supplied test account on the local preview, with desktop 1280×1800 and mobile 434×763 views. Source review covered the current agent, settings and remaining reachable features. This is a test report, not a claim that every feature works or that any reported defect was repaired.

**Verdict: the app is not feature-complete.** Real chat and bot/group persistence work, but full computer use, code execution, usable imported memory, attachments, routines and purchasing are incomplete or disconnected.

## Live checks

| Check | Observed result |
| --- | --- |
| Test-account password sign-in | Supabase returned HTTP 200; signed-in home loaded. |
| Existing chat history | Displayed after sign-in and reopening. |
| Arithmetic + website task | Returned the correct rounded amount, 230.48, and Example Domain. Persisted tool metadata contained a web tool call/result, not Python execution. The answer falsely claimed Python ran locally. |
| Create a two-member team | Created `فريق تدقيق المصادر` with `الباحث` and `المراجع`; all remained visible after reload. |
| Complex combined creation/research/review task | A researcher answer was persisted, but no final combined response was visible in the primary chat during the observation window. Do not count this as end-to-end success. |
| Simpler group delegation | Reviewer received a real task; group answered 229.74, retained after reload. |
| Imported memory | Add form accepted input, but direct authenticated read-back of `user_knowledge` returned HTTP 404. The agent could not recall the test fact. Import is not verified as saved and recall failed. |
| Computer reset | Screen/confirmation exist; implementation reports no connected computer and does not invoke a reset service. |
| Integration catalogue | Loaded with zero connected accounts; Gmail search worked. |
| Agent connection request | A real Gmail authorization card rendered. Authorization was not completed; no messages were sent. |
| Settings navigation | Account, usage, permissions, devices, appearance, language, subscription, memory and computer screens opened. No captured page runtime errors. |
| Mobile settings | Body width equalled 434px viewport width; no horizontal overflow in checked view. |
| Documentation/privacy | Reachable, but include unsupported/copied claims about persistent computers, platforms, subscriptions and corporate identity. Legal review and factual rewrite are needed. |

Temporary imported-memory cleanup was attempted; the unavailable table prevented confirmation. The test team and chat history remain on the test account as audit evidence. No purchases, external email sending, account deletion, or external posting were performed.

## Source-review findings

1. **Computer/code:** central `/api/ceyo-chat` uses the Cerebras loop with web/workspace/integration tools, not older computer/developer runtimes. No Python, shell, filesystem or interactive browser tool is connected to this loop. Browserbase reading is not a persistent computer.
2. **Background work:** Inngest configuration is absent in the local environment. Inline fallback cannot establish reliable execution after app closure. Client polling also uses an obsolete request/response contract.
3. **Delegation:** specialist streaming events are discarded, so connection/approval/question cards may be lost; specialist tool transcripts are not retained. Approval executes one action without automatically resuming the remaining multi-step goal.
4. **Completion:** step exhaustion can end without a clear incomplete state; a tool result can allow an empty final answer to be persisted.
5. **Attachments:** selected files are sent as filenames, not file contents; stored image references are not included in the central model history.
6. **Memory:** central history is limited to 30 messages. Imported memory has no reader in the current source; specialists start fresh conversations for each delegation.
7. **Permissions:** settings rules are local preferences, not enforcement of agent operations. Integration approval has separate server-side owner/account/claim checks.
8. **Vault:** browser storage is plaintext and not scoped to the account. Card-details input does not enforce last-four-only content. Do not store sensitive credentials or full card data here.
9. **Payments:** current plan selection only reports that payments are coming soon. Google Play billing activation still requires a signed Android application, products and authorized purchase verification.
10. **Voice:** browser speech recognition/synthesis rather than a real-time voice service; bot voice settings are not passed to the call implementation. Microphone operation was not live-tested.
11. **Routines/files library:** UI empty states are not connected to the available scheduler/file services.
12. **Onboarding:** bot insertion and profile update are not atomic; retry can create duplicate bots. Failure handling can route incorrectly or leave an empty view.
13. **Metadata/routing:** canonical construction can produce protocol-relative invalid URLs; detailed content metadata is client-side. Unknown paths redirect home rather than returning real not-found pages.

## Automated and security checks

- Existing suite: **14 test files, 38 tests passed**.
- Preview build log: latest checked entry reported `build OK`.
- Browser runs captured no page runtime exceptions; this does not prove absence of functional failures.
- Quick backend scan reported an unrestricted avatars download policy and disabled leaked-password checking. Public profile avatars may intentionally be public; bucket contents and intended visibility must be verified before changing this policy. No security policies were changed and no deep security scan was started.
- Tests cover helpers and selected regressions, not all real payment, OAuth, memory, computer, attachment or voice flows.

## Not verified / blockers

- Interactive computer/code execution: no connected execution service in the primary agent.
- Imported memory: missing/unavailable `user_knowledge` endpoint and no agent retrieval path.
- Real integration execution: account needs to be authorized by its owner.
- Purchases: Android packaging, Play products and purchase-verification credentials still required.
- Durable background work: deployment synchronization and job credentials required.
- Inbox receipt, marketing campaigns, native Android/Telegram behavior and real payments remain unverified.

## Evidence locations

Browser screenshots, session-free result logs and test output were captured under `/tmp/browser/audit/`. These are temporary sandbox diagnostics, not public app assets. Session material must never be copied into app files or downloadable reports.