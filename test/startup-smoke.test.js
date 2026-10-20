import assert from "node:assert/strict";
import { McpProcess } from "./mcp-process.js";

const server = new McpProcess();

try {
  await server.initialize();
  const response = await server.request("tools/list");
  assert.equal(response.error, undefined);
  const names = response.result.tools.map((tool) => tool.name);
  for (const name of ["deploy_gpu_node", "x402_quote", "x402_run_job", "x402_job_status"]) {
    assert.ok(names.includes(name), `tools/list should include ${name}`);
  }
  assert.match(server.stderr, /ready on stdio/);
  console.log("Server startup and tool listing passed.");
} finally {
  await server.stop();
}
