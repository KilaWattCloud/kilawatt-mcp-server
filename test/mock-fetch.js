import { appendFileSync } from "node:fs";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TRACE_PATH = process.env.X402_TEST_TRACE;
let droppedPaidRequest = false;

function trace(entry) {
  if (TRACE_PATH) appendFileSync(TRACE_PATH, `${JSON.stringify(entry)}\n`);
}

const SITE_RESPONSES = {
  capacity: { gpus: [{ gpu_tier: "nvidia-h100", available: 4 }] },
  status: {
    status: "operational",
    status_note: null,
    last_checked: "2026-01-01T00:00:00Z",
    status_page: "https://site.test/status",
    latest_test_summary: null,
  },
  pricing: {
    currency: "USD",
    unit: "gpu_hour",
    tiers: [{ gpu_tier: "nvidia-h100", name: "H100", unit: "gpu_hour", price_usd: 1.5, price_basis: "test" }],
    quote: { method: "POST", url: "https://site.test/quote", note: "test" },
  },
  "resume-info": {
    job_id: "00000000-0000-0000-0000-000000000001",
    checkpoint_count: 2,
    last_checkpoint_at: "2026-01-01T00:00:00Z",
    can_resume: true,
    reason: null,
    resume_action: { method: "POST", url: "https://site.test/resume", body: {}, behavior: "test" },
  },
  resume: {
    id: "00000000-0000-0000-0000-000000000002",
    status: "queued",
    resumed_from_job_id: "00000000-0000-0000-0000-000000000001",
    resumed_from_checkpoint_at: "2026-01-01T00:00:00Z",
  },
};

function siteEndpointFor(url) {
  const { pathname } = new URL(url);
  if (pathname === "/api/capacity") return "capacity";
  if (pathname === "/api/status") return "status";
  if (pathname === "/api/pricing") return "pricing";
  if (/^\/api\/jobs\/[^/]+\/resume-info$/.test(pathname)) return "resume-info";
  if (/^\/api\/jobs\/[^/]+\/resume$/.test(pathname)) return "resume";
  return null;
}

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const headers = new Headers(init.headers);
  if (url.includes("/agent/exec")) {
    trace({ kind: "legacy", url, authorization: headers.has("authorization") });
    return Response.json({
      status: "dry_run",
      authorized: true,
      billed_usd: 0.01,
      card_count: 1,
      gpu_type: "nvidia-h100",
      routing_policy: "lowest_cost",
      would_route: ["test-provider"],
    });
  }
  const siteEndpoint = siteEndpointFor(url);
  if (siteEndpoint) {
    trace({
      kind: "site",
      endpoint: siteEndpoint,
      url,
      method: init.method ?? "GET",
      authorization: headers.get("authorization"),
      contentType: headers.get("content-type"),
      body: init.body ?? null,
    });
    if (process.env.SITE_TEST_STATUS) {
      const errorBody = { error: process.env.SITE_TEST_ERROR ?? "test error" };
      if (process.env.SITE_TEST_CODE) errorBody.code = process.env.SITE_TEST_CODE;
      return Response.json(errorBody, { status: Number(process.env.SITE_TEST_STATUS) });
    }
    return Response.json(SITE_RESPONSES[siteEndpoint]);
  }
  if (url.includes("/jobs/")) {
    trace({
      kind: "status",
      authorizationMatches: headers.get("authorization") === "Bearer " + process.env.X402_TEST_API_KEY,
    });
    return Response.json({
      status: "running",
      ready: false,
      ready_at: null,
      runtime_seconds: 12,
    });
  }
  const paid = headers.has("payment-signature") || headers.has("x-payment");
  trace({
    kind: "x402",
    paid,
    version: headers.get("x402-version"),
    userAgent: headers.get("user-agent"),
    idempotencyKey: headers.get("idempotency-key"),
    paymentHeaderName: headers.has("payment-signature") ? "PAYMENT-SIGNATURE" :
      headers.has("x-payment") ? "X-PAYMENT" : null,
    paymentHeader: headers.get("payment-signature") ?? headers.get("x-payment"),
    contentType: headers.get("content-type"),
    body: init.body,
  });
  if (!paid) {
    const legacyProtocol = process.env.X402_TEST_V1 === "1";
    const accept = {
        scheme: "exact",
        network: legacyProtocol ? "base" : "eip155:8453",
        asset: USDC,
        ...(legacyProtocol
          ? { maxAmountRequired: process.env.X402_TEST_AMOUNT ?? "10000" }
          : { amount: process.env.X402_TEST_AMOUNT ?? "10000" }),
        payTo: "0x1111111111111111111111111111111111111111",
        maxTimeoutSeconds: 60,
        extra: { name: "USD Coin", version: "2" },
    };
    const accepts = process.env.X402_TEST_MULTI_ACCEPTS === "1" && !legacyProtocol
      ? [
        { ...accept, network: "eip155:1", amount: "999999999" },
        accept,
      ]
      : [accept];
    const required = { x402Version: legacyProtocol ? 1 : 2, accepts };
    return new Response(JSON.stringify(required), {
      status: 402,
      headers: legacyProtocol ? {} : {
        "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(required)).toString("base64"),
      },
    });
  }
  if (process.env.X402_TEST_DROP_FIRST_PAID === "1" && !droppedPaidRequest) {
    droppedPaidRequest = true;
    throw new TypeError("simulated network interruption");
  }
  if (process.env.X402_TEST_STATUS) {
    return Response.json({
      error: process.env.X402_TEST_ERROR ?? "unknown_error",
      transaction_hash: `0x${"a".repeat(64)}`,
      job_id: "existing-job",
    }, { status: Number(process.env.X402_TEST_STATUS) });
  }
  return Response.json({
    job_id: "test-job",
    status: "queued",
    provider: "test-provider",
    gpu_type: "nvidia-h100",
    card_count: 1,
    billed_usd: 0.01,
    payment: {
      transaction_hash: `0x${"b".repeat(64)}`,
      network: "eip155:8453",
      amount_usd: 0.01,
      payer: "0x2222222222222222222222222222222222222222",
    },
    api_key: process.env.X402_TEST_API_KEY,
  });
};
