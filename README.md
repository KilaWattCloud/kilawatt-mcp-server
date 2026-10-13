# Kilawatt Cloud provides GPU compute capacity through an MCP server.
The default endpoint is Kilawatt Cloud's gateway: `https://www.kilawattcloud.dev/api/public/v1`.

[![Build Status](https://github.com/KilaWattCloud/kilawatt-mcp-server/workflows/Test/badge.svg)](https://github.com/KilaWattCloud/kilawatt-mcp-server/actions)
[![npm version](https://img.shields.io/npm/v/kilawatt-mcp-server)](https://www.npmjs.com/package/kilawatt-mcp-server)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Model Context Protocol (MCP) server for Kilawatt Cloud GPU provisioning. Enables Cursor, Claude Desktop, and other AI agents to programmatically request and manage real GPU compute nodes.

**This server calls the real Kilawatt gateways.** Every response is an actual HTTP result from the Kilawatt public API or the x402 endpoint. There are no fabricated responses.

## Works with

- goose
- Claude Desktop
- Cursor

## Endpoint

The default endpoint is Kilawatt Cloud's gateway: `https://www.kilawattcloud.dev/api/public/v1`. Change it with the `KILAWATT_BASE_URL` environment variable.

## Installation

Install and run via npx:

```bash
npx -y kilawatt-mcp-server
```

## Configuration

Set your Kilawatt API key to use `deploy_gpu_node`. It is not required to start the server or use the x402 tools:

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

### `deploy_gpu_node`

Provision real GPU compute on Kilawatt Cloud. This immediately charges the caller's Kilawatt wallet and starts an actual machine. Set `dry_run: true` to validate pricing, routing, and account balance without provisioning.

**Parameters:**

| Parameter | Type | Required | Default | Range | Description |
|-----------|------|----------|---------|-------|-------------|
| `gpu_type` | string | No | server default | N/A | GPU model identifier supported by the endpoint |
| `card_count` | integer | No | `1` | 1–64 | Number of GPUs to provision |
| `duration_seconds` | number | No | `600` | 1-86400 | How long the node is needed, in seconds. Billed up front. |
| `routing_policy` | string | No | `"lowest_cost"` | `lowest_cost`, `lowest_latency`, `zero_quota` | How the smart order router picks a node |
| `dry_run` | boolean | No | `false` | N/A | Price and pre-authorize only. Returns cost estimate and routing order without provisioning or charging. |

**Example: Deploy 4 GPUs for 1 hour at lowest cost**

```javascript
{
  "name": "deploy_gpu_node",
  "arguments": {
    "card_count": 4,
    "duration_seconds": 3600,
    "routing_policy": "lowest_cost",
    "dry_run": false
  }
}
```

**Example: Dry-run to check pricing**

```javascript
{
  "name": "deploy_gpu_node",
  "arguments": {
    "card_count": 2,
    "duration_seconds": 1800,
    "dry_run": true
  }
}
```

Tool results are formatted from the real HTTP response returned by the Kilawatt gateway.

### x402 tools

The x402 tools let you request capacity with Base USDC without a Kilawatt account or API key:

- `x402_quote` checks the current price and payment details without paying.
- `x402_run_job` quotes and pays for one GPU job. It requires `confirm: true` and a positive `max_usd`; payment is refused above that amount or either configured spend cap.
- `x402_job_status` checks a paid job using the API key saved locally by `x402_run_job`.

The server must be able to read the following environment variables when you use x402 payments:

| Variable | Purpose | Default |
|----------|---------|---------|
| `KILAWATT_X402_PRIVATE_KEY` | Base-compatible wallet key, needed only to pay with `x402_run_job` | Not set |
| `KILAWATT_X402_MAX_USD_PER_JOB` | Maximum price for one paid job | `0.25` |
| `KILAWATT_X402_MAX_USD_PER_SESSION` | Maximum cumulative spend in this server process | `1.00` |
| `KILAWATT_X402_URL` | Override the x402 execution endpoint | Kilawatt production endpoint |

The returned API key is stored at `~/.config/kilawatt/x402-api-key` with restrictive file permissions. It is never shown in tool output. Existing `deploy_gpu_node` still requires `KILAWATT_API_KEY`.

**Use a separate wallet with a small balance for x402, and keep its private key out of prompts and shared configuration.** The payer does not need ETH; the facilitator submits the transaction.

## Error Handling

All errors are descriptive and indicate whether anything was provisioned or charged. Common scenarios:

- **400 Bad Request**: Invalid arguments (e.g., `card_count` > 64). Fix and retry.
- **401 Unauthorized**: API key missing, malformed, or revoked. Issue a new key in your Kilawatt account or contact hello@kilawattcloud.dev.
- **402 Payment Required**: Insufficient balance or spend cap. Top up in the Kilawatt wallet.
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
