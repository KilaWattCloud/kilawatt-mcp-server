# Security

## Reporting a security issue

Email hello@kilawattcloud.dev to report a suspected vulnerability. Do not open a public issue for security reports. Include the affected version and steps to reproduce, and remove any credentials, private keys, or other secrets from the report.

For non-security bugs or feature requests, use the repository issue tracker.

## Local x402 spend caps

The x402 client enforces `KILAWATT_X402_MAX_USD_PER_JOB` and `KILAWATT_X402_MAX_USD_PER_SESSION` locally before sending a payment request. The per-job cap limits one payment, and the per-session cap limits the total amount paid by the running server session. Set each value to a positive amount appropriate for the intended use. These local limits do not replace reviewing payment requests and wallet activity.
