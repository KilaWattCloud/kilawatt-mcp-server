"""Check a quote with the Kilawatt MCP server, then print a SkyPilot hint.

Quote-only. This script never pays, provisions, or runs sky itself. Run the
printed command yourself if you decide to proceed.

Install: pip install mcp
"""
import asyncio
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

PARAMS = StdioServerParameters(command="npx", args=["-y", "kilawatt-mcp-server"])
TASK_YAML = Path(__file__).with_name("task.yaml")


async def main() -> None:
    async with stdio_client(PARAMS) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(
                "x402_quote",
                {"gpu_type": "nvidia-h100", "card_count": 1, "duration_seconds": 600},
            )
            for item in result.content:
                print(getattr(item, "text", item))
            if result.isError:
                raise SystemExit("Quote failed; nothing to launch.")
    print()
    print("Quote only. Nothing was paid or provisioned.")
    print(f"To launch with SkyPilot yourself, run: sky launch {TASK_YAML}")


if __name__ == "__main__":
    asyncio.run(main())
