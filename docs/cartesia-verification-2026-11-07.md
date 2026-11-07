# Cartesia voice verification — 2026-11-07

## Implemented
- The configured Cartesia secret is read only inside an authenticated server handler.
- Voice catalogue exposes names, IDs and languages only. The first 500 account-accessible voices are returned, including 21 Arabic-labelled voices in this verification.
- Sonic 3.6 generates WAV audio using the current documented 2026-08-14 API version.
- Chat reply speaker controls offer voice/language selection, generation, standard playback and download.
- The composer microphone now captures actual audio and transcribes it before adding text to the draft.
- Calls use explicit microphone start/stop, transcription, ordinary agent text submission and Cartesia output on a new completed answer. Browser/device speech synthesis is no longer used.
- End-call/unmount cancels pending output and releases audio URLs and microphone tracks.

## Fresh signed-in checks
- Signed in through the project's configured Supabase client using the authorized test account.
- Catalogue HTTP 200; Arabic and English choices available.
- Generated English and Arabic audio through the application's authenticated client; browser loaded and played both, with nonzero durations.
- Opened an existing real agent reply, selected Arabic/Raed, generated audio and confirmed playback control readyState 4 on mobile. Download link points to that generated WAV.
- Opened the call controls; muting disabled the recording button; ending the call closed the controls.
- Recorded a generated English audio fixture through Chromium's microphone capture interface, stopped recording, received transcription HTTP 200 and saw the resulting message saved in the real chat UI.
- New agent response did not arrive: the previously missing agent-response provider configuration remains a separate blocker. This is not a verified full call round-trip.
- Unauthenticated speech POST returned HTTP 401. No page exceptions observed during these checks.
- Mobile 434×716 and desktop 1280×1800 screenshots inspected; controls fit the viewport.
- All 60 tests across 20 files passed, including seven new speech regressions. Latest available automatic build signal: build OK.

## Limitations
- Recording transcription uses the project's existing Lovable transcription service, not Cartesia STT; Cartesia powers generated speech.
- Explicit record/stop conversations are not interruption-capable full-duplex realtime calls.
- No free allowance is promised or imposed: usage is billed/limited by the configured service accounts.
- WAV playback is real; perceived quality, dialect accuracy and natural-device microphone quality need owner listening tests.
- Publish to deploy the new routes and the securely saved secret to production.
- Rotate the key previously pasted into chat through Cartesia, then re-enter its replacement securely.