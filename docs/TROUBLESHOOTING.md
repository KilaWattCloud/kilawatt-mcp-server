# Troubleshooting

Each error message from the server says whether anything was started or charged. Start there. This page covers the most common problems.

## `KILAWATT_API_KEY` is missing

Message: `KILAWATT_API_KEY is not set.`

`deploy_gpu_node`, `get_resume_info` and `resume_job` need an API key. The other tools do not. Add `KILAWATT_API_KEY` to the `env` block of the server entry in your MCP client, then restart the client. A key exported in your shell is not always passed to a server that the client starts.

No request is sent when the key is missing.

## `KILAWATT_API_KEY` is malformed

Message: `KILAWATT_API_KEY does not look like a Kilawatt key (expected it to start with kw_live_).`

Check that:

- the value starts with `kw_live_`
- there are no quotes, spaces or line breaks around it
- it is not a placeholder such as `kw_live_YOUR_KEY_HERE`

No request is sent when the key is malformed. The server never prints the key in its output.

## HTTP 401: unauthorized

The key was sent but the server did not accept it. It may be revoked, or it may be a key from another account. Issue a new key in your Kilawatt account and update `KILAWATT_API_KEY`. Do not keep retrying with the same key: on the job endpoints, repeated failed attempts lead to 429.

## HTTP 404: not found

- **`get_resume_info` or `resume_job` with code `not_found`**: no job with that `job_id` exists for this API key. Check the job ID and check that you are using the key that created the job.
- **`get_capacity`, `get_platform_status` or `get_pricing`**: the endpoint was not found. `KILAWATT_SITE_URL` is probably wrong (see [below](#wrong-kilawatt_site_url-or-kilawatt_base_url)).
- **`deploy_gpu_node`**: the gateway endpoint was not found. `KILAWATT_BASE_URL` is probably wrong.

## HTTP 409: conflict

- **`resume_job` with code `no_checkpoint`**: the job has no checkpoint to resume from. No new run was started.
- **`resume_job` with code `job_still_running`**: the job is still running, so it cannot be resumed yet. No new run was started. Check again later with `get_resume_info`.
- **`x402_run_job` with `payment_already_used`**: the payment was already used for another request. Ask for a new quote.

Call `get_resume_info` before `resume_job`. It reports `can_resume` and the `reason` without starting anything.

## HTTP 429: too many requests

- **`get_resume_info` or `resume_job`**: there have been too many failed authentication attempts. Fix the API key first, then wait before trying again. These tools never retry automatically.
- **`deploy_gpu_node`**: a rate or concurrency limit was hit. The server retries a few times with a delay before reporting the error. Wait before trying again.
- **`x402_run_job`**: a rate limit was hit. Wait before trying again.

## HTTP 503: unavailable

- **`get_capacity` with code `unavailable`**: capacity data is not available right now. Try again later. Nothing was started or charged.
- **Other discovery tools**: the service is not available right now. Try again later.
- **`deploy_gpu_node` or `x402_run_job`**: no matching capacity could be placed. Nothing was charged. Try a different `gpu_type` or a smaller `card_count`, or try again later.

## Tools are not listed in the client

1. Run `npx -y kilawatt-mcp-server` in a terminal. It should print `kilawatt-mcp-server ready on stdio`. If it does not, check your Node.js version (`node --version`, 18 or later) and your network access to the npm registry.
2. Check the client's config file for JSON or YAML errors, such as a missing comma or an extra trailing comma.
3. Check that you used the format your client expects. For example, VS Code uses `servers` instead of `mcpServers`, and Zed uses `context_servers`. See [clients.md](clients.md).
4. Restart or reload the client after changing its config.
5. Check that the server is enabled in the client, and look at the client's MCP logs or server list for a start-up error.
6. In Continue, MCP tools are only available in agent mode.

## Wrong `KILAWATT_SITE_URL` or `KILAWATT_BASE_URL`

The server uses two separate base addresses. Leave both unset unless you were asked to change them.

| Setting | Used by | Default | Must look like |
|---------|---------|---------|----------------|
| `KILAWATT_SITE_URL` | `get_capacity`, `get_platform_status`, `get_pricing`, `get_resume_info`, `resume_job` | `https://www.kilawattcloud.dev` | The site root only. The tools add `/api/...` themselves. |
| `KILAWATT_BASE_URL` | `deploy_gpu_node` | `https://www.kilawattcloud.dev/api/public/v1` | The full gateway path, including `/api/public/v1` |

Common mistakes:

- Setting `KILAWATT_SITE_URL` to a value ending in `/api` or `/api/public/v1`. This produces paths like `/api/api/status` and returns 404.
- Setting `KILAWATT_BASE_URL` to the site root without `/api/public/v1`. `deploy_gpu_node` then returns 404.
- A typo in the host name. The error then says the server could not reach the gateway.

A trailing slash is fine for both settings. Restart the MCP client after changing either one.

## Still stuck

Open an issue in the [GitHub issue tracker](https://github.com/KilaWattCloud/kilawatt-mcp-server/issues). Include the error message, but never include your API key or wallet private key. For a security problem, follow [SECURITY.md](../SECURITY.md).
