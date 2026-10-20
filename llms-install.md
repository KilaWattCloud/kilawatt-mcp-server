# Installing kilawatt-mcp-server

These steps are for an AI agent installing this MCP server for a user. The server runs locally over stdio with `npx`. The default install is quote-only: it sets no API key, no wallet private key and no payment settings, so nothing can be paid for or provisioned.

1. Check that Node.js 18 or later is installed by running `node --version`. If it is missing or older, ask the user to install a current Node.js release, then continue.

2. Add this server entry to the MCP settings file. For Cline, open it from the MCP Servers icon, then the **Configure** tab, then **Configure MCP Servers**. Keep any servers that are already there.

   ```json
   {
     "mcpServers": {
       "kilawatt": {
         "command": "npx",
         "args": ["-y", "kilawatt-mcp-server"],
         "env": {},
         "disabled": false,
         "autoApprove": []
       }
     }
   }
   ```

3. Do not add any environment values unless the user asks for them. All of them are optional:

   | Variable | Purpose |
   |----------|---------|
   | `KILAWATT_API_KEY` | The user's own Kilawatt API key (starts with `kw_live_`). Needed only for tools that use an account, such as `deploy_gpu_node`. |
   | `KILAWATT_BASE_URL` | Overrides the default gateway. Leave unset. |
   | `KILAWATT_X402_URL` | Overrides the default x402 endpoint. Leave unset. |
   | `KILAWATT_X402_PRIVATE_KEY` | Wallet key for paying with `x402_run_job`. Only add it if the user explicitly asks to enable payments. |
   | `KILAWATT_X402_MAX_USD_PER_JOB` | Spend cap for one paid job. |
   | `KILAWATT_X402_MAX_USD_PER_SESSION` | Spend cap for one server process. |

   If the user wants an API key or wallet key set, ask the user to paste it into the settings file themselves, or use a placeholder such as `YOUR_API_KEY` and tell the user to replace it. Never write a real key into chat, and never invent one.

4. Leave `autoApprove` empty. Never auto-approve `x402_run_job`, `deploy_gpu_node` or any other tool that can spend money.

5. Save the file and let the client restart or refresh the server.

6. Confirm the tools are listed. The client's MCP server list should show `kilawatt` as connected, with at least these tools: `deploy_gpu_node`, `x402_quote`, `x402_run_job` and `x402_job_status`. The full list is in the [README](README.md#available-tools).

7. Optionally make one quote-only call to check that the server works: call `x402_quote` with no arguments. It returns a price and payment details and does not pay for anything. Do not call `x402_run_job`, and do not call `deploy_gpu_node` without `dry_run: true`, unless the user asks.

If the server does not appear, check that `npx -y kilawatt-mcp-server` runs in a terminal (it waits for input on stdio; stop it with Ctrl+C), then check the settings file for JSON errors.
