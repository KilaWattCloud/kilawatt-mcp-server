# kilawatt-mcp-server

[![Build Status](https://github.com/KilaWattCloud/kilawatt-mcp-server/workflows/Test/badge.svg)](https://github.com/KilaWattCloud/kilawatt-mcp-server/actions)
[![Version](https://img.shields.io/github/v/release/KilaWattCloud/kilawatt-mcp-server)](https://github.com/KilaWattCloud/kilawatt-mcp-server/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Model Context Protocol (MCP) server for Kilawatt Cloud GPU provisioning. Enables Cursor, Claude Desktop, and other AI agents to programmatically request and manage real GPU compute nodes.

**This server calls the real Kilawatt gateway** — every response is an actual HTTP result from `https://www.kilawattcloud.dev/api/public/v1`. There are no mock or fabricated responses.

## Installation

Install via npm:

```bash
npm install kilawatt-mcp-server
```

## Configuration

Set your Kilawatt API key as an environment variable before running the server:

```bash
export KILAWATT_API_KEY=kw_live_YOUR_KEY_HERE
```

The API key must start with `kw_live_`. API keys are issued through your Kilawatt Cloud account. Contact hello@kilawattcloud.dev for assistance if you don't have access to generate keys yet.

Optionally, override the gateway URL:

```bash
export KILAWATT_BASE_URL=https://www.kilawattcloud.dev/api/public/v1
```

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
| `gpu_type` | string | No | `"nvidia-h100"` | — | GPU model identifier, e.g. `nvidia-h100`, `nvidia-h200`, `nvidia-b200` |
| `card_count` | integer | No | `1` | 1–64 | Number of GPUs to provision |
| `duration_seconds` | number | No | `600` | 1–86400 | How long the node is needed, in seconds. Billed up front. |
| `routing_policy` | string | No | `"lowest_cost"` | `lowest_cost`, `lowest_latency`, `zero_quota` | How the smart order router picks a node |
| `dry_run` | boolean | No | `false` | — | Price and pre-authorize only. Returns cost estimate and routing order without provisioning or charging. |

**Example: Deploy 4 H100 GPUs for 1 hour at lowest cost**

```javascript
{
  "name": "deploy_gpu_node",
  "arguments": {
    "gpu_type": "nvidia-h100",
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
    "gpu_type": "nvidia-b200",
    "card_count": 2,
    "duration_seconds": 1800,
    "dry_run": true
  }
}
```

**Response (Success):**

```
GPU node running. Job ID: job_abc123xyz
Node: provider-name
Hardware: 4× nvidia-h100
Workload: default   Routing policy: lowest_cost
Billed: $12.3456
Status: running
```

**Response (Dry Run):**

```
DRY RUN — nothing was provisioned and nothing was charged.
Authorized: yes
Estimated cost: $6.1728 for 2× nvidia-b200
Routing policy: lowest_cost
Would route through (in order): provider-a → provider-b → provider-c
```

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
