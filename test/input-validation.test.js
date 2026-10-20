import assert from "node:assert/strict";
import { McpProcess } from "./mcp-process.js";

const server = new McpProcess({
  KILAWATT_API_KEY: "kw_live_test_placeholder",
  KILAWATT_X402_URL: "https://x402.test/exec",
  KILAWATT_BASE_URL: "https://gateway.test/api/public/v1",
});

try {
  await server.initialize();
  const cases = [
    ["deploy_gpu_node", { card_count: 0 }, /card_count must be a whole number/],
    ["deploy_gpu_node", { card_count: 65 }, /card_count must be a whole number/],
    ["deploy_gpu_node", { card_count: {} }, /card_count must be a whole number/],
    ["deploy_gpu_node", { duration_seconds: 0 }, /duration_seconds must be between/],
    ["deploy_gpu_node", { duration_seconds: 86401 }, /duration_seconds must be between/],
    ["deploy_gpu_node", { duration_seconds: {} }, /duration_seconds must be between/],
    ["deploy_gpu_node", { gpu_type: "x".repeat(65) }, /gpu_type must be a non-empty string/],
    ["deploy_gpu_node", { routing_policy: "unknown" }, /routing_policy must be one of/],
    ["deploy_gpu_node", { routing_policy: 123 }, /routing_policy must be one of/],
    ["x402_quote", { gpu_type: "nvidia-unknown" }, /gpu_type must be one of/],
    ["x402_quote", { gpu_type: 123 }, /gpu_type must be one of/],
    ["x402_quote", { card_count: 0 }, /card_count for nvidia-h100 must be a whole number/],
    ["x402_quote", { card_count: 9 }, /card_count for nvidia-h100 must be a whole number/],
    ["x402_quote", { card_count: "2" }, /card_count for nvidia-h100 must be a whole number/],
    ["x402_quote", { duration_seconds: 59 }, /duration_seconds must be between/],
    ["x402_quote", { duration_seconds: 86401 }, /duration_seconds must be between/],
    ["x402_quote", { duration_seconds: "600" }, /duration_seconds must be between/],
    ["x402_quote", { routing_policy: "unknown" }, /routing_policy must be one of/],
    ["x402_quote", { routing_policy: 1 }, /routing_policy must be one of/],
    ["x402_quote", { workload_type: "unknown" }, /workload_type must be one of/],
    ["x402_quote", { workload_type: {} }, /workload_type must be one of/],
    ["x402_run_job", { max_usd: 0, confirm: false }, /max_usd is required and must be a positive number/],
    ["x402_run_job", { max_usd: "0.25", confirm: false }, /max_usd is required and must be a positive number/],
    ["x402_run_job", { max_usd: 0.25, confirm: "true" }, /confirm is required and must be a boolean/],
    ["x402_job_status", { job_id: 12 }, /job_id must be a non-empty string/],
    ["x402_job_status", { job_id: "" }, /job_id must be a non-empty string/],
    ["x402_job_status", { job_id: "x".repeat(129) }, /job_id must be a non-empty string/],
  ];

  for (const [name, args, message] of cases) {
    const response = await server.call(name, args);
    assert.equal(response.result.isError, true, `${name} should reject ${JSON.stringify(args)}`);
    assert.match(response.result.content[0].text, message);
  }
  console.log("Tool input validation cases passed.");
} finally {
  await server.stop();
}
