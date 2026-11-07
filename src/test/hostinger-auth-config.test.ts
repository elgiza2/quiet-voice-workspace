import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Operator module deliberately stays outside the application bundle.
import { buildHostingerAuthConfig, configureHostingerAuth, projectRef } from "../../scripts/hostinger-auth-config.mjs";

const settings = {
  HOSTINGER_SMTP_HOST: "smtp.hostinger.com",
  HOSTINGER_SMTP_PORT: "465",
  HOSTINGER_SMTP_USER: "support@ceyo.si",
  HOSTINGER_SMTP_PASSWORD: "test-only-not-a-credential",
  HOSTINGER_SMTP_FROM: "support@ceyo.si",
  HOSTINGER_SMTP_SENDER_NAME: "Ceyo",
  CEYO_SUPABASE_MANAGEMENT_TOKEN: "test-only-not-a-credential",
};

describe("Ceyo Hostinger Auth configuration", () => {
  it("uses Hostinger TLS port 465", () => {
    const config = buildHostingerAuthConfig(settings);
    expect(config.smtp_host).toBe("smtp.hostinger.com");
    expect(config.smtp_port).toBe("465");
    expect(() => buildHostingerAuthConfig({ ...settings, HOSTINGER_SMTP_PORT: "25" })).toThrow();
  });
  it("uses only the support@ceyo.si mailbox as sender and login", () => {
    const config = buildHostingerAuthConfig(settings);
    expect(config.smtp_admin_email).toBe("support@ceyo.si");
    expect(config.smtp_user).toBe("support@ceyo.si");
    expect(() => buildHostingerAuthConfig({ ...settings, HOSTINGER_SMTP_FROM: "other@example.com" })).toThrow();
  });
  it("does not disable verification or change sending limits", () => {
    expect(Object.keys(buildHostingerAuthConfig(settings)).sort()).toEqual([
      "smtp_admin_email", "smtp_host", "smtp_pass", "smtp_port", "smtp_sender_name", "smtp_user",
    ]);
  });
  it("requires management authorization without contacting the provider", async () => {
    const request = vi.fn();
    await expect(configureHostingerAuth({ ...settings, CEYO_SUPABASE_MANAGEMENT_TOKEN: "" }, request)).rejects.toThrow("authorization");
    expect(request).not.toHaveBeenCalled();
  });
  it("applies settings to the connected project and verifies their read-back", async () => {
    const request = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({
      ok: true, json: async () => buildHostingerAuthConfig(settings),
    });
    await expect(configureHostingerAuth(settings, request)).resolves.toEqual({ configured: true });
    expect(request.mock.calls[0][0]).toBe(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`);
    expect(projectRef).toBe("kcrssdgsefhpzoidlhhm");
    expect(request.mock.calls[0][1].method).toBe("PATCH");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("never reports mismatched read-back as successful activation", async () => {
    const request = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await expect(configureHostingerAuth(settings, request)).rejects.toThrow("unverified");
  });
});