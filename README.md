# Kilawatt Cloud MCP Server

Model Context Protocol (MCP) server for requesting GPU compute capacity from Kilawatt Cloud, with account-based and x402 payment options.

[![Build Status](https://github.com/KilaWattCloud/kilawatt-mcp-server/workflows/Test/badge.svg)](https://github.com/KilaWattCloud/kilawatt-mcp-server/actions)
[![npm version](https://img.shields.io/npm/v/kilawatt-mcp-server)](https://www.npmjs.com/package/kilawatt-mcp-server)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**This server calls the real Kilawatt gateways.** Every response is an actual HTTP result from the Kilawatt public API or the x402 endpoint. There are no fabricated responses.

## Table of contents

- [Works with](#works-with)
- [Endpoint](#endpoint)
- [Installation](#installation)
- [Configuration](#configuration)
- [Use with Claude Desktop / Cursor](#use-with-claude-desktop--cursor)
- [Running the Server](#running-the-server)
- [Available Tools](#available-tools)
- [Error Handling](#error-handling)
- [Links](#links)
- [License](#license)

## Works with

- goose (step-by-step guide: [docs/GOOSE_TUTORIAL.md](docs/GOOSE_TUTORIAL.md))
- Claude Desktop
- Cursor
- LangChain and LangGraph ([example](examples/langchain/kilawatt_langchain.py))
- CrewAI ([example](examples/crewai/kilawatt_crewai.py))
- SkyPilot ([example](examples/skypilot/price_check_then_launch.py))
- Node.js client ([example](examples/node-client/))
- MCP Python SDK ([example](examples/python-sdk/kilawatt_client.py))

All examples are quote-only. See [examples/README.md](examples/README.md).

Client setup steps are in [docs/clients.md](docs/clients.md).

## Endpoint

The default endpoint is Kilawatt Cloud's gateway: `https://www.kilawattcloud.dev/api/public/v1`. Change it with the `KILAWATT_BASE_URL` environment variable.

The discovery and resume tools (`get_capacity`, `get_platform_status`, `get_pricing`, `get_resume_info` and `resume_job`) use the site root instead: `https://www.kilawattcloud.dev`. Change it with the optional `KILAWATT_SITE_URL` environment variable. A trailing slash is removed.

| Variable | Used by | Default |
|----------|---------|---------|
| `KILAWATT_BASE_URL` | `deploy_gpu_node` | `https://www.kilawattcloud.dev/api/public/v1` |
| `KILAWATT_SITE_URL` | `get_capacity`, `get_platform_status`, `get_pricing`, `get_resume_info`, `resume_job` | `https://www.kilawattcloud.dev` |

## Installation

Install and run via npx:

```bash
npx -y kilawatt-mcp-server
```

## Configuration

Set your Kilawatt API key to use `deploy_gpu_node`, `get_resume_info` or `resume_job`. It is not required to start the server, use the x402 tools, or use `get_capacity`, `get_platform_status` and `get_pricing`:

```bash
export KILAWATT_API_KEY=kw_live_YOUR_KEY_HERE
```

The API key must start with `kw_live_`. API keys are issued through your Kilawatt Cloud account. Contact hello@kilawattcloud.dev for assistance if you don't have access to generate keys yet.

## Use with Claude Desktop / Cursor

Add this configuration to your MCP client settings:

```json
{
  "mcpServers": {
    "kilawatt": {
      "command": "npx",
      "args": ["-y", "kilawatt-mcp-server"],
      "env": {
        "KILAWATT_API_KEY": "kw_live_YOUR_KEY_HERE"
      }
    }
  }
}
```

Replace `kw_live_YOUR_KEY_HERE` with your Kilawatt API key when using `deploy_gpu_node`. For x402-only use, omit `KILAWATT_API_KEY`.

Using goose? See [GOOSE.md](GOOSE.md).

## Running the Server

Start the MCP server:

```bash
npm start
```

Or directly:

```bash
node index.js
```

The server listens on stdio for MCP requests from your agent.

## Available Tools

The server exposes nine tools: `deploy_gpu_node`, `x402_quote`, `x402_run_job`, `x402_job_status`, `get_capacity`, `get_platform_status`, `get_pricing`, `get_resume_info` and `resume_job`.

### `deploy_gpu_node`

Provision real GPU compute on Kilawatt Cloud. This starts an actual machine and charges the caller's Kilawatt wallet. Set `dry_run: true` to check pricing and routing without provisioning or charging. Requires `KILAWATT_API_KEY`.

| Parameter | Type | Required | Default | Allowed values | Description |
|-----------|------|----------|---------|----------------|-------------|
| `gpu_type` | string | No | `nvidia-h100` | Any non-empty string up to 64 characters (no enum is checked locally) | GPU model identifier; the gateway decides what it accepts |
| `card_count` | integer | No | `1` | 1 to 64 | Number of GPUs |
| `duration_seconds` | number | No | `600` | 1 to 86400 | How long the node is needed. Billed up front. |
| `routing_policy` | string | No | `lowest_cost` | `lowest_cost`, `lowest_latency`, `zero_quota` | How the smart order router picks a node |
| `dry_run` | boolean | No | `false` | `true`, `false` | Price and pre-authorize only |

```json
{
  "name": "deploy_gpu_node",
  "arguments": { "card_count": 2, "duration_seconds": 1800, "dry_run": true }
}
```

### `x402_quote`

Get the current price and Base USDC payment details for a GPU job without paying.

| Parameter | Type | Required | Default | Allowed values | Description |
|-----------|------|----------|---------|----------------|-------------|
| `gpu_type` | string | No | `nvidia-h100` | `nvidia-b300`, `nvidia-b200`, `nvidia-h200`, `nvidia-h100`, `nvidia-a100`, `nvidia-l40s`, `nvidia-l40`, `nvidia-a40`, `nvidia-a10`, `nvidia-rtx-a6000`, `nvidia-rtx-a5000`, `nvidia-rtx-a4500`, `nvidia-rtx-a4000`, `nvidia-rtx-5090`, `nvidia-rtx-4090`, `nvidia-rtx-3090` | GPU model |
| `card_count` | integer | No | `1` | 1 to 4 for `nvidia-b200`; 1 to 8 for `nvidia-h100`, `nvidia-h200`, `nvidia-a100`, `nvidia-l40s`; 1 to 16 for all others | Number of GPUs |
| `duration_seconds` | number | No | `600` | 60 to 86400 | Job length in seconds |
| `routing_policy` | string | No | not sent | `lowest_cost`, `lowest_latency`, `zero_quota` | Routing policy |
| `workload_type` | string | No | not sent | `agent_exec`, `fine_tune`, `batch_inference` | Workload type |

The published input schema states a maximum of 16 for `card_count`. The tighter per-GPU limits above are enforced in code when the call is made.

### `x402_run_job`

Quote and pay for one GPU job in Base USDC. Takes the same parameters as `x402_quote`, plus:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `max_usd` | number | Yes | Must be greater than 0. Payment is refused above this amount or above either spend cap. |
| `confirm` | boolean | Yes | Must be `true` or nothing is paid. |

### `x402_job_status`

Get the status of a job created through x402, using the API key saved locally by `x402_run_job`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `job_id` | string | Yes | 1 to 128 characters |

### `get_capacity`

Read current GPU capacity data. Read-only. No API key and no arguments. Calls `GET {KILAWATT_SITE_URL}/api/capacity`. If the data is not available right now (HTTP 503 with code `unavailable`), the tool says so.

```json
{ "name": "get_capacity", "arguments": {} }
```

### `get_platform_status`

Read the platform status. Read-only. No API key and no arguments. Calls `GET {KILAWATT_SITE_URL}/api/status`. The result has `status` (`operational`, `degraded`, `incident` or `unknown`), `status_note`, `last_checked`, `status_page` and `latest_test_summary`.

```json
{ "name": "get_platform_status", "arguments": {} }
```

### `get_pricing`

Read indicative USD prices per GPU hour for each GPU tier. Read-only. No API key and no arguments. Calls `GET {KILAWATT_SITE_URL}/api/pricing`. These prices are indicative only. The exact price for a job comes from an unpaid x402 request, for example `x402_quote`.

```json
{ "name": "get_pricing", "arguments": {} }
```

### `get_resume_info`

Check whether a job can be resumed from its last checkpoint. Read-only: nothing is started or charged. Requires `KILAWATT_API_KEY`. Calls `GET {KILAWATT_SITE_URL}/api/jobs/{job_id}/resume-info`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `job_id` | string | Yes | 36 characters, hex digits and dashes. Checked before any request is sent. |

The result has `job_id`, `checkpoint_count`, `last_checkpoint_at`, `can_resume`, `reason` (`null`, `no_checkpoint` or `job_still_running`) and `resume_action`.

```json
{ "name": "get_resume_info", "arguments": { "job_id": "YOUR_JOB_ID" } }
```

### `resume_job`

Start a new paid run that resumes a job from its last checkpoint on a different supplier. **This spends money.** Requires `KILAWATT_API_KEY`. Call `get_resume_info` first and ask the user before confirming. Calls `POST {KILAWATT_SITE_URL}/api/jobs/{job_id}/resume` once and never retries it automatically.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `job_id` | string | Yes | 36 characters, hex digits and dashes |
| `confirm` | boolean | Yes | Must be exactly `true` |
| `max_spend_usd` | number | Yes | Spend cap for the new run. Must be greater than 0. |
| `duration_seconds` | integer | No | 60 to 86400. Sent only when given. |

All of these are checked locally before any request is sent. If a check fails, nothing is sent.

```json
{
  "name": "resume_job",
  "arguments": { "job_id": "YOUR_JOB_ID", "confirm": true, "max_spend_usd": 5 }
}
```

### Differences between `deploy_gpu_node` and the x402 tools

- `gpu_type` is free text (up to 64 characters) in `deploy_gpu_node` but a fixed list in the x402 tools.
- `card_count` allows up to 64 in `deploy_gpu_node` but at most 16 (less for some GPUs) in the x402 tools.
- `duration_seconds` allows 1 to 86400 in `deploy_gpu_node` but 60 to 86400 in the x402 tools.
- `deploy_gpu_node` defaults `routing_policy` to `lowest_cost`; the x402 tools send no routing policy unless you set one.

Tool results are formatted from the real HTTP response returned by the Kilawatt gateway.

### x402 settings

The x402 tools let you request capacity with Base USDC without a Kilawatt account or API key. Spend caps are enforced locally.

The server must be able to read the following environment variables when you use x402 payments:

| Variable | Purpose | Default |
|----------|---------|---------|
| `KILAWATT_X402_PRIVATE_KEY` | Base-compatible wallet key, needed only to pay with `x402_run_job` | Not set |
| `KILAWATT_X402_MAX_USD_PER_JOB` | Maximum price for one paid job | `0.25` |
| `KILAWATT_X402_MAX_USD_PER_SESSION` | Maximum cumulative spend in this server process | `1.00` |
| `KILAWATT_X402_URL` | Override the x402 execution endpoint | Kilawatt production endpoint |

The returned API key is stored at `~/.config/kilawatt/x402-api-key` with restrictive file permissions. It is never shown in tool output. Existing `deploy_gpu_node` still requires `KILAWATT_API_KEY`.

**Use a separate small wallet for x402, and keep its private key out of prompts and shared configuration.** The payer does not need ETH; the facilitator submits the transaction.

For x402 users: Check that your Base wallet has enough USDC and that your spend caps allow the amount.

## Error Handling

All errors are descriptive and indicate whether anything was provisioned or charged. Common scenarios:

- **400 Bad Request**: Invalid arguments (e.g., `card_count` > 64). Fix and retry.
- **401 Unauthorized**: API key missing, malformed, or revoked. Issue a new key in your Kilawatt account or contact hello@kilawattcloud.dev.
- **402 Payment Required**: the payment was not accepted. Check your balance and spend caps, then retry.
- **429 Rate Limited**: Concurrency or rate limit hit. Retry after a delay.
- **503 No Capacity**: No nodes available matching your criteria. Try a different `gpu_type` or smaller `card_count`.
- **Timeout**: Gateway did not respond within 60 seconds. No compute was provisioned; retry if needed.

## Links

- **npm Package:** https://www.npmjs.com/package/kilawatt-mcp-server
- **GitHub Repository:** https://github.com/KilaWattCloud/kilawatt-mcp-server
- **Kilawatt Cloud:** https://kilawattcloud.dev
- **Model Context Protocol:** https://modelcontextprotocol.io

## License

MIT
