# Production transactional email

ResumeIQ selects email delivery explicitly with `EMAIL_PROVIDER`:

- `capture` stores deterministic messages for development and tests; production rejects it.
- `resend` sends transactional email through the pinned official Resend Node SDK.
- `disabled` rejects delivery clearly while an environment is unconfigured.

## Resend setup

1. Create a Resend account.
2. Add and verify the sending domain in Resend.
3. Add the SPF and DKIM DNS records displayed by that Resend account. Do not copy example DNS values.
4. Create a restricted API key and store it only in the deployment secret manager.
5. Configure a verified `EMAIL_FROM_ADDRESS` and optional `EMAIL_REPLY_TO`.
6. Configure the externally reachable HTTPS `PUBLIC_APP_URL`.
7. Set `EMAIL_PROVIDER=resend`; retain capture for local development and automated tests.

All variables are documented in `backend/.env.example`. Production startup rejects capture mode, missing Resend settings, unsafe sender fields, and non-HTTPS public URLs. Health endpoints expose only provider type and configured status.

## Operations and security

- Rotate or revoke a potentially compromised key, replace the deployment secret, and restart affected instances.
- Review current provider limitations and rate limits in the Resend dashboard before increasing traffic.
- Delivery is bounded by a timeout and failures are classified. Authentication and permanent-recipient failures are not retryable.
- Tokens occur only in action links and are excluded from subjects, logs, and audit metadata.
- This milestone uses direct bounded delivery. Add a durable transactional outbox/queue with idempotent workers, controlled retries, dead-letter handling, and delivery webhooks before high-volume production use.

No real-provider smoke runs in automated gates. Real delivery requires a verified sender, an explicit test recipient, and a deployment-managed API key.
