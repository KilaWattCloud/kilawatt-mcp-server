# Frequently asked questions

## What happens when a spend cap is hit?

`x402_run_job` checks the quoted price against `max_usd`, `KILAWATT_X402_MAX_USD_PER_JOB`, and the remaining `KILAWATT_X402_MAX_USD_PER_SESSION` allowance before it sends a paid request. If a limit is exceeded, it refuses the job and no payment is made. Set positive spend-cap values before starting the server. The session cap applies to the current server process.

## Why use a separate small wallet?

`x402_run_job` uses the configured wallet to authorize payments. A separate small wallet limits exposure if a key is misconfigured or misused. Never use your main wallet for testing, and do not put private keys in prompts or shared configuration. For x402 users: Check that your Base wallet has enough USDC and that your spend caps allow the amount.

## What does `dry_run` do?

`dry_run: true` on `deploy_gpu_node` asks the gateway to check price, routing, and authorization without provisioning capacity or charging. For x402, use `x402_quote` to view the price and payment details without paying.

## What can the tools do?

There are four tools: `deploy_gpu_node`, `x402_quote`, `x402_run_job` and `x402_job_status`. They provision compute capacity and report job information. They do not accept or run user code or commands. See the [README tool reference](../README.md#available-tools) for parameters.

## Why do `deploy_gpu_node` and the x402 tools accept different values?

`deploy_gpu_node` takes a free-text `gpu_type`, `card_count` up to 64 and `duration_seconds` from 1. The x402 tools use a fixed `gpu_type` list, `card_count` up to 16 (4 for `nvidia-b200`, 8 for `nvidia-h100`, `nvidia-h200`, `nvidia-a100` and `nvidia-l40s`) and `duration_seconds` from 60. Both accept the same `routing_policy` values: `lowest_cost`, `lowest_latency`, `zero_quota`.

## How do I change the endpoint?

Set `KILAWATT_BASE_URL` to override the default Kilawatt Cloud gateway used by `deploy_gpu_node`. The default is `https://www.kilawattcloud.dev/api/public/v1`. For the x402 execution endpoint, use `KILAWATT_X402_URL`. Restart the MCP server after changing environment values.

## How do I report a problem or vulnerability?

For a general problem, open an issue in the [GitHub issue tracker](https://github.com/KilaWattCloud/kilawatt-mcp-server/issues). For a potential security vulnerability, follow the instructions in [SECURITY.md](../SECURITY.md).
