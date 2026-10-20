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

Client configuration files for goose, Claude Desktop and Cursor are in this folder. For goose, see also the [goose tutorial](../docs/GOOSE_TUTORIAL.md).
