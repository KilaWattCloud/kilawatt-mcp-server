"""Minimal quote-only client using the official MCP Python SDK.

Install: pip install mcp
"""
import asyncio

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

PARAMS = StdioServerParameters(command="npx", args=["-y", "kilawatt-mcp-server"])


async def main() -> None:
    async with stdio_client(PARAMS) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            print("Tools:", [t.name for t in tools.tools])
            result = await session.call_tool(
                "x402_quote",
                {"gpu_type": "nvidia-h100", "card_count": 1, "duration_seconds": 600},
            )
            for item in result.content:
                print(getattr(item, "text", item))
            if result.isError:
                raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
