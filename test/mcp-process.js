import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export class McpProcess {
  constructor(env = {}) {
    this.child = spawn(process.execPath, [
      "--import",
      pathToFileURL(resolve(root, "test/mock-fetch.js")).href,
      "index.js",
    ], {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.pending = new Map();
    this.nextId = 1;
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
    if (response.error) throw new Error(response.error.message);
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    return response;
  }

  call(name, args = {}) {
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
