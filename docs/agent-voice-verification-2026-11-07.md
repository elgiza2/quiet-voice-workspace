# Agent voice messages — verification

- Signed in with the supplied test account. Removed text-reply speech controls and verified none appear in chat.
- The real Cartesia catalogue provided 500 voices. Saved Arabic in the primary bot settings and read it back through the bot API. Calls contain no voice/language selectors.
- Recorded the microphone fixture, transcribed it, sent it as a recording-origin message and rendered the original private recording in the chat. Audio duration around 3.1 seconds, readyState 4.
- Generated real Arabic speech through the actual VoiceMessage component using the saved bot preference. Duration 2.8 seconds, readyState 4, playback running. This component check was separate from a new model answer.
- Mobile 434×764 and desktop 1280×1800 inspected. No page errors. Avatars showed cloud, diamond, pebble, circle and heart variations, not stars.
- 18 targeted tests passed. Leaf content route metadata inspected and retained.

## Limitations

- The new-message chat request returned 503 because Cerebras is not configured. A complete agent-generated reply-to-recording flow therefore remains unverified and unavailable until that existing service is configured.
- Original user audio and generated reply blobs are private browser IndexedDB records. User audio is playable on the sending device only; no cross-device audio storage was added. Transcripts and recording origin persist in owner-scoped message records.
- Voice replies prefer ordinary concise conversational answers; code or over-5000-character answers stay text, and failed/incomplete agent turns are not spoken as successful answers.