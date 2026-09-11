#!/usr/bin/env node
/**
 * kilawatt-mcp-server
 *
 * MCP server exposing Kilawatt Cloud GPU provisioning. This talks to the REAL
 * Kilawatt public gateway — there are no mock or fabricated responses anywhere
 * in this file. Every result returned to the model comes from an actual HTTP
 * response from https://www.kilawattcloud.dev/api/public/v1.
 *
 * Environment:
 *   KILAWATT_API_KEY   required, format kw_live_...
 *   KILAWATT_BASE_URL  optional, defaults to the production gateway
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const DEFAULT_BASE_URL = "https://www.kilawattcloud.dev/api/public/v1";
const REQUEST_TIMEOUT_MS = 60_000;

const MAX_CARD_COUNT = 64;
const MAX_DURATION_SECONDS = 86_400;
const ROUTING_POLICIES = ["lowest_cost", "lowest_latency", "zero_quota"];

const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1_000;

class GatewayError extends Error {
  constructor(status, body) {
    super(typeof body?.error === "string" ? body.error : `Gateway returned HTTP ${status}`);
    this.name = "GatewayError";
    this.status = status;
    this.body = body;
  }
}

class GatewayTimeoutError extends Error {
  constructor(ms) {
    super(`No response from the Kilawatt gateway within ${ms}ms`);
    this.name = "GatewayTimeoutError";
  }
}

class GatewayConnectionError extends Error {
  constructor(cause) {
    super(`Could not reach the Kilawatt gateway: ${cause?.message ?? cause}`);
    this.name = "GatewayConnectionError";
    this.cause = cause;
  }
}

function apiKey() {
  const key = process.env.KILAWATT_API_KEY;
  if (!key) {
    throw new Error(
      "KILAWATT_API_KEY is not set. Create a key in the Kilawatt console (Developer tab) and export it before starting this server.",
    );
  }
  if (!key.startsWith("kw_live_")) {
    throw new Error(
      "KILAWATT_API_KEY does not look like a Kilawatt key (expected it to start with kw_live_).",
    );
  }
  return key;
}

function baseUrl() {
  return (process.env.KILAWATT_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function postOnce(path, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${baseUrl()}/${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (cause) {
    if (controller.signal.aborted) throw new GatewayTimeoutError(REQUEST_TIMEOUT_MS);
    throw new GatewayConnectionError(cause);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text };
  }

  if (!response.ok) throw new GatewayError(response.status, body);
  return body;
}

async function postWithRetry(path, payload) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await postOnce(path, payload);
    } catch (error) {
      lastError = error;
      const retryable =
        (error instanceof GatewayError && RETRYABLE_STATUSES.has(error.status)) ||
        error instanceof GatewayConnectionError;
      if (!retryable || attempt === MAX_ATTEMPTS) throw error;
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250));
    }
  }
  throw lastError;
}

function describeError(error) {
  if (error instanceof GatewayTimeoutError) {
    return `Timed out: ${error.message}. The job was NOT placed — no compute was provisioned and nothing was charged. Retry if you still need the capacity.`;
  }
  if (error instanceof GatewayConnectionError) {
    return `${error.message}. The job was NOT placed and nothing was charged.`;
  }
  if (!(error instanceof GatewayError)) {
    return `Unexpected failure: ${error?.message ?? String(error)}. The job was NOT placed.`;
  }

  const detail = error.body?.error ?? `HTTP ${error.status}`;
  switch (error.status) {
    case 400: {
      const issues = Array.isArray(error.body?.details)
        ? "\nInvalid fields: " +
          error.body.details
            .map((d) => `${(d.path ?? []).join(".") || "(root)"}: ${d.message}`)
            .join("; ")
        : "";
      return `Request rejected as invalid: ${detail}${issues}\nFix the arguments and call again — retrying unchanged will fail identically.`;
    }
    case 401:
      return `Authentication failed: ${detail}\nThe API key is missing, malformed, or revoked. Issue a new key in the Kilawatt console (Developer tab) and set KILAWATT_API_KEY.`;
    case 402: {
      const required =
        typeof error.body?.required_usd === "number"
          ? ` This request needs $${error.body.required_usd.toFixed(2)} pre-authorized.`
          : "";
      return `Payment required: ${detail}${required}\nNothing was provisioned and nothing was charged. Top up the Kilawatt wallet (or raise the spend cap) and try again.`;
    }
    case 404:
      return `Gateway endpoint not found: ${detail}\nThis is a configuration problem in the MCP server, not a capacity issue. Check KILAWATT_BASE_URL.`;
    case 429:
      return `Rate or concurrency limit hit: ${detail}\nRetries were exhausted. Nothing was provisioned or charged. Wait, or raise the key's limits in the Kilawatt console.`;
    case 503: {
      const attempts = Array.isArray(error.body?.attempts)
        ? "\nNodes attempted:\n" +
          error.body.attempts.map((a) => `  - ${a.node}: ${a.error}`).join("\n")
        : "";
      return `No capacity could be placed: ${detail}${attempts}\nNothing was charged. Try a different gpu_type, a smaller card_count, or retry shortly.`;
    }
    default:
      return `Gateway error (HTTP ${error.status}): ${detail}\nNothing was provisioned.`;
  }
}

function formatSuccess(result) {
  if (result.status === "dry_run") {
    const lines = [
      "DRY RUN — nothing was provisioned and nothing was charged.",
      `Authorized: ${result.authorized ? "yes" : "no"}`,
      result.authorized ? null : `Reason: ${result.reason}`,
      `Estimated cost: $${Number(result.billed_usd).toFixed(4)} for ${result.card_count}× ${result.gpu_type}`,
      `Routing policy: ${result.routing_policy}`,
      `Would route through (in order): ${(result.would_route ?? []).join(" → ")}`,
    ].filter(Boolean);
    return lines.join("\n");
  }

  const failover =
    Array.isArray(result.failover_from) && result.failover_from.length > 0
      ? `\nFailed over from: ${result.failover_from.join(", ")}`
      : "";
  return [
    `GPU node running. Job ID: ${result.id}`,
    `Node: ${result.provider}`,
    `Hardware: ${result.card_count}× ${result.gpu_type}`,
    `Workload: ${result.workload_type}   Routing policy: ${result.routing_policy}`,
    `Billed: $${Number(result.billed_usd).toFixed(4)}`,
    `Status: ${result.status}${failover}`,
  ].join("\n");
}

function validate(args) {
  const gpuType = String(args.gpu_type ?? "nvidia-h100").trim();
  if (!gpuType || gpuType.length > 64) {
    throw new Error("gpu_type must be a non-empty string of at most 64 characters.");
  }

  const cardCount = Number(args.card_count ?? 1);
  if (!Number.isInteger(cardCount) || cardCount < 1 || cardCount > MAX_CARD_COUNT) {
    throw new Error(`card_count must be a whole number between 1 and ${MAX_CARD_COUNT}.`);
  }

  const durationSeconds = Number(args.duration_seconds ?? 600);
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 1 ||
    durationSeconds > MAX_DURATION_SECONDS
  ) {
    throw new Error(
      `duration_seconds must be between 1 and ${MAX_DURATION_SECONDS} (24 hours).`,
    );
  }

  const routingPolicy = String(args.routing_policy ?? "lowest_cost");
  if (!ROUTING_POLICIES.includes(routingPolicy)) {
    throw new Error(`routing_policy must be one of: ${ROUTING_POLICIES.join(", ")}.`);
  }

  return {
    gpu_type: gpuType,
    card_count: cardCount,
    duration_seconds: durationSeconds,
    routing_policy: routingPolicy,
    dry_run: args.dry_run === true,
  };
}

const DEPLOY_GPU_NODE = {
  name: "deploy_gpu_node",
  description:
    "Provision real GPU compute on Kilawatt Cloud. Charges the caller's Kilawatt wallet and starts an actual machine. Set dry_run to true to price the run and check balance, spend caps, rate limits and concurrency without provisioning or charging anything.",
  inputSchema: {
    type: "object",
    properties: {
      gpu_type: {
        type: "string",
        description: "GPU model identifier, e.g. nvidia-h100, nvidia-h200, nvidia-b200.",
        default: "nvidia-h100",
      },
      card_count: {
        type: "integer",
        minimum: 1,
        maximum: MAX_CARD_COUNT,
        description: "Number of GPUs to provision.",
        default: 1,
      },
      duration_seconds: {
        type: "number",
        minimum: 1,
        maximum: MAX_DURATION_SECONDS,
        description: "How long the node is needed, in seconds. Billed up front.",
        default: 600,
      },
      routing_policy: {
        type: "string",
        enum: ROUTING_POLICIES,
        description: "How the smart order router picks a node.",
        default: "lowest_cost",
      },
      dry_run: {
        type: "boolean",
        description:
          "Price and pre-authorize only. Returns the cost estimate, the routing order and whether the account is authorized, without provisioning or charging.",
        default: false,
      },
    },
    additionalProperties: false,
  },
};

const server = new Server(
  { name: "kilawatt-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [DEPLOY_GPU_NODE],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== DEPLOY_GPU_NODE.name) {
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
    };
  }

  let payload;
  try {
    payload = validate(request.params.arguments ?? {});
  } catch (error) {
    return { isError: true, content: [{ type: "text", text: error.message }] };
  }

  try {
    const result = await postWithRetry("agent/exec", payload);
    return { content: [{ type: "text", text: formatSuccess(result) }] };
  } catch (error) {
    return { isError: true, content: [{ type: "text", text: describeError(error) }] };
  }
});

async function main() {
  await server.connect(new StdioServerTransport());
  console.error("kilawatt-mcp-server ready on stdio");
}

main().catch((error) => {
  console.error("kilawatt-mcp-server failed to start:", error);
  process.exit(1);
});
