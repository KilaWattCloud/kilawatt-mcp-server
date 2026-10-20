import assert from "node:assert/strict";
import { McpProcess } from "./mcp-process.js";

const apiKey = "kw_live_test_api_key_placeholder";
const privateKey = "not-a-valid-private-key-placeholder";
const server = new McpProcess({
  KILAWATT_API_KEY: apiKey,
  KILAWATT_X402_PRIVATE_KEY: privateKey,
  KILAWATT_X402_URL: "https://x402.test/exec",
  KILAWATT_BASE_URL: "https://gateway.test/api/public/v1",
});

try {
  await server.initialize();
  const legacyError = await server.call("deploy_gpu_node", { card_count: {} });
  const paymentError = await server.call("x402_run_job", { max_usd: 0.25, confirm: true });
  assert.equal(legacyError.result.isError, true);
  assert.equal(paymentError.result.isError, true);

  for (const output of [
    legacyError.result.content[0].text,
    paymentError.result.content[0].text,
  ]) {
    assert.ok(!output.includes(apiKey));
    assert.ok(!output.includes(privateKey));
  }
  assert.match(paymentError.result.content[0].text, /KILAWATT_X402_PRIVATE_KEY is invalid/);
  console.log("Error output does not contain configured key values.");
} finally {
  await server.stop();
}
