# Configure MCP clients

The server runs as a local stdio process. Install Node.js 18 or later, then add the matching configuration below to your MCP client. Replace the marked placeholders before using account-based provisioning or x402 payments. Do not share API keys or wallet private keys.

The examples for VS Code, Windsurf, Cline, Continue, Zed and Claude Code are quote-only by default: they set no API key, no wallet private key and no payment settings, so nothing can be paid for or provisioned. Add environment values only when you need them (see [Environment values](#environment-values)).

For a cautious first session with goose, see the [goose quickstart](goose-quickstart.md). For agent-driven installs, see [llms-install.md](../llms-install.md).

Supported clients on this page:

- [goose](#goose)
- [Claude Desktop](#claude-desktop)
- [Cursor](#cursor)
- [VS Code](#vs-code)
- [Windsurf](#windsurf)
- [Cline](#cline)
- [Continue](#continue)
- [Zed](#zed)
- [Claude Code](#claude-code)

## goose

Add the contents of [`examples/goose-config.yaml`](../examples/goose-config.yaml) to `~/.config/goose/config.yaml`, or add a custom stdio extension in the goose app with command `npx` and arguments `-y kilawatt-mcp-server`. Enable the extension in the chats where you want to use it.

## Claude Desktop

Add the contents of [`examples/claude-desktop.json`](../examples/claude-desktop.json) under `mcpServers` in the Claude Desktop MCP configuration file. Save the file and restart Claude Desktop so it loads the server.

## Cursor

Add [`examples/cursor-mcp.json`](../examples/cursor-mcp.json) as `.cursor/mcp.json` in your project, or add the same server entry in Cursor's MCP settings. Save the configuration and restart or reload the MCP server.

One-click install, using the install link format from Cursor's documentation. The link installs the server with no environment values (quote-only):

[![Add kilawatt MCP server to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](cursor://anysphere.cursor-deeplink/mcp/install?name=kilawatt&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImtpbGF3YXR0LW1jcC1zZXJ2ZXIiXX0=)

```markdown
[![Add kilawatt MCP server to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](cursor://anysphere.cursor-deeplink/mcp/install?name=kilawatt&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImtpbGF3YXR0LW1jcC1zZXJ2ZXIiXX0=)
```

The `config` value is the base64 encoding of `{"command":"npx","args":["-y","kilawatt-mcp-server"]}`. Some Markdown viewers do not make `cursor://` links clickable. If the button does not open Cursor, use the manual steps above.

## VS Code

Save [`examples/vscode-mcp.json`](../examples/vscode-mcp.json) as `.vscode/mcp.json` in your workspace. VS Code uses a top-level `servers` object (not `mcpServers`):

```json
{
  "servers": {
    "kilawatt": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "kilawatt-mcp-server"]
    }
  }
}
```

Or add it from the command line:

```bash
code --add-mcp '{"name":"kilawatt","type":"stdio","command":"npx","args":["-y","kilawatt-mcp-server"]}'
```

Run **MCP: List Servers** from the Command Palette to check that the server is listed and running.

To use the tools that need a Kilawatt API key, let VS Code prompt for the key instead of writing it in the file:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "kilawatt-api-key",
      "description": "Kilawatt API key",
      "password": true
    }
  ],
  "servers": {
    "kilawatt": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "kilawatt-mcp-server"],
      "env": {
        "KILAWATT_API_KEY": "${input:kilawatt-api-key}"
      }
    }
  }
}
```

One-click install links, using the `vscode:mcp/install` URL format from the VS Code documentation (URL-encoded JSON). VS Code does not publish an official badge image, so these are plain links:

- [Install kilawatt in VS Code](vscode:mcp/install?%7B%22name%22%3A%22kilawatt%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22kilawatt-mcp-server%22%5D%7D)
- [Install kilawatt in VS Code Insiders](vscode-insiders:mcp/install?%7B%22name%22%3A%22kilawatt%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22kilawatt-mcp-server%22%5D%7D)

```markdown
[Install kilawatt in VS Code](vscode:mcp/install?%7B%22name%22%3A%22kilawatt%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22kilawatt-mcp-server%22%5D%7D)
```

Some Markdown viewers do not make `vscode:` links clickable. If the link does not open VS Code, use the file or the `code --add-mcp` command above.

## Windsurf

In Cascade's MCP menu, choose **Open MCP config file** and add the `kilawatt` entry from [`examples/windsurf-mcp-config.json`](../examples/windsurf-mcp-config.json) under `mcpServers`:

```json
{
  "mcpServers": {
    "kilawatt": {
      "command": "npx",
      "args": ["-y", "kilawatt-mcp-server"],
      "env": {}
    }
  }
}
```

The location of this file depends on your build, so use the file that **Open MCP config file** opens. Press the refresh button in the MCP panel after saving.

## Cline

In the Cline panel, click the MCP Servers icon, open the **Configure** tab and click **Configure MCP Servers**. Add the `kilawatt` entry from [`examples/cline-mcp-settings.json`](../examples/cline-mcp-settings.json) under `mcpServers`:

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

Leave `autoApprove` empty so Cline asks before every tool call. Never add `x402_run_job`, `deploy_gpu_node` or any other tool that can spend money to `autoApprove`.

Agents can also follow [llms-install.md](../llms-install.md) to install the server.

## Continue

Create a `.continue/mcpServers` folder at the top level of your workspace and copy [`examples/continue/kilawatt.yaml`](../examples/continue/kilawatt.yaml) into it:

```yaml
name: Kilawatt Cloud
version: 0.0.1
schema: v1
mcpServers:
  - name: kilawatt
    type: stdio
    command: npx
    args:
      - "-y"
      - "kilawatt-mcp-server"
```

MCP tools in Continue are available only in agent mode.

## Zed

Open your settings file (`zed: open settings file`) and add the entry from [`examples/zed-settings.json`](../examples/zed-settings.json) under `context_servers`, or add it as a local server from **Settings, AI, MCP Servers**:

```json
{
  "context_servers": {
    "kilawatt": {
      "command": "npx",
      "args": ["-y", "kilawatt-mcp-server"],
      "env": {}
    }
  }
}
```

## Claude Code

Add the server with the `claude mcp add` command (also in [`examples/claude-code-mcp-add.sh`](../examples/claude-code-mcp-add.sh)):

```bash
claude mcp add --transport stdio kilawatt -- npx -y kilawatt-mcp-server
```

Options go before the server name and the server command goes after `--`. Add `--scope user` to make the server available in all your projects, or `--scope project` to share it through the project's `.mcp.json`.

To use the tools that need a Kilawatt API key, pass it with `--env`. Keep at least one other option between `--env` and the server name:

```bash
claude mcp add --env KILAWATT_API_KEY=kw_live_YOUR_API_KEY --transport stdio kilawatt -- npx -y kilawatt-mcp-server
```

Check the server with `claude mcp list` in your shell, or `/mcp` inside Claude Code.

## Tools

Every client gets the same tools. They are listed with their parameters in the [README](../README.md#available-tools).

## Environment values

- Set `KILAWATT_API_KEY` to your own private `kw_live_` API key only if you plan to use tools that need it, such as `deploy_gpu_node`.
- Set `KILAWATT_X402_PRIVATE_KEY` only if you plan to pay for jobs with `x402_run_job`. Use a separate small wallet.
- Set `KILAWATT_X402_MAX_USD_PER_JOB` and `KILAWATT_X402_MAX_USD_PER_SESSION` to spend limits before making a payment.
- `KILAWATT_BASE_URL` changes the default Kilawatt Cloud gateway used by `deploy_gpu_node`. `KILAWATT_X402_URL` changes the x402 execution endpoint.

The values in the example files are placeholders. Replace them with your own settings or remove optional values you do not use.
