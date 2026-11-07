# Security

_Last updated: November 7, 2026_

Security information for Ceyo, operated by **Megsy LLC**.

## Account & workspace access
Sign-in sessions and account-scoped access rules restrict workspace data. Connected-service actions must use an authorized account; operations that change external data require the relevant approval flow. Review approvals carefully and disconnect services you no longer need.

## What encryption does — and does not — cover
Hosted network traffic uses HTTPS. Chats, memories and documents are **not end-to-end encrypted**; relevant content is processed by the services needed to generate a response. Device-local Vault labels and voice recordings are not an encrypted password vault. Do not use them for private keys, recovery phrases, full payment-card details or passwords.

## Service credentials
Service credentials are restricted to server-side operations. The Telegram administration token uses Supabase Vault with server-only access. This does not mean every service credential is stored using application-level encryption; the provider-key pool currently relies on server access restrictions. This page does not claim independent certification, a completed external audit or that all security risks have been eliminated.

## Reporting a concern
Email [CEO@megsyai.com](mailto:CEO@megsyai.com) with the affected page, approximate time and steps to reproduce. Use your own test data. Do not access other accounts, disrupt the service or publish secrets while investigating. Reporting does not authorize activity that would otherwise be unlawful or unauthorized. No paid bug-bounty program or guaranteed response period is established by this notice.

## Protect your account
Keep your email and sign-in credentials secure. Never share sign-in codes or session tokens. Confirm recipients and destinations before approving an agent action. If a secret has been exposed, revoke or rotate it with the issuing service; deleting the message alone is not sufficient.

See [Privacy Policy](/privacy) for processing information and [Contact](/contact) for account assistance.