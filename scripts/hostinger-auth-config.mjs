// Operator-only module. Never import this into the browser or a public endpoint.
export const projectRef = "kcrssdgsefhpzoidlhhm";

export function buildHostingerAuthConfig(env) {
  const required = [
    "HOSTINGER_SMTP_HOST", "HOSTINGER_SMTP_PORT", "HOSTINGER_SMTP_USER",
    "HOSTINGER_SMTP_PASSWORD", "HOSTINGER_SMTP_FROM", "HOSTINGER_SMTP_SENDER_NAME",
  ];
  if (required.some((name) => !env[name])) {
    throw new Error("Required Hostinger configuration is not set.");
  }
  if (env.HOSTINGER_SMTP_HOST !== "smtp.hostinger.com" || env.HOSTINGER_SMTP_PORT !== "465") {
    throw new Error("Hostinger requires the configured TLS SMTP endpoint.");
  }
  if (env.HOSTINGER_SMTP_USER !== "support@ceyo.si" || env.HOSTINGER_SMTP_FROM !== "support@ceyo.si") {
    throw new Error("The configured sender must be the authorized Ceyo mailbox.");
  }
  return {
    smtp_host: env.HOSTINGER_SMTP_HOST,
    smtp_port: env.HOSTINGER_SMTP_PORT,
    smtp_user: env.HOSTINGER_SMTP_USER,
    smtp_pass: env.HOSTINGER_SMTP_PASSWORD,
    smtp_admin_email: env.HOSTINGER_SMTP_FROM,
    smtp_sender_name: env.HOSTINGER_SMTP_SENDER_NAME,
  };
}

export async function configureHostingerAuth(env, request = fetch) {
  if (!env.CEYO_SUPABASE_MANAGEMENT_TOKEN) {
    throw new Error("Supabase management authorization is required before activating email.");
  }
  const config = buildHostingerAuthConfig(env);
  const url = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
  const headers = {
    Authorization: `Bearer ${env.CEYO_SUPABASE_MANAGEMENT_TOKEN}`,
    "Content-Type": "application/json",
  };
  const response = await request(url, {
    method: "PATCH", headers, body: JSON.stringify(config), signal: AbortSignal.timeout(30_000),
  });
  // Never print response bodies: management APIs can return SMTP credentials.
  if (!response.ok) throw new Error(`Email configuration was not applied (HTTP ${response.status}).`);
  const verification = await request(url, { headers, signal: AbortSignal.timeout(30_000) });
  if (!verification.ok) throw new Error("Email configuration read-back failed; activation is unverified.");
  const current = await verification.json();
  const matches = current.smtp_host === config.smtp_host && String(current.smtp_port) === String(config.smtp_port)
    && current.smtp_user === config.smtp_user && current.smtp_admin_email === config.smtp_admin_email
    && current.smtp_sender_name === config.smtp_sender_name;
  if (!matches) throw new Error("Email configuration read-back did not match; activation is unverified.");
  return { configured: true };
}