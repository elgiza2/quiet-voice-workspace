# Completion work and live checks — 2026-11-07

## Implemented and checked
- Owner-scoped persistent memory, import/list/delete, retrieval for primary and specialist agents. Test fact survived reload and appeared in a real chat answer; temporary memory was removed afterward.
- Actual text/code/CSV/JSON attachments saved as owner-scoped documents, with read_file, save_file, library search, deletion and download. Uploaded CSV first item was correctly identified; sum was 50; downloaded bytes matched the source.
- Calculator tool performed discount/tax calculation and returned 230.48. This is arithmetic evaluation, **not Python or computer execution**.
- Specialist tool events now persist and reach the parent transcript. Two actual delegate_to_bot calls and two successful calculate calls produced 209.75 and 50; combined response survived reload.
- Empty final answers and exhausted step budgets no longer count as completed work. A web-delegation test did not finish before the test browser closed and remained visibly interrupted; it is not counted as successful web delegation.
- Background polling now uses persisted agent_jobs IDs and the current done/status response contract.
- Daily/weekly routine creation, listing, pause/resume and signed operator execution. A due test routine generated an answer that was read back through chat. A subsequent invocation did no duplicate work. Unsigned request returned 401. Test routine is paused.
- Vault records are account-scoped; full card numbers are rejected and only four digits are accepted. Vault remains local label/contact storage, not encrypted secret storage.
- Primary-bot replacement is connected to the owner-scoped profile update with confirmation; not exercised live to avoid changing the test account's primary bot.
- Desktop and 434×763 mobile checks showed no horizontal overflow; no captured page runtime errors in verified resource flows.
- All 46 tests passed across 15 files. Latest checked preview log: build OK.

## Not complete / external blockers
- Python, shell, interactive computer and computer reset require an isolated execution service. No unsafe in-process evaluator was added and no execution claim is made.
- PDF/image/video analysis needs supported extraction/vision/transcription; unsupported files fail explicitly rather than sending only their filenames.
- Routine automatic timing and jobs after app closure need a reachable published endpoint and scheduler/Inngest configuration. The signed routine runner was manually exercised; automatic triggers are not activated.
- Google Play requires the signed Android package, product IDs and purchase verification authorization.
- Integration actions require the owner's OAuth authorization; no external account was authorized or action sent during these checks.
- Marketing needs consented recipients, content and delivery handling; inbox receipt needs user confirmation. Existing Hostinger verification SMTP was not altered.
- Live voice, transactional onboarding, legal-content verification and native Android/Telegram behavior are not claimed complete by this increment.
- Four pre-existing backend security warnings remain: three security-definer access warnings and disabled leaked-password protection. This migration introduced no new linter warnings.

Test conversations and audit CSV remain on the supplied test account as evidence; no user-facing session tokens or private credentials were saved in project files.