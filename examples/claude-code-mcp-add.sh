#!/bin/sh
# Add the Kilawatt MCP server to Claude Code (local scope, quote-only).
# No keys are set, so nothing can be paid for or provisioned.
claude mcp add --transport stdio kilawatt -- npx -y kilawatt-mcp-server

# Confirm it is listed and connected:
claude mcp list
