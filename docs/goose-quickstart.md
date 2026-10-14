# goose + Kilawatt in 5 minutes

1. Install the Kilawatt extension in goose using [the example extension config](../examples/goose-config.yaml).
2. Start with a `deploy_gpu_node` call using `dry_run: true` to see price and routing without charging.
3. Call `x402_quote` to get the current price and payment details without paying.
4. Before paying, set `KILAWATT_X402_MAX_USD_PER_JOB` and `KILAWATT_X402_MAX_USD_PER_SESSION` to your spend limits.
5. Use a separate small wallet for x402 payments, never your main wallet.
6. Enable the Kilawatt extension in each goose chat where you want to use it.
7. Run one paid job only with `confirm: true`, and set `max_usd` to your own acceptable limit.
8. Check the resulting job with `x402_job_status`.

## Troubleshooting

- If goose cannot start the extension, check that Node.js and `npx` are available and that the extension is enabled.
- If `deploy_gpu_node` reports an authentication problem, check `KILAWATT_API_KEY`. x402 quote calls do not need that key.
- If a payment call is refused, review the quote, `max_usd`, and both spend caps before trying again.
- For other problems, open an issue with the client version and relevant error text. Do not include keys or wallet secrets.
