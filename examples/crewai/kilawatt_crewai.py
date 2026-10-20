"""Quote-only CrewAI example for the Kilawatt MCP server.

Uses crewai-tools MCPServerAdapter over stdio and limits the tools to
x402_quote. Nothing is paid or provisioned. The tool is called directly, so no
language model or API key is needed.

Install: pip install "crewai-tools[mcp]"
"""
from crewai_tools import MCPServerAdapter
from mcp import StdioServerParameters

params = StdioServerParameters(command="npx", args=["-y", "kilawatt-mcp-server"])

# Passing a tool name filters the adapter to that tool only.
with MCPServerAdapter(params, "x402_quote", connect_timeout=60) as tools:
    print("Tools available:", [tool.name for tool in tools])
    quote = tools["x402_quote"]
    # CrewAI fills unset optional fields with null, which the server rejects,
    # so every field is given a value here.
    print(
        quote.run(
            gpu_type="nvidia-h100",
            card_count=1,
            duration_seconds=600,
            routing_policy="lowest_cost",
            workload_type="batch_inference",
        )
    )
    # To give the tool to an agent, pass it as Agent(tools=tools, ...).
