# Examples

Every example is quote-only. Each one calls `x402_quote` and never calls `x402_run_job` or `deploy_gpu_node`, so nothing is paid or provisioned. All of them start the server with `npx -y kilawatt-mcp-server` over stdio. They need Node.js 18 or later; the Python examples also need Python 3.10 or later.

| Example | Files | Install | Run |
|---------|-------|---------|-----|
| LangChain and LangGraph | [langchain/kilawatt_langchain.py](langchain/kilawatt_langchain.py) | `pip install langchain-mcp-adapters langgraph` | `python langchain/kilawatt_langchain.py` |
| CrewAI | [crewai/kilawatt_crewai.py](crewai/kilawatt_crewai.py) | `pip install "crewai-tools[mcp]"` | `python crewai/kilawatt_crewai.py` |
| SkyPilot | [skypilot/price_check_then_launch.py](skypilot/price_check_then_launch.py), [skypilot/task.yaml](skypilot/task.yaml) | `pip install mcp` | `python skypilot/price_check_then_launch.py` |
| Node client | [node-client/](node-client/) | `cd node-client && npm install` | `npm start` |
| Python SDK | [python-sdk/kilawatt_client.py](python-sdk/kilawatt_client.py) | `pip install mcp` | `python python-sdk/kilawatt_client.py` |

The SkyPilot script prints a `sky launch` command for you to run yourself. It does not run it.

Client configuration files are in this folder:

| Client | File |
|--------|------|
| goose | [goose-config.yaml](goose-config.yaml) |
| Claude Desktop | [claude-desktop.json](claude-desktop.json) |
| Cursor | [cursor-mcp.json](cursor-mcp.json) |
| VS Code | [vscode-mcp.json](vscode-mcp.json) |
| Windsurf | [windsurf-mcp-config.json](windsurf-mcp-config.json) |
| Cline | [cline-mcp-settings.json](cline-mcp-settings.json) |
| Continue | [continue/kilawatt.yaml](continue/kilawatt.yaml) |
| Zed | [zed-settings.json](zed-settings.json) |
| Claude Code | [claude-code-mcp-add.sh](claude-code-mcp-add.sh) |

The VS Code, Windsurf, Cline, Continue, Zed and Claude Code files are quote-only: they set no keys and no payment settings. Setup steps for every client are in [docs/clients.md](../docs/clients.md). For goose, see also the [goose tutorial](../docs/GOOSE_TUTORIAL.md).
