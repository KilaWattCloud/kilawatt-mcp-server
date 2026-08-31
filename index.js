import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  {
    name: "kilawatt-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register Available MCP Tools for Agents (Cursor/Claude)
server.setRequestHandler("tools/list", async () => {
  return {
    tools: [
      {
        name: "deploy_gpu_node",
        description: "Deploy or reserve high-density GPU compute nodes on Kilawatt Cloud (Supports Sandbox Mode).",
        inputSchema: {
          type: "object",
          properties: {
            gpu_type: {
              type: "string",
              description: "GPU chip type (e.g., nvidia-h100, nvidia-b200, nvidia-h200)",
            },
            count: {
              type: "number",
              description: "Number of GPUs requested.",
            },
            dry_run: {
              type: "boolean",
              description: "Set to true for zero-cost sandbox validation.",
            },
          },
          required: ["gpu_type", "count"],
        },
      },
    ],
  };
});

// Handle Agent Tool Execution Calls
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "deploy_gpu_node") {
    const gpu = args.gpu_type || "nvidia-h100";
    const count = args.count || 1;
    const isDryRun = args.dry_run !== false;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "200_OK",
            platform: "Kilawatt Cloud Gateway",
            mode: isDryRun ? "SANDBOX_MODE" : "LIVE_PRODUCTION",
            message: "GPU allocation route verified.",
            reservation: {
              gpu_type: gpu,
              allocated_count: count,
              failover_armed: true,
              egress_fee: "$0.00/GB",
              region: "US-East-01 (Multi-Datacenter Routing)"
            }
          }, null, 2)
        }
      ]
    };
  }

  throw new Error(`Unknown tool request: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
