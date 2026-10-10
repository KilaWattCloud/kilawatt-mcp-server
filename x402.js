import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { formatUnits } from "viem";

const DEFAULT_URL = "https://www.kilawattcloud.dev/api/public/x402/exec";
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const JOBS_URL = "https://www.kilawattcloud.dev/api/public/v1/jobs";
const NETWORK = "eip155:8453";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const GPU_TYPES = [
  "nvidia-b300", "nvidia-b200", "nvidia-h200", "nvidia-h100", "nvidia-a100",
  "nvidia-l40s", "nvidia-l40", "nvidia-a40", "nvidia-a10", "nvidia-rtx-a6000",
  "nvidia-rtx-a5000", "nvidia-rtx-a4500", "nvidia-rtx-a4000", "nvidia-rtx-5090",
  "nvidia-rtx-4090", "nvidia-rtx-3090",
];
const ROUTING_POLICIES = ["lowest_cost", "lowest_latency", "zero_quota"];
const WORKLOAD_TYPES = ["agent_exec", "fine_tune", "batch_inference"];
const API_KEY_PATH = join(homedir(), ".config", "kilawatt", "x402-api-key");
let sessionSpentUsd = 0;

export const X402_TOOLS = [
  {
    name: "x402_quote",
    description: "Get the current price and Base USDC payment details for a GPU job without paying.",
    inputSchema: {
      type: "object",
      properties: {
        gpu_type: { type: "string", enum: GPU_TYPES, default: "nvidia-h100" },
        card_count: { type: "integer", minimum: 1, maximum: 16, default: 1 },
        duration_seconds: { type: "number", minimum: 60, maximum: 86400, default: 600 },
        routing_policy: { type: "string", enum: ROUTING_POLICIES },
        workload_type: { type: "string", enum: WORKLOAD_TYPES },
      },
      additionalProperties: false,
    },
  },
  {
    name: "x402_run_job",
    description: "Quote and, only with confirm=true and all spend caps passing, pay for one GPU job in Base USDC.",
    inputSchema: {
      type: "object",
      properties: {
        gpu_type: { type: "string", enum: GPU_TYPES, default: "nvidia-h100" },
        card_count: { type: "integer", minimum: 1, maximum: 16, default: 1 },
        duration_seconds: { type: "number", minimum: 60, maximum: 86400, default: 600 },
        routing_policy: { type: "string", enum: ROUTING_POLICIES },
        workload_type: { type: "string", enum: WORKLOAD_TYPES },
        max_usd: { type: "number", exclusiveMinimum: 0 },
        confirm: { type: "boolean" },
      },
      required: ["max_usd", "confirm"],
      additionalProperties: false,
    },
  },
  {
    name: "x402_job_status",
    description: "Get the status of a job created through x402 using this server's locally saved API key.",
    inputSchema: {
      type: "object",
      properties: { job_id: { type: "string", minLength: 1, maxLength: 128 } },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
];

function endpoint() {
  return process.env.KILAWATT_X402_URL ?? DEFAULT_URL;
}

function cap(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return value;
}

function validate(args) {
  const gpuType = args.gpu_type ?? "nvidia-h100";
  if (typeof gpuType !== "string" || !GPU_TYPES.includes(gpuType)) {
    throw new Error(`gpu_type must be one of: ${GPU_TYPES.join(", ")}.`);
  }
  const cardCount = args.card_count ?? 1;
  const maxCards = gpuType === "nvidia-b200" ? 4 :
    ["nvidia-h100", "nvidia-h200", "nvidia-a100", "nvidia-l40s"].includes(gpuType) ? 8 : 16;
  if (!Number.isInteger(cardCount) || cardCount < 1 || cardCount > maxCards) {
    throw new Error(`card_count for ${gpuType} must be a whole number between 1 and ${maxCards}.`);
  }
  const durationSeconds = args.duration_seconds ?? 600;
  if (!Number.isFinite(durationSeconds) || durationSeconds < 60 || durationSeconds > 86400) {
    throw new Error("duration_seconds must be between 60 and 86400.");
  }
  if (args.routing_policy !== undefined && !ROUTING_POLICIES.includes(args.routing_policy)) {
    throw new Error(`routing_policy must be one of: ${ROUTING_POLICIES.join(", ")}.`);
  }
  if (args.workload_type !== undefined && !WORKLOAD_TYPES.includes(args.workload_type)) {
    throw new Error(`workload_type must be one of: ${WORKLOAD_TYPES.join(", ")}.`);
  }
  const payload = { gpu_type: gpuType, card_count: cardCount, duration_seconds: durationSeconds };
  if (args.routing_policy !== undefined) payload.routing_policy = args.routing_policy;
  if (args.workload_type !== undefined) payload.workload_type = args.workload_type;
  return payload;
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function readRequirements(httpClient, response, body) {
  const required = httpClient.getPaymentRequiredResponse(
    (name) => response.headers.get(name),
    body,
  );
  const accept = required.accepts?.find((item) =>
    (item.network === NETWORK || (required.x402Version === 1 && item.network === "base")) &&
    typeof item.asset === "string" && item.asset.toLowerCase() === USDC.toLowerCase()
  );
  if (!accept) throw new Error("The endpoint did not offer a supported Base USDC payment.");
  const amount = accept.amount ?? accept.maxAmountRequired;
  if (typeof amount !== "string" || !/^\d+$/.test(amount)) {
    throw new Error("The endpoint returned an invalid payment amount.");
  }
  return { required, accept, priceUsd: Number(formatUnits(BigInt(amount), 6)) };
}

function getQuote(accept, required, priceUsd) {
  const quote = { price_usd: priceUsd, network: NETWORK, pay_to: accept.payTo };
  const expiry = accept.expiresAt ?? accept.expires ?? required.expiresAt ?? required.expires;
  if (expiry) quote.expires_at = expiry;
  if (Number.isFinite(accept.maxTimeoutSeconds)) {
    quote.expires_in_seconds = accept.maxTimeoutSeconds;
  }
  return quote;
}

function quoteText(quote) {
  return [
    `Price: $${quote.price_usd.toFixed(6)} USD`,
    `Network: ${quote.network}`,
    `Pay to: ${quote.pay_to}`,
    quote.expires_at ? `Expires: ${quote.expires_at}` : null,
    quote.expires_in_seconds ? `Payment valid for: ${quote.expires_in_seconds} seconds` : null,
  ].filter(Boolean).join("\n");
}

function errorText(status, body) {
  const code = typeof body?.error === "string" ? body.error : body?.code;
  const known = {
    invalid_json: "Invalid JSON request. Nothing was charged.",
    unknown_gpu_type: `Unknown GPU type. Valid GPU types: ${GPU_TYPES.join(", ")}. Nothing was charged.`,
    size_not_available: "The requested GPU size is not available. Nothing was charged.",
    wrong_payment_header: "The payment header is invalid for this protocol version. Nothing was charged.",
    price_changed: "The price changed before payment. Nothing was charged; request a new quote.",
    insufficient_funds_or_invalid_signature: "Payment was declined because funds or signature validation failed. Nothing was charged.",
    payment_already_used: "This payment was already used and was not charged again.",
    sanctions_screening: "Payment was rejected by sanctions screening. Nothing was charged.",
    sanctions_screening_failed: "Payment was rejected by sanctions screening. Nothing was charged.",
    unsupported_media_type: "The endpoint requires application/json. Nothing was charged.",
    rate_limited: "The x402 endpoint is rate limiting requests. Nothing was charged; try later.",
    no_capacity: "No matching capacity is available. No payment was taken.",
  };
  if (known[code]) {
    const transaction = code === "payment_already_used" &&
      typeof body?.transaction_hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(body.transaction_hash)
      ? ` Transaction: ${body.transaction_hash}.`
      : "";
    const job = code === "payment_already_used" &&
      typeof body?.job_id === "string" && /^[\w-]{1,128}$/.test(body.job_id)
      ? ` Job ID: ${body.job_id}.`
      : "";
    return `${known[code]}${transaction}${job}`;
  }
  if (status === 400) return "The endpoint rejected the request (HTTP 400). Check the arguments; nothing was charged.";
  if (status === 402) return "Payment was required or declined. Nothing was charged.";
  if (status === 403) return "Payment was rejected by sanctions screening. Nothing was charged.";
  if (status === 409) return "The payment was already used and was not charged again.";
  if (status === 415) return "The endpoint requires JSON content. Nothing was charged.";
  if (status === 429) return "The x402 endpoint is rate limiting requests. Nothing was charged; try later.";
  if (status === 503) return "No matching capacity is available. No payment was taken.";
  return `The x402 endpoint returned HTTP ${status}.`;
}

async function quoteRequest(payload) {
  let response;
  try {
    response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `kilawatt-mcp-server/${version} (x402)`,
        "X402-Version": "2",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Could not reach the x402 endpoint. No payment was made.");
  }
  const body = await readBody(response);
  if (response.status !== 402) {
    if (!response.ok) throw new Error(errorText(response.status, body));
    throw new Error("The x402 endpoint did not return payment requirements.");
  }
  const httpClient = new x402HTTPClient(new x402Client());
  const parsed = readRequirements(httpClient, response, body);
  return { ...parsed, quote: getQuote(parsed.accept, parsed.required, parsed.priceUsd) };
}

function createPaymentClient(key) {
  try {
    const client = new x402Client();
    registerExactEvmScheme(client, {
      signer: privateKeyToAccount(key),
      networks: [NETWORK],
    });
    return { client, httpClient: new x402HTTPClient(client) };
  } catch {
    throw new Error("KILAWATT_X402_PRIVATE_KEY is invalid. Use a valid EVM private key.");
  }
}

async function saveApiKey(key) {
  const directory = dirname(API_KEY_PATH);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  await writeFile(API_KEY_PATH, `${key}\n`, { mode: 0o600 });
  await chmod(API_KEY_PATH, 0o600);
}

function jobText(body) {
  const payment = body.payment ?? {};
  return [
    `Job ID: ${body.job_id}`,
    `Status: ${body.status}`,
    `Provider: ${body.provider}`,
    `GPU: ${body.card_count}× ${body.gpu_type}`,
    `Billed: $${Number(body.billed_usd).toFixed(6)} USD`,
    `Payment transaction: ${payment.transaction_hash}`,
    `Basescan: https://basescan.org/tx/${payment.transaction_hash}`,
    `Network: ${payment.network}`,
    `Amount: $${Number(payment.amount_usd).toFixed(6)} USD`,
    `Payer: ${payment.payer}`,
  ].join("\n");
}

async function runJob(args) {
  if (typeof args.max_usd !== "number" || !Number.isFinite(args.max_usd) || args.max_usd <= 0) {
    throw new Error("max_usd is required and must be a positive number.");
  }
  if (typeof args.confirm !== "boolean") {
    throw new Error("confirm is required and must be a boolean.");
  }
  const payload = validate(args);
  const { quote, required, priceUsd } = await quoteRequest(payload);
  const quotedText = quoteText(quote);
  if (args.confirm !== true) {
    return `${quotedText}\nNothing was paid. Set confirm: true to proceed.`;
  }
  const perJobCap = cap("KILAWATT_X402_MAX_USD_PER_JOB", 0.25);
  const sessionCap = cap("KILAWATT_X402_MAX_USD_PER_SESSION", 1);
  if (priceUsd > args.max_usd) {
    return `${quotedText}\nRefused: price exceeds max_usd ($${args.max_usd.toFixed(6)}). Nothing was paid.`;
  }
  if (priceUsd > perJobCap) {
    return `${quotedText}\nRefused: price exceeds KILAWATT_X402_MAX_USD_PER_JOB ($${perJobCap.toFixed(6)}). Nothing was paid.`;
  }
  if (sessionSpentUsd + priceUsd > sessionCap) {
    return `${quotedText}\nRefused: price exceeds the remaining session cap ($${Math.max(0, sessionCap - sessionSpentUsd).toFixed(6)}). Nothing was paid.`;
  }
  const privateKey = process.env.KILAWATT_X402_PRIVATE_KEY;
  if (!privateKey) throw new Error("KILAWATT_X402_PRIVATE_KEY is required to pay for an x402 job.");
  const { client, httpClient } = createPaymentClient(privateKey);
  const idempotencyKey = randomUUID();
  sessionSpentUsd += priceUsd;
  let response;
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const payment = await client.createPaymentPayload(required);
      const paymentHeaders = httpClient.encodePaymentSignatureHeader(payment);
      try {
        response = await fetch(endpoint(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": `kilawatt-mcp-server/${version} (x402)`,
            "X402-Version": "2",
            "Idempotency-Key": idempotencyKey,
            ...paymentHeaders,
          },
          body: JSON.stringify(payload),
        });
        break;
      } catch {
        if (attempt === 1) throw new Error("network failure");
      }
    }
  } catch {
    throw new Error("The paid request could not be confirmed after one idempotent retry. Check job status before trying again.");
  }

  const body = await readBody(response);
  if (!response.ok) {
    sessionSpentUsd -= priceUsd;
    throw new Error(errorText(response.status, body));
  }
  let keySaved = false;
  if (typeof body.api_key === "string" && body.api_key) {
    try {
      await saveApiKey(body.api_key);
      keySaved = true;
    } catch {
      keySaved = false;
    }
  }
  const saveNote = keySaved
    ? `API key saved to ${API_KEY_PATH}; it is not shown here.`
    : typeof body.api_key === "string"
      ? "The API key could not be saved; it is not shown here and cannot be recovered."
      : "No API key was issued.";
  return `${jobText(body)}\n${saveNote}`;
}

async function jobStatus(args) {
  if (typeof args.job_id !== "string" || !args.job_id.trim() || args.job_id.length > 128) {
    throw new Error("job_id must be a non-empty string of at most 128 characters.");
  }
  let key;
  try {
    key = (await readFile(API_KEY_PATH, "utf8")).trim();
  } catch {
    throw new Error("No saved x402 API key was found. Run a paid job from this server first.");
  }
  if (!key) throw new Error("No saved x402 API key was found. Run a paid job from this server first.");
  let response;
  try {
    response = await fetch(`${JOBS_URL}/${encodeURIComponent(args.job_id)}`, {
      headers: {
        Authorization: "Bearer " + key,
        "User-Agent": `kilawatt-mcp-server/${version} (x402)`,
      },
    });
  } catch {
    throw new Error("Could not reach the Kilawatt job status endpoint.");
  }
  const body = await readBody(response);
  if (!response.ok) throw new Error(`Job status request failed with HTTP ${response.status}.`);
  const result = { status: body.status, ready: body.ready };
  for (const field of ["ready_at", "ended_at", "runtime_seconds"]) {
    if (body[field] !== undefined) result[field] = body[field];
  }
  return JSON.stringify(result);
}

function redact(text) {
  const secrets = [process.env.KILAWATT_X402_PRIVATE_KEY];
  return secrets.filter(Boolean).reduce((value, secret) => value.split(secret).join("[redacted]"), text);
}

export async function callX402Tool(name, args = {}) {
  try {
    let result;
    if (name === "x402_quote") {
      const payload = validate(args);
      const { quote } = await quoteRequest(payload);
      result = quoteText(quote);
    } else if (name === "x402_run_job") {
      result = await runJob(args);
    } else if (name === "x402_job_status") {
      result = await jobStatus(args);
    } else {
      throw new Error(`Unknown x402 tool: ${name}`);
    }
    return { content: [{ type: "text", text: redact(result) }] };
  } catch (error) {
    return { isError: true, content: [{ type: "text", text: redact(error.message) }] };
  }
}
