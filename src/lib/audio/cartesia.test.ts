import { afterEach, describe, expect, it, vi } from "vitest";
import { generateSpeech, voiceCatalogue } from "./cartesia.server";
import { speechInput } from "./voiceSchema";

afterEach(() => vi.unstubAllGlobals());
describe("Cartesia multilingual speech", () => {
  for (const language of ["ar", "en", "fr"]) it(`passes ${language} to Cartesia`, async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([82, 73, 70, 70]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await generateSpeech("test-only", { text: "Hello", voiceId: "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4", language });
    expect(response.headers.get("Content-Type")).toBe("audio/wav");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).language).toBe(language);
  });
  it("rejects malformed voice IDs before spending credit", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await generateSpeech("test-only", { text: "Hello", voiceId: "bad" })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns provider credit failures without reporting success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private provider detail", { status: 402 })));
    const response = await generateSpeech("test-only", { text: "Hello", voiceId: "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4", language: "en" });
    expect(response.status).toBe(402);
    expect(await response.text()).not.toContain("private provider detail");
  });
  it("returns multiple voice choices", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [{ id: "one", name: "English", language: "en" }, { id: "two", name: "Arabic", language: "ar" }] })));
    expect((await (await voiceCatalogue("test-only")).json()).voices).toHaveLength(2);
  });
  it("rejects blank speech", () => expect(speechInput.safeParse({ text: " ", voiceId: "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4", language: "ar" }).success).toBe(false));
});