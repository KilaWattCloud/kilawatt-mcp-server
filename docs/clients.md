# Configure MCP clients

The server runs as a local stdio process. Install Node.js, then add the matching configuration below to your MCP client. Replace the marked placeholders before using account-based provisioning or x402 payments. Do not share API keys or wallet private keys.

For a cautious first session with goose, see the [goose quickstart](goose-quickstart.md).

## goose

Add the contents of [`examples/goose-config.yaml`](../examples/goose-config.yaml) to `~/.config/goose/config.yaml`, or add a custom stdio extension in the goose app with command `npx` and arguments `-y kilawatt-mcp-server`. Enable the extension in the chats where you want to use it.

## Claude Desktop

Add the contents of [`examples/claude-desktop.json`](../examples/claude-desktop.json) under `mcpServers` in the Claude Desktop MCP configuration file. Save the file and restart Claude Desktop so it loads the server.

## Cursor

Add [`examples/cursor-mcp.json`](../examples/cursor-mcp.json) as `.cursor/mcp.json` in your project, or add the same server entry in Cursor's MCP settings. Save the configuration and restart or reload the MCP server.

## Tools

All clients get the same four tools: `deploy_gpu_node`, `x402_quote`, `x402_run_job` and `x402_job_status`. Parameters are listed in the [README](../README.md#available-tools).

## Environment values

- Set `KILAWATT_API_KEY` to your own private `kw_live_` API key only if you plan to use `deploy_gpu_node`.
- Set `KILAWATT_X402_PRIVATE_KEY` only if you plan to pay for jobs with `x402_run_job`. Use a separate small wallet.
- Set `KILAWATT_X402_MAX_USD_PER_JOB` and `KILAWATT_X402_MAX_USD_PER_SESSION` to spend limits before making a payment.
- `KILAWATT_BASE_URL` changes the default Kilawatt Cloud gateway used by `deploy_gpu_node`. `KILAWATT_X402_URL` changes the x402 execution endpoint.

The values in the example files are placeholders. Replace them with your own settings or remove optional values you do not use.
