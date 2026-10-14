# Use Kilawatt Cloud with goose

Step-by-step walkthrough: [docs/GOOSE_TUTORIAL.md](docs/GOOSE_TUTORIAL.md)
Kilawatt's MCP server works as a goose extension. goose runs it as a local stdio extension, so no code changes are needed.

Tested end to end in goose by the Kilawatt team: a dry run, then 15 paid x402 jobs on Base. Each payment was cross-checked against Basescan transaction records. Those runs were done by the Kilawatt team, so treat them as internal testing. If anything differs on your goose version, please open an issue.

## Endpoint

The default endpoint is Kilawatt Cloud's gateway: `https://www.kilawattcloud.dev/api/public/v1`. Change it with the `KILAWATT_BASE_URL` environment variable.

## What the extension does

It adds four tools to your goose agent:

- `deploy_gpu_node`: price, route and provision real GPU capacity on Kilawatt Cloud. Set `dry_run: true` to see the price and routing without provisioning or charging.
- `x402_quote`: view a Base USDC price and payment details without paying.
- `x402_run_job`: pay for a single job after explicit confirmation and spend-cap checks.
- `x402_job_status`: check the status of an x402 job using its locally saved API key.

Each call is a real HTTP request to the Kilawatt gateway. There are no mock responses.

## x402 tools

The x402 tools provision capacity only; they do not accept or execute code or commands. They work without a Kilawatt account or API key:

- `x402_quote` returns the current price, Base network, pay-to address, and payment expiry without paying.
- `x402_run_job` pays for one job only after `confirm: true`, a positive `max_usd`, and all spend limits pass.
- `x402_job_status` returns the status and timing details using the API key saved after the first paid job.

| Environment variable | Default | Purpose |
|----------------------|---------|---------|
| `KILAWATT_X402_PRIVATE_KEY` | Unset | Required only when paying with `x402_run_job` |
| `KILAWATT_X402_MAX_USD_PER_JOB` | `0.25` | Maximum spend for one job |
| `KILAWATT_X402_MAX_USD_PER_SESSION` | `1.00` | Maximum spend during this server process |
| `KILAWATT_X402_URL` | Kilawatt x402 endpoint | Optional endpoint override |

The API key is saved at `~/.config/kilawatt/x402-api-key`; it is not printed or returned. The existing `deploy_gpu_node` tool still needs `KILAWATT_API_KEY`.

## Setup

1. Get a Kilawatt API key (it starts with `kw_live_`) if you plan to use `deploy_gpu_node`. x402 tools do not require one.

2. Add the extension to your goose config (`~/.config/goose/config.yaml`):

```yaml
extensions:
  kilawatt:
    name: Kilawatt Cloud
    type: stdio
    cmd: npx
    args:
      - -y
      - kilawatt-mcp-server
    envs:
      KILAWATT_API_KEY: kw_live_YOUR_KEY_HERE
    enabled: true
    timeout: 300
```

You can also add it from the goose Desktop app under Extensions, Add custom extension, with command `npx -y kilawatt-mcp-server`. Set `KILAWATT_API_KEY` only if you plan to use `deploy_gpu_node`.

3. For a one-off session in the CLI, export the key first:

```bash
export KILAWATT_API_KEY=kw_live_YOUR_KEY_HERE
goose session --with-extension "npx -y kilawatt-mcp-server"
```

## Try it safely

Ask goose:

> Use Kilawatt to do a dry run for 1 GPU for 600 seconds and tell me the price and routing.

A dry run does not provision or charge anything. When you are ready to provision, ask again without the dry run.

## Safety notes

- `deploy_gpu_node` without `dry_run` charges the account tied to the key right away and starts a real machine.
- Use a separate small wallet for x402 payments. The payer needs USDC on Base but does not need ETH; the facilitator submits the transaction.
- For x402 users: Check that your Base wallet has enough USDC and that your spend caps allow the amount.
- Set `KILAWATT_X402_PRIVATE_KEY` only when paying. Keep it out of prompts and shared configs.
- Use a key with a small spend cap while testing, and keep goose in an approval mode that asks before running tools.
- Keep the key out of chat messages and shared configs.

## Links

- Server: https://github.com/KilaWattCloud/kilawatt-mcp-server
- Kilawatt Cloud: https://kilawattcloud.dev
- goose: https://goose-docs.ai

## Learn more

- Kilawatt Cloud: https://www.kilawattcloud.dev/super-intelligence
- x402 compute profile specification repository: https://github.com/KilaWattCloud/x402-compute-profile
