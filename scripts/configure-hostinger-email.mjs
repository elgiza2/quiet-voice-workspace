import { configureHostingerAuth } from "./hostinger-auth-config.mjs";

try {
  await configureHostingerAuth(process.env);
  console.log("Hostinger SMTP settings applied and read back. Inbox delivery still requires a real verification email test.");
} catch (error) {
  // Only known, sanitized errors may be printed; network/library errors can contain credentials.
  const message = error instanceof Error ? error.message : "";
  const safeMessages = [
    "Supabase management authorization is required before activating email.",
    "Required Hostinger configuration is not set.",
    "Hostinger requires the configured TLS SMTP endpoint.",
    "The configured sender must be the authorized Ceyo mailbox.",
    "Email configuration read-back failed; activation is unverified.",
    "Email configuration read-back did not match; activation is unverified.",
  ];
  console.error(safeMessages.includes(message) || /^Email configuration was not applied \(HTTP \d{3}\)\.$/.test(message)
    ? message : "Email setup could not complete. No credentials were logged.");
  process.exitCode = 1;
}