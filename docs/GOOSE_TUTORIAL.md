# Tutorial: rent GPUs from your goose agent with Kilawatt Cloud

This walkthrough takes you from nothing to a priced GPU request inside goose, then to a real one. Start with a dry run. It costs nothing.

Kilawatt Cloud adds one tool to goose, `deploy_gpu_node`. It prices, routes and provisions real GPU capacity. Each call is a real request to the Kilawatt gateway, with no mock responses.

Status note: the Kilawatt team has tested this end to end in goose: a dry run, then 15 paid x402 jobs on Base, with each payment cross-checked against Basescan transaction records. This was internal testing. If anything differs on your goose version, please open an issue on this repo.
## What you need

1. goose installed (Desktop app or CLI).
2. Node.js 18 or newer, so `npx` works.
3. A Kilawatt API key (it starts with `kw_live_`). Email hello@kilawattcloud.dev to get one.
4. Optional, for pay-per-job without an account balance: a small x402 wallet (see "Pay with x402").

## Step 1: Add the extension

Pick one path.

**goose Desktop**

1. Open Extensions, then Add custom extension.
2. Type: Standard IO.
3. Command: `npx -y kilawatt-mcp-server`
4. Environment variable: `KILAWATT_API_KEY` set to your key.
5. Save and switch the extension on.

**goose config file** (`~/.config/goose/config.yaml`)

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

**One-off CLI session**

```bash
export KILAWATT_API_KEY=kw_live_YOUR_KEY_HERE
goose session --with-extension "npx -y kilawatt-mcp-server"
```

Use version 0.2.1 or newer. Version 0.2.0 had a packaging bug and will not start.

## Step 2: Do a dry run

Ask goose:

> Use Kilawatt to do a dry run for 1 nvidia-h100 GPU for 600 seconds and tell me the price and routing.

goose calls `deploy_gpu_node` with `dry_run: true`. You get the price and the routing decision back. Nothing is provisioned and nothing is charged.

## Step 3: Provision for real

When the dry run looks right, ask again without the dry run:

> Now provision that GPU.

This starts a real machine and charges the account tied to your key right away. Keep goose in an approval mode that asks before running tools, so you confirm each real request.

## Pay with x402 (optional)

Instead of an account balance, the server can pay per job with x402 from a spend-capped wallet. Set these environment variables on the extension:

1. `KILAWATT_X402_PRIVATE_KEY` (secret): the wallet key. Use a wallet holding only a small amount.

2. `KILAWATT_X402_MAX_USD_PER_JOB`: per-job cap. Default 0.25.

3. `KILAWATT_X402_MAX_USD_PER_SESSION`: per-session cap. Default 1.00.

The caps are your safety net. Keep them low while testing.

## Safety checklist

1. Start every new task with a dry run.

2. Use a key with a small spend cap while testing.

3. Keep goose asking for approval before it runs tools.

4. Never paste your API key or wallet key into chat or into a shared config file.

5. Check that your machine gets released when the job is done.

## Troubleshooting

1. **Extension fails to start with ERR_MODULE_NOT_FOUND:** you are on 0.2.0. Run with `npx -y kilawatt-mcp-server@latest`.

2. **Tool does not appear:** confirm the extension is enabled and that `npx` works in a normal terminal.

3. **Authentication error:** check that `KILAWATT_API_KEY` is set on the extension, starts with `kw_live_`, and has no extra spaces.

4. **No capacity for a GPU type:** try another type or a shorter duration. Dry runs show routing before you commit.

## Links

1. Server and source: https://github.com/KilaWattCloud/kilawatt-mcp-server

2. Kilawatt Cloud: https://kilawattcloud.dev

3. goose: https://block.github.io/goose
