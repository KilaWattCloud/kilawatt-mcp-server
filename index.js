#!/usr/bin/env node
/**
 * kilawatt-mcp-server
 *
 * MCP server exposing Kilawatt Cloud GPU provisioning. It talks to the real
 * Kilawatt public and x402 gateways; results come from their HTTP responses.
 *
 * Environment:
 *   KILAWATT_API_KEY          needed for deploy_gpu_node, format kw_live_...
 *   KILAWATT_BASE_URL         optional, defaults to the production gateway
 *   KILAWATT_SITE_URL         optional, site root for the discovery and resume tools
 *   KILAWATT_X402_PRIVATE_KEY needed only to pay for x402 jobs
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { callX402Tool, X402_TOOLS } from "./x402.js";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);
const DEFAULT_BASE_URL = "https://www.kilawattcloud.dev/api/public/v1";
const DEFAULT_SITE_URL = "https://www.kilawattcloud.dev";
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

function siteUrl() {
  return (process.env.KILAWATT_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/+$/, "");
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

const JOB_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const MIN_RESUME_DURATION_SECONDS = 60;

const NO_INPUT = { type: "object", properties: {}, additionalProperties: false };
const JOB_ID_PROPERTY = {
  type: "string",
  pattern: "^[0-9a-fA-F-]{36}$",
  description: "The job ID (36 characters, hex digits and dashes).",
};

const DISCOVERY_TOOLS = [
  {
    name: "get_capacity",
    description:
      "Read current GPU capacity data from Kilawatt Cloud. Read-only: no API key is needed and nothing is provisioned or charged. If capacity data is not available right now, the tool says so.",
    inputSchema: NO_INPUT,
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_platform_status",
    description:
      "Read the current Kilawatt Cloud platform status: status (operational, degraded, incident or unknown), a status note, when it was last checked, and links to the status page and the latest test summary. Read-only: no API key is needed and nothing is charged.",
    inputSchema: NO_INPUT,
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_pricing",
    description:
      "Read indicative USD prices per GPU hour for each GPU tier. Read-only: no API key is needed and nothing is charged. These prices are indicative only. The exact price for a job comes from an unpaid x402 request (use x402_quote).",
    inputSchema: NO_INPUT,
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_resume_info",
    description:
      "Check whether a job can be resumed from its last checkpoint. Returns the checkpoint count, the last checkpoint time, can_resume, the reason when it cannot be resumed, and the resume action. Read-only: nothing is started or charged. Needs KILAWATT_API_KEY.",
    inputSchema: {
      type: "object",
      properties: { job_id: JOB_ID_PROPERTY },
      required: ["job_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "resume_job",
    description:
      "Start a NEW PAID run that resumes a job from its last checkpoint on a different supplier. This spends money. It requires confirm set to true and a spend cap in max_spend_usd. Call get_resume_info first, show the user what it returns, and ask the user before calling this tool with confirm true. The request is never retried automatically. Needs KILAWATT_API_KEY.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: JOB_ID_PROPERTY,
        confirm: {
          type: "boolean",
          const: true,
          description: "Must be exactly true, and only after the user has agreed to start a paid run.",
        },
        max_spend_usd: {
          type: "number",
          exclusiveMinimum: 0,
          description: "Required spend cap in USD for the new run. Must be a positive number.",
        },
        duration_seconds: {
          type: "integer",
          minimum: MIN_RESUME_DURATION_SECONDS,
          maximum: MAX_DURATION_SECONDS,
          description: "Optional run length in seconds, a whole number from 60 to 86400.",
        },
      },
      required: ["job_id", "confirm", "max_spend_usd"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
];

function validateJobId(args) {
  const jobId = args.job_id;
  if (typeof jobId !== "string" || !JOB_ID_PATTERN.test(jobId)) {
    throw new Error("job_id must be a 36 character job ID made of hex digits and dashes.");
  }
  return jobId;
}

function validateResume(args) {
  const jobId = validateJobId(args);
  if (args.confirm !== true) {
    throw new Error(
      "confirm must be exactly true. resume_job starts a new paid run: call get_resume_info first and ask the user before confirming. Nothing was sent.",
    );
  }
  const maxSpend = args.max_spend_usd;
  if (typeof maxSpend !== "number" || !Number.isFinite(maxSpend) || maxSpend <= 0) {
    throw new Error("max_spend_usd is required and must be a positive number. Nothing was sent.");
  }
  const body = { confirm: true, max_spend_usd: maxSpend };
  if (args.duration_seconds !== undefined) {
    const duration = args.duration_seconds;
    if (
      !Number.isInteger(duration) ||
      duration < MIN_RESUME_DURATION_SECONDS ||
      duration > MAX_DURATION_SECONDS
    ) {
      throw new Error(
        `duration_seconds must be a whole number between ${MIN_RESUME_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}. Nothing was sent.`,
      );
    }
    body.duration_seconds = duration;
  }
  return { jobId, body };
}

// One request to the site root. Never retried: resume_job can spend money,
// and the job endpoints return 429 after repeated failed authentication.
async function siteRequest(method, path, { auth = false, body } = {}) {
  const headers = {};
  if (auth) headers.authorization = `Bearer ${apiKey()}`;
  if (body !== undefined) headers["content-type"] = "application/json";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${siteUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    if (controller.signal.aborted) throw new GatewayTimeoutError(REQUEST_TIMEOUT_MS);
    throw new GatewayConnectionError(cause);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { error: text };
  }

  if (!response.ok) throw new GatewayError(response.status, parsed);
  return parsed;
}

const SITE_ERROR_HINTS = {
  unavailable: "This data is not available right now. Try again later.",
  unauthorized:
    "Authentication failed. The API key is missing, malformed or revoked. Set KILAWATT_API_KEY to a valid key.",
  not_found: "No job with this job_id was found for this API key.",
  no_checkpoint: "This job has no checkpoint to resume from. No new run was started.",
  job_still_running: "This job is still running, so it cannot be resumed yet. No new run was started.",
  confirmation_required: "The server requires confirm to be true. No new run was started.",
  spend_cap_required: "The server requires a positive max_spend_usd. No new run was started.",
  invalid_duration: "The server rejected duration_seconds. No new run was started.",
};

function describeSiteError(error, { spends = false } = {}) {
  if (!(error instanceof GatewayError)) {
    if (spends && (error instanceof GatewayTimeoutError || error instanceof GatewayConnectionError)) {
      return `${error.message}. The resume request may or may not have reached the server, and it was not retried. Call get_resume_info before trying again.`;
    }
    if (error instanceof GatewayTimeoutError || error instanceof GatewayConnectionError) {
      return `${error.message}. Nothing was started or charged. Check KILAWATT_SITE_URL if this keeps happening.`;
    }
    return error?.message ?? String(error);
  }

  const code = typeof error.body?.code === "string" ? error.body.code : null;
  let hint = code ? SITE_ERROR_HINTS[code] : undefined;
  if (!hint) {
    switch (error.status) {
      case 401:
        hint = SITE_ERROR_HINTS.unauthorized;
        break;
      case 404:
        hint = "Endpoint not found. Check KILAWATT_SITE_URL.";
        break;
      case 429:
        hint =
          "Too many requests. On the job endpoints this follows repeated failed authentication attempts. Wait before trying again. The request was not retried.";
        break;
      case 503:
        hint = SITE_ERROR_HINTS.unavailable;
        break;
      default:
        hint = describeError(error);
    }
  }

  const serverFields = [
    typeof error.body?.error === "string" ? `Server error: ${error.body.error}` : null,
    code ? `Server code: ${code}` : null,
  ].filter(Boolean);
  return [`HTTP ${error.status}. ${hint}`, ...serverFields].join("\n");
}

const pretty = (body) => JSON.stringify(body, null, 2);

async function callDiscoveryTool(name, args) {
  let request;
  try {
    switch (name) {
      case "get_capacity":
        request = () => siteRequest("GET", "/api/capacity");
        break;
      case "get_platform_status":
        request = () => siteRequest("GET", "/api/status");
        break;
      case "get_pricing":
        request = () => siteRequest("GET", "/api/pricing");
        break;
      case "get_resume_info": {
        const jobId = validateJobId(args);
        apiKey();
        request = () =>
          siteRequest("GET", `/api/jobs/${encodeURIComponent(jobId)}/resume-info`, { auth: true });
        break;
      }
      case "resume_job": {
        const { jobId, body } = validateResume(args);
        apiKey();
        request = () =>
          siteRequest("POST", `/api/jobs/${encodeURIComponent(jobId)}/resume`, { auth: true, body });
        break;
      }
    }
  } catch (error) {
    return { isError: true, content: [{ type: "text", text: error.message }] };
  }

  const spends = name === "resume_job";
  try {
    const result = await request();
    const text = spends
      ? `Resume started. A new paid run was created.\n${pretty(result)}`
      : pretty(result);
    return { content: [{ type: "text", text }] };
  } catch (error) {
    return { isError: true, content: [{ type: "text", text: describeSiteError(error, { spends }) }] };
  }
}

const server = new Server(
  { name: "kilawatt-mcp-server", version },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [DEPLOY_GPU_NODE, ...X402_TOOLS, ...DISCOVERY_TOOLS],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== DEPLOY_GPU_NODE.name) {
    if (X402_TOOLS.some((tool) => tool.name === request.params.name)) {
      return callX402Tool(request.params.name, request.params.arguments ?? {});
    }
    if (DISCOVERY_TOOLS.some((tool) => tool.name === request.params.name)) {
      return callDiscoveryTool(request.params.name, request.params.arguments ?? {});
    }
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
