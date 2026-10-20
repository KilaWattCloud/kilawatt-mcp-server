// Quote-only client using @modelcontextprotocol/sdk. Never pays or provisions.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "kilawatt-mcp-server"],
});
const client = new Client({ name: "kilawatt-node-example", version: "1.0.0" });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log("Tools:", tools.map((t) => t.name).join(", "));
  const result = await client.callTool({
    name: "x402_quote",
    arguments: { gpu_type: "nvidia-h100", card_count: 1, duration_seconds: 600 },
  });
  for (const item of result.content) console.log(item.text ?? item);
  if (result.isError) process.exitCode = 1;
} finally {
  await client.close();
}
