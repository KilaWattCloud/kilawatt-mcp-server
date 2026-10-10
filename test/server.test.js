import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const privateKey = `0x${"1".repeat(64)}`;
const apiKey = "kw_x402_test_key_must_not_be_printed";

class McpProcess {
  constructor(env = {}, mocked = false) {
    const args = mocked
      ? ["--import", pathToFileURL(resolve(root, "test/mock-fetch.js")).href, "index.js"]
      : ["index.js"];
    this.child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.pending = new Map();
    this.nextId = 1;
    this.stdout = "";
    this.stderr = "";
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk) => { this.stderr += chunk; });
    const lines = createInterface({ input: this.child.stdout });
    lines.on("line", (line) => {
      if (!line) return;
      const message = JSON.parse(line);
      if (this.pending.has(message.id)) {
        this.pending.get(message.id).resolve(message);
        this.pending.delete(message.id);
      }
    });
  }

  request(method, params = {}) {
    const id = this.nextId++;
    const response = new Promise((resolveResponse, rejectResponse) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectResponse(new Error(`Timed out waiting for JSON-RPC response ${id}`));
      }, 10_000);
      this.pending.set(id, {
        resolve: (message) => {
          clearTimeout(timer);
          resolveResponse(message);
        },
        reject: rejectResponse,
      });
    });
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return response;
  }

  async initialize() {
    const response = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "kilawatt-mcp-server-test", version: "1.0.0" },
    });
    assert.equal(response.error, undefined);
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    return response;
  }

  async call(name, args = {}) {
    return this.request("tools/call", { name, arguments: args });
  }

  async stop() {
    if (this.child.exitCode === null && this.child.signalCode === null) {
      const exited = once(this.child, "exit");
      this.child.kill("SIGTERM");
      await exited;
    }
  }
}

async function startMock(mode = {}) {
  const directory = await mkdtemp(resolve(tmpdir(), "kilawatt-x402-test-"));
  const tracePath = resolve(directory, "requests.log");
  const server = new McpProcess({
    HOME: directory,
    KILAWATT_X402_URL: "https://x402.test/exec",
    KILAWATT_BASE_URL: "https://gateway.test/api/public/v1",
    X402_TEST_TRACE: tracePath,
    X402_TEST_API_KEY: apiKey,
    ...mode,
  }, true);
  await server.initialize();
  return { server, directory, tracePath };
}

async function trace(path) {
  try {
    return (await readFile(path, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse);
  } catch {
    return [];
  }
}

const runArgs = { max_usd: 0.25, confirm: true };

const server = new McpProcess({ KILAWATT_API_KEY: "kw_live_test" }, true);
try {
  const initialized = await server.initialize();
  const tools = await server.request("tools/list");
  const names = tools.result.tools.map((tool) => tool.name);
  for (const name of ["deploy_gpu_node", "x402_quote", "x402_run_job", "x402_job_status"]) {
    assert.ok(names.includes(name), `tools/list should include ${name}`);
  }
  const legacy = await server.call("deploy_gpu_node", { dry_run: true });
  assert.match(legacy.result.content[0].text, /DRY RUN/);
  assert.equal(initialized.result.serverInfo.version, "0.1.4");
  assert.match(server.stderr, /ready on stdio/);
  console.log("MCP startup, tools/list, and deploy_gpu_node behavior passed.");
} finally {
  await server.stop();
}

const noLegacyKeyServer = new McpProcess();
try {
  await noLegacyKeyServer.initialize();
  const result = await noLegacyKeyServer.call("deploy_gpu_node", { dry_run: true });
  assert.equal(result.result.isError, true);
  assert.match(result.result.content[0].text, /KILAWATT_API_KEY is not set/);
} finally {
  await noLegacyKeyServer.stop();
}

{
  const { server: quoteServer, directory, tracePath } = await startMock();
  try {
    const quote = await quoteServer.call("x402_quote");
    assert.match(quote.result.content[0].text, /Price: \$0\.010000 USD/);
    assert.match(quote.result.content[0].text, /eip155:8453/);
    assert.match(quote.result.content[0].text, /Payment valid for: 60 seconds/);
    assert.equal((await trace(tracePath)).filter((entry) => entry.kind === "x402").length, 1);
    assert.equal((await trace(tracePath))[0].paid, false);

    const unconfirmed = await quoteServer.call("x402_run_job", { max_usd: 0.25, confirm: false });
    assert.match(unconfirmed.result.content[0].text, /Nothing was paid/);
    assert.equal((await trace(tracePath)).filter((entry) => entry.kind === "x402").length, 2);
  } finally {
    await quoteServer.stop();
    await rm(directory, { recursive: true, force: true });
  }
}

for (const mode of [
  { X402_TEST_AMOUNT: "300000" },
  { X402_TEST_AMOUNT: "10000", KILAWATT_X402_MAX_USD_PER_JOB: "0.005" },
]) {
  const { server: cappedServer, directory, tracePath } = await startMock(mode);
  try {
    const result = await cappedServer.call("x402_run_job", runArgs);
    assert.match(result.result.content[0].text, /Refused:/);
    assert.match(result.result.content[0].text, /Nothing was paid/);
    assert.equal((await trace(tracePath)).filter((entry) => entry.paid).length, 0);
  } finally {
    await cappedServer.stop();
    await rm(directory, { recursive: true, force: true });
  }
}

{
  const { server: noPrivateKey, directory, tracePath } = await startMock();
  try {
    const result = await noPrivateKey.call("x402_run_job", runArgs);
    assert.equal(result.result.isError, true);
    assert.match(result.result.content[0].text, /KILAWATT_X402_PRIVATE_KEY is required/);
    assert.equal((await trace(tracePath)).filter((entry) => entry.paid).length, 0);
  } finally {
    await noPrivateKey.stop();
    await rm(directory, { recursive: true, force: true });
  }
}

{
  const { server: payingServer, directory, tracePath } = await startMock({
    KILAWATT_X402_PRIVATE_KEY: privateKey,
    KILAWATT_X402_MAX_USD_PER_SESSION: "0.015",
  });
  try {
    const result = await payingServer.call("x402_run_job", runArgs);
    const output = result.result.content[0].text;
    assert.match(output, /Job ID: test-job/);
    assert.match(output, /https:\/\/basescan\.org\/tx\/0x/);
    assert.match(output, /API key saved to/);
    assert.ok(!output.includes(apiKey));
    assert.ok(!output.includes(privateKey));

    const keyPath = resolve(directory, ".config", "kilawatt", "x402-api-key");
    const stat = await (await import("node:fs/promises")).stat(keyPath);
    assert.equal(stat.mode & 0o777, 0o600);
    assert.equal((await readFile(keyPath, "utf8")).trim(), apiKey);

    const status = await payingServer.call("x402_job_status", { job_id: "test-job" });
    assert.match(status.result.content[0].text, /"status":"running"/);
    assert.match(status.result.content[0].text, /"runtime_seconds":12/);
    assert.ok(!(await trace(tracePath)).find((entry) => entry.kind === "status").authorizationMatches === false);

    const overSession = await payingServer.call("x402_run_job", runArgs);
    assert.match(overSession.result.content[0].text, /remaining session cap/);
    assert.equal((await trace(tracePath)).filter((entry) => entry.paid).length, 1);
  } finally {
    await payingServer.stop();
    await rm(directory, { recursive: true, force: true });
  }
}

for (const [status, code, expected] of [
  [400, "unknown_gpu_type", /Valid GPU types/],
  [402, "price_changed", /price changed/],
  [402, "insufficient_funds_or_invalid_signature", /funds or signature/],
  [403, "sanctions_screening", /sanctions screening/],
  [409, "payment_already_used", /already used/],
  [415, "unsupported_media_type", /application\/json/],
  [429, "rate_limited", /rate limiting/],
  [503, "no_capacity", /No matching capacity/],
]) {
  const { server: errorServer, directory } = await startMock({
    KILAWATT_X402_PRIVATE_KEY: privateKey,
    X402_TEST_STATUS: String(status),
    X402_TEST_ERROR: code,
  });
  try {
    const result = await errorServer.call("x402_run_job", runArgs);
    assert.equal(result.result.isError, true);
    assert.match(result.result.content[0].text, expected);
    assert.ok(!result.result.content[0].text.includes(privateKey));
    assert.ok(!result.result.content[0].text.includes(apiKey));
  } finally {
    await errorServer.stop();
    await rm(directory, { recursive: true, force: true });
  }
}

{
  const invalid = new McpProcess({ KILAWATT_X402_URL: "https://should-not-be-called.test" }, true);
  try {
    await invalid.initialize();
    const result = await invalid.call("x402_quote", { gpu_type: "invalid-gpu" });
    assert.equal(result.result.isError, true);
    assert.match(result.result.content[0].text, /gpu_type must be one of/);
  } finally {
    await invalid.stop();
  }
}

console.log("x402 quotes, payment guards, errors, secret handling, and status passed.");
