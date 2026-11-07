# Current service credentials

Names only; no credential values or derived hints are stored in this report.

## Configured in this project
- `CARTESIA_API_KEY`: generated call and voice-message audio.
- `LOVABLE_API_KEY`: managed Lovable access; current transcription uses this credential.
- `LOVABLE_CRON_SECRET`: managed scheduled endpoint verification.

## Present in external Supabase secrets, unavailable to current TanStack runtime
- `CEREBRAS_API_KEY`: current agent loop; missing prevents actual new model replies.
- `BROWSERBASE_API_KEY`: current agent web search/page reads.
- `COMPOSIO_API_KEY`: current external-service account tools.
- `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`: durable job delivery.
- `APP_URL`: nonsecret published application URL required by job delivery.

The subsequently supplied external Supabase configuration confirms Cerebras, Browserbase, Composio and Inngest credentials already exist there. The app runtime presence checks still report them unavailable. Do not request replacement provider credentials as though they were absent everywhere; the deployment binding must be reconciled. External Supabase Edge secret storage is distinct from the TanStack application secret environment.

Legacy source also references AgentSky, Browser Use, payment and email credentials; those references do not prove the current app uses or has those services configured. Imported Telegram key management is a legacy route and its pools are not consumed by the current agent/audio loop.

## Safe administration requirements
- Telegram may initiate protected credential entry and display internal IDs/status only, never raw keys, key hints, last error bodies, or secret-derived values.
- Current Telegram route must be replaced before activation: it accepts chat-pasted credentials and leaks derived hints, and one legacy pool stores plaintext keys.
- Verify the operator explicitly; no first-message administrator bootstrap. Private admin chat only, authenticated protected entry, encrypted-at-rest storage, no credential fields readable by browser queries.
- Automatic selection must use only provider-authorized independent credentials. Rate limits require backoff; switching keys/accounts to bypass provider limits is not permitted.
- Implemented classification tests distinguish exhausted, invalid, rate-limited, temporary, and request failures. This helper is not yet wired into providers and no key rotation is active.

## Latest audio completion
- Ten owned bots now have ten distinct automatic voice IDs persisted in bot settings.
- Call recording cancellation returns to Ready; unavailable provider response displays an error and restores the recorder.
- Real Arabic voice-message generation/playback and original recording playback verified. Complete model-to-voice round trip remains blocked by Cerebras configuration.