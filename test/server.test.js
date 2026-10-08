import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

function waitForResponse(child, id) {
  return new Promise((resolveResponse, rejectResponse) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      rejectResponse(new Error(`Timed out waiting for JSON-RPC response ${id}`));
    }, 5000);
    pending.set(id, {
      resolve: (message) => {
        clearTimeout(timer);
        resolveResponse(message);
      },
      reject: (error) => {
        clearTimeout(timer);
        rejectResponse(error);
      },
    });
  });
}

const pending = new Map();
const child = spawn(process.execPath, ["index.js"], {
  cwd: root,
  env: { ...process.env, KILAWATT_API_KEY: "kw_live_test" },
  stdio: ["pipe", "pipe", "pipe"],
});

let stdoutBuffer = "";
let stderr = "";
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdoutBuffer += chunk;
  const lines = stdoutBuffer.split("\n");
  stdoutBuffer = lines.pop();
  for (const line of lines) {
    if (!line) continue;
    const message = JSON.parse(line);
    if (pending.has(message.id)) {
      pending.get(message.id).resolve(message);
      pending.delete(message.id);
    }
  }
});
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});
child.on("exit", (code, signal) => {
  for (const { reject } of pending.values()) {
    reject(new Error(`Server exited before responding (code ${code}, signal ${signal})`));
  }
  pending.clear();
});

try {
  const initialized = waitForResponse(child, 1);
  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "kilawatt-mcp-server-test", version: "1.0.0" },
      },
    })}\n`,
  );
  const initialization = await initialized;
  assert.equal(initialization.error, undefined);
  assert.equal(initialization.result.serverInfo.version, packageJson.version);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

  const tools = waitForResponse(child, 2);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
  const toolList = await tools;
  assert.equal(toolList.error, undefined);
  assert.ok(
    toolList.result.tools.some((tool) => tool.name === "deploy_gpu_node"),
    "tools/list should include deploy_gpu_node",
  );
  assert.match(stderr, /ready on stdio/);
  console.log("MCP initialize and tools/list passed; deploy_gpu_node is available.");
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
  }
}

const invalidKeyRun = spawn(process.execPath, ["index.js"], {
  cwd: root,
  env: { ...process.env, KILAWATT_API_KEY: "invalid" },
  stdio: ["ignore", "ignore", "pipe"],
});
let invalidKeyStderr = "";
invalidKeyRun.stderr.setEncoding("utf8");
invalidKeyRun.stderr.on("data", (chunk) => {
  invalidKeyStderr += chunk;
});
const [invalidKeyExitCode] = await once(invalidKeyRun, "exit");
assert.notEqual(invalidKeyExitCode, 0);
assert.match(invalidKeyStderr, /KILAWATT_API_KEY does not look like a Kilawatt key/);
console.log("Invalid API key is rejected at startup.");

const missingKeyEnv = { ...process.env };
delete missingKeyEnv.KILAWATT_API_KEY;
const missingKeyRun = spawn(process.execPath, ["index.js"], {
  cwd: root,
  env: missingKeyEnv,
  stdio: ["ignore", "ignore", "pipe"],
});
let missingKeyStderr = "";
missingKeyRun.stderr.setEncoding("utf8");
missingKeyRun.stderr.on("data", (chunk) => {
  missingKeyStderr += chunk;
});
const [missingKeyExitCode] = await once(missingKeyRun, "exit");
assert.notEqual(missingKeyExitCode, 0);
assert.match(missingKeyStderr, /KILAWATT_API_KEY is not set/);
console.log("Missing API key is rejected at startup.");
