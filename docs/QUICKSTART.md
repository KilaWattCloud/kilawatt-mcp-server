# Quickstart

These steps go from install to a first read-only call. They are quote-only by default: you set no API key, no wallet private key and no payment settings, so nothing can be paid for or provisioned.

1. Install Node.js 18 or later. Check with:

   ```bash
   node --version
   ```

2. Check that the server starts:

   ```bash
   npx -y kilawatt-mcp-server
   ```

   It prints `kilawatt-mcp-server ready on stdio` and then waits for an MCP client. Stop it with Ctrl+C.

3. Add the server to your MCP client with no environment values. Most clients take this entry under `mcpServers`:

   ```json
   {
     "mcpServers": {
       "kilawatt": {
         "command": "npx",
         "args": ["-y", "kilawatt-mcp-server"]
       }
     }
   }
   ```

   Some clients use a different format. See [clients.md](clients.md) for each client.

4. Restart or reload the client, and check that the `kilawatt` server is listed with its tools. The full list is in [TOOLS.md](TOOLS.md).

5. Make a first read-only call. Ask your agent:

   > Use the kilawatt get_platform_status tool and tell me the current status.

   `get_platform_status` needs no API key and starts nothing. `get_capacity` and `get_pricing` are also read-only and need no key. Prices from `get_pricing` are indicative only.

6. Optionally, get a quote without paying:

   > Use kilawatt x402_quote for 1 nvidia-h100 for 600 seconds.

   `x402_quote` sends an unpaid request and returns the price and payment details. It does not pay.

## Next steps

- To use `get_resume_info`, `resume_job` or `deploy_gpu_node`, set `KILAWATT_API_KEY` to your own `kw_live_` key. See the [README](../README.md#configuration).
- `resume_job`, `x402_run_job` and `deploy_gpu_node` without `dry_run` can spend money. Read the safety notes in the [README](../README.md) and [faq.md](faq.md) before enabling them.
- If something does not work, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
