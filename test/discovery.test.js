import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { McpProcess } from "./mcp-process.js";

const apiKey = "kw_live_discovery_test_key_must_not_be_printed";
const jobId = "0a1b2c3d-0000-4000-8000-00000000abcd";
const siteUrl = "https://site.test";

const ORIGINAL_TOOLS = ["deploy_gpu_node", "x402_quote", "x402_run_job", "x402_job_status"];
const DISCOVERY_TOOLS = [
  "get_capacity",
  "get_platform_status",
  "get_pricing",
  "get_resume_info",
  "resume_job",
];

const resumeArgs = { job_id: jobId, confirm: true, max_spend_usd: 2.5 };

// Each tool with valid arguments and the request it must make.
const CALLS = {
  get_capacity: { args: {}, method: "GET", path: "/api/capacity", auth: false },
  get_platform_status: { args: {}, method: "GET", path: "/api/status", auth: false },
  get_pricing: { args: {}, method: "GET", path: "/api/pricing", auth: false },
  get_resume_info: {
    args: { job_id: jobId },
    method: "GET",
    path: `/api/jobs/${jobId}/resume-info`,
    auth: true,
  },
  resume_job: {
    args: resumeArgs,
    method: "POST",
    path: `/api/jobs/${jobId}/resume`,
    auth: true,
  },
};

async function start(env = {}) {
  const directory = await mkdtemp(resolve(tmpdir(), "kilawatt-discovery-test-"));
  const tracePath = resolve(directory, "requests.log");
  const server = new McpProcess({
    KILAWATT_API_KEY: apiKey,
    KILAWATT_SITE_URL: `${siteUrl}/`,
    KILAWATT_BASE_URL: "https://gateway.test/api/public/v1",
    KILAWATT_X402_URL: "https://x402.test/exec",
    X402_TEST_TRACE: tracePath,
    ...env,
  });
  await server.initialize();
  return {
    server,
    async requests() {
      try {
        return (await readFile(tracePath, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse);
      } catch {
        return [];
      }
    },
    async stop() {
      await server.stop();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

async function withServer(env, fn) {
  const context = await start(env);
  try {
    await fn(context);
  } finally {
    await context.stop();
  }
}

function text(response) {
  return response.result.content[0].text;
}

// tools/list: original tools plus the five new ones, with annotations.
await withServer({}, async ({ server }) => {
  const response = await server.request("tools/list");
  const tools = response.result.tools;
  const names = tools.map((tool) => tool.name);
  for (const name of [...ORIGINAL_TOOLS, ...DISCOVERY_TOOLS]) {
    assert.ok(names.includes(name), `tools/list should include ${name}`);
  }
  assert.equal(names.length, ORIGINAL_TOOLS.length + DISCOVERY_TOOLS.length);
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
  for (const name of ["get_capacity", "get_platform_status", "get_pricing", "get_resume_info"]) {
    assert.equal(byName[name].annotations?.readOnlyHint, true, `${name} should be read-only`);
  }
  assert.equal(byName.resume_job.annotations?.readOnlyHint, false);
  assert.equal(byName.resume_job.annotations?.destructiveHint, false);
  assert.match(byName.resume_job.description, /PAID run/);
  assert.match(byName.resume_job.description, /different supplier/);
  assert.match(byName.resume_job.description, /confirm set to true/);
  assert.match(byName.resume_job.description, /spend cap/);
  assert.match(byName.resume_job.description, /get_resume_info first/);
  assert.match(byName.resume_job.description, /ask the user/);
  assert.match(byName.get_pricing.description, /indicative/);
  assert.match(byName.get_pricing.description, /unpaid x402 request/);
});

// Success: URL, method, auth header, pretty JSON output, no key in output.
await withServer({}, async ({ server, requests }) => {
  for (const [name, call] of Object.entries(CALLS)) {
    const before = (await requests()).length;
    const response = await server.call(name, call.args);
    assert.equal(response.result.isError, undefined, `${name} should succeed: ${text(response)}`);
    const sent = (await requests()).slice(before);
    assert.equal(sent.length, 1, `${name} should make exactly one request`);
    assert.equal(sent[0].kind, "site");
    assert.equal(sent[0].url, `${siteUrl}${call.path}`);
    assert.equal(sent[0].method, call.method);
    assert.equal(sent[0].authorization, call.auth ? `Bearer ${apiKey}` : null);
    assert.ok(!text(response).includes(apiKey), `${name} output must not include the API key`);
    assert.match(text(response), /\n  "/, `${name} should return pretty JSON`);
  }
});

await withServer({}, async ({ server }) => {
  const status = text(await server.call("get_platform_status"));
  assert.match(status, /"status": "operational"/);
  assert.match(status, /"latest_test_summary": null/);
  const pricing = text(await server.call("get_pricing"));
  assert.match(pricing, /"unit": "gpu_hour"/);
  const info = text(await server.call("get_resume_info", { job_id: jobId }));
  assert.match(info, /"can_resume": true/);
  const resumed = text(await server.call("resume_job", resumeArgs));
  assert.match(resumed, /Resume started/);
  assert.match(resumed, /"resumed_from_job_id"/);
  assert.match(resumed, /"resumed_from_checkpoint_at"/);
});

// Default site URL when KILAWATT_SITE_URL is not set (fetch is mocked).
await withServer({ KILAWATT_SITE_URL: undefined }, async ({ server, requests }) => {
  await server.call("get_capacity");
  assert.equal((await requests())[0].url, "https://www.kilawattcloud.dev/api/capacity");
});

// resume_job: exact JSON body and content type.
await withServer({}, async ({ server, requests }) => {
  await server.call("resume_job", resumeArgs);
  await server.call("resume_job", { ...resumeArgs, duration_seconds: 600 });
  const [withoutDuration, withDuration] = await requests();
  assert.equal(withoutDuration.contentType, "application/json");
  assert.equal(withoutDuration.body, '{"confirm":true,"max_spend_usd":2.5}');
  assert.equal(withDuration.body, '{"confirm":true,"max_spend_usd":2.5,"duration_seconds":600}');
});

// Local validation: no network call for invalid input.
await withServer({}, async ({ server, requests }) => {
  const cases = [
    ["get_resume_info", {}, /job_id must be a 36 character job ID/],
    ["get_resume_info", { job_id: "abc" }, /job_id must be a 36 character job ID/],
    ["get_resume_info", { job_id: 12 }, /job_id must be a 36 character job ID/],
    ["get_resume_info", { job_id: "0a1b2c3d-0000-4000-8000-00000000abcg" }, /job_id must be/],
    ["get_resume_info", { job_id: "../../api/capacity/0000000000000000000" }, /job_id must be/],
    ["resume_job", { ...resumeArgs, job_id: "abc" }, /job_id must be/],
    ["resume_job", { job_id: jobId, max_spend_usd: 2.5 }, /confirm must be exactly true/],
    ["resume_job", { ...resumeArgs, confirm: false }, /confirm must be exactly true/],
    ["resume_job", { ...resumeArgs, confirm: "true" }, /confirm must be exactly true/],
    ["resume_job", { ...resumeArgs, confirm: 1 }, /confirm must be exactly true/],
    ["resume_job", { job_id: jobId, confirm: true }, /max_spend_usd is required/],
    ["resume_job", { ...resumeArgs, max_spend_usd: 0 }, /max_spend_usd is required/],
    ["resume_job", { ...resumeArgs, max_spend_usd: -1 }, /max_spend_usd is required/],
    ["resume_job", { ...resumeArgs, max_spend_usd: "2.5" }, /max_spend_usd is required/],
    ["resume_job", { ...resumeArgs, max_spend_usd: null }, /max_spend_usd is required/],
    ["resume_job", { ...resumeArgs, duration_seconds: 59 }, /duration_seconds must be a whole number/],
    ["resume_job", { ...resumeArgs, duration_seconds: 86401 }, /duration_seconds must be a whole number/],
    ["resume_job", { ...resumeArgs, duration_seconds: 600.5 }, /duration_seconds must be a whole number/],
    ["resume_job", { ...resumeArgs, duration_seconds: "600" }, /duration_seconds must be a whole number/],
    ["resume_job", { ...resumeArgs, duration_seconds: null }, /duration_seconds must be a whole number/],
  ];
  for (const [name, args, message] of cases) {
    const response = await server.call(name, args);
    assert.equal(response.result.isError, true, `${name} should reject ${JSON.stringify(args)}`);
    assert.match(text(response), message);
    assert.ok(!text(response).includes(apiKey));
  }
  assert.equal((await requests()).length, 0, "invalid input must not reach the network");
});

// Missing or malformed API key: no network call, key never printed.
for (const [key, message] of [
  ["", /KILAWATT_API_KEY is not set/],
  ["not_a_kilawatt_key_value", /does not look like a Kilawatt key/],
]) {
  await withServer({ KILAWATT_API_KEY: key }, async ({ server, requests }) => {
    for (const name of ["get_resume_info", "resume_job"]) {
      const response = await server.call(name, CALLS[name].args);
      assert.equal(response.result.isError, true);
      assert.match(text(response), message);
      if (key) assert.ok(!text(response).includes(key));
    }
    assert.equal((await requests()).length, 0);
    const publicCall = await server.call("get_capacity");
    assert.equal(publicCall.result.isError, undefined, "public tools work without an API key");
  });
}

// Error mapping for every tool and status: one request, no retry, no key.
for (const [name, call] of Object.entries(CALLS)) {
  for (const status of [401, 404, 409, 429, 503]) {
    await withServer({ SITE_TEST_STATUS: String(status) }, async ({ server, requests }) => {
      const response = await server.call(name, call.args);
      assert.equal(response.result.isError, true, `${name} should fail on HTTP ${status}`);
      assert.match(text(response), new RegExp(`HTTP ${status}\\.`));
      assert.match(text(response), /Server error: test error/);
      assert.ok(!text(response).includes(apiKey));
      assert.equal((await requests()).length, 1, `${name} must not retry HTTP ${status}`);
    });
  }
}

// Specific server codes and the messages they map to.
for (const [name, status, code, expected] of [
  ["get_capacity", 503, "unavailable", /not available right now/],
  ["get_platform_status", 503, undefined, /not available right now/],
  ["get_pricing", 404, undefined, /Check KILAWATT_SITE_URL/],
  ["get_resume_info", 401, "unauthorized", /Authentication failed/],
  ["get_resume_info", 404, "not_found", /No job with this job_id was found/],
  ["get_resume_info", 429, undefined, /repeated failed authentication/],
  ["resume_job", 401, "unauthorized", /Authentication failed/],
  ["resume_job", 404, "not_found", /No job with this job_id was found/],
  ["resume_job", 409, "no_checkpoint", /no checkpoint to resume from/],
  ["resume_job", 409, "job_still_running", /still running/],
  ["resume_job", 400, "confirmation_required", /requires confirm to be true/],
  ["resume_job", 400, "spend_cap_required", /requires a positive max_spend_usd/],
  ["resume_job", 400, "invalid_duration", /rejected duration_seconds/],
  ["resume_job", 429, undefined, /was not retried/],
]) {
  const env = { SITE_TEST_STATUS: String(status) };
  if (code) env.SITE_TEST_CODE = code;
  await withServer(env, async ({ server, requests }) => {
    const response = await server.call(name, CALLS[name].args);
    assert.equal(response.result.isError, true);
    assert.match(text(response), expected, `${name} ${status} ${code}`);
    if (code) assert.match(text(response), new RegExp(`Server code: ${code}`));
    assert.ok(!text(response).includes(apiKey));
    assert.equal((await requests()).length, 1);
  });
}

console.log("Discovery tools, resume guards, error mapping, and tool listing passed.");
