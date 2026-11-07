# Hostinger email for Ceyo

Verification continues to use native Supabase Auth (`signInWithOtp` / `verifyOtp`).
SMTP credentials must never be sent to a browser or committed to an environment file.

## Secure configuration

The secret store holds `HOSTINGER_SMTP_HOST`, `HOSTINGER_SMTP_PORT`,
`HOSTINGER_SMTP_USER`, `HOSTINGER_SMTP_PASSWORD`, `HOSTINGER_SMTP_FROM`, and
`HOSTINGER_SMTP_SENDER_NAME`. The mailbox is support@ceyo.si, using
smtp.hostinger.com with TLS on port 465.

To activate the hosted Auth configuration, provide `CEYO_SUPABASE_MANAGEMENT_TOKEN`
securely from https://supabase.com/dashboard/account/tokens using an account
authorized to manage project `kcrssdgsefhpzoidlhhm`. This is a management token,
not an anonymous or service-role API key.

Run in a trusted operator environment that has the above secrets:

```sh
bun scripts/configure-hostinger-email.mjs
```

The script updates only SMTP fields through the Supabase Management API, then
reads them back. It never prints provider response bodies or credentials.
It is not exposed through an app endpoint. Remove the management token from the
project secret store after successful configuration if no further changes are needed.

Editing local `supabase/config.toml` alone does not activate hosted SMTP.
Do not bypass Supabase authentication or fabricate a local verification code.

## Verification and limitations

After activation, request a verification email through the real sign-in page,
confirm receipt in the recipient inbox and complete code verification. Successful
configuration read-back is not proof of inbox delivery. Supabase Auth and
Hostinger sending limits still apply; this setup does not bypass those limits.

Marketing mail is not sent by Supabase Auth. No bulk-mail endpoint or marketing
campaign sender is introduced by this setup.