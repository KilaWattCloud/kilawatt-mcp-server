"""Quote-only LangChain/LangGraph example for the Kilawatt MCP server.

Loads the server tools over stdio, keeps only x402_quote, and calls it through
a small langgraph graph. No language model or API key is needed. Nothing is paid
or provisioned.

Install: pip install langchain-mcp-adapters langgraph
"""
import asyncio

from langchain_core.messages import AIMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode


async def main() -> None:
    client = MultiServerMCPClient(
        {
            "kilawatt": {
                "transport": "stdio",
                "command": "npx",
                "args": ["-y", "kilawatt-mcp-server"],
            }
        }
    )
    tools = [t for t in await client.get_tools() if t.name == "x402_quote"]
    if not tools:
        raise SystemExit("x402_quote tool not found")

    # Only the quote tool is handed to the graph, so it cannot pay or provision.
    builder = StateGraph(MessagesState)
    builder.add_node("tools", ToolNode(tools))
    builder.add_edge(START, "tools")
    builder.add_edge("tools", END)
    graph = builder.compile()
    call = AIMessage(
        content="",
        tool_calls=[
            {
                "name": "x402_quote",
                "args": {"gpu_type": "nvidia-h100", "card_count": 1, "duration_seconds": 600},
                "id": "quote-1",
            }
        ],
    )
    result = await graph.ainvoke({"messages": [call]})
    for message in result["messages"]:
        print(message.content)


if __name__ == "__main__":
    asyncio.run(main())
