/** Spoken language is detected by the provider, never inferred from the UI locale. */
export function recordingTranscriptionUrl() {
  return "https://api.deepgram.com/v1/listen?model=nova-3&language=multi&smart_format=true&punctuate=true";
}

export async function transcribeOriginalRecording(file: Blob, key: string, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(recordingTranscriptionUrl(), {
    method: "POST", signal,
    headers: { Authorization: `Token ${key}`, "Content-Type": file.type || "audio/webm" },
    body: file,
  });
  if (!response.ok) return Response.json({ error: response.status === 401 || response.status === 403
    ? "Deepgram refused transcription access. Check your provider account."
    : `Recording transcription failed (${response.status}).` }, { status: response.status });
  const result = await response.json() as { results?: { channels?: { alternatives?: { transcript?: string }[] }[] } };
  return Response.json({ text: result.results?.channels?.[0]?.alternatives?.[0]?.transcript || "" }, { headers: { "Cache-Control": "no-store" } });
}