# Use Kilawatt Cloud with goose

Kilawatt's MCP server works as a goose extension. goose runs it as a local stdio extension, so no code changes are needed.

Status: configuration below is based on goose's documented extension format. Not yet run end to end inside goose by the Kilawatt team. If anything differs on your goose version, please open an issue.

## What the extension does

It adds one tool to your goose agent:

- `deploy_gpu_node`: price, route and provision real GPU capacity on Kilawatt Cloud. Set `dry_run: true` to see the price and routing without provisioning or charging.

Each call is a real HTTP request to the Kilawatt gateway. There are no mock responses.

## Setup

1. Get a Kilawatt API key (it starts with `kw_live_`). Email hello@kilawattcloud.dev if you need one.

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

You can also add it from the goose Desktop app under Extensions, Add custom extension, with command `npx -y kilawatt-mcp-server` and the environment variable `KILAWATT_API_KEY`.

3. For a one-off session in the CLI, export the key first:

```bash
export KILAWATT_API_KEY=kw_live_YOUR_KEY_HERE
goose session --with-extension "npx -y kilawatt-mcp-server"
```

## Try it safely

Ask goose:

&gt; Use Kilawatt to do a dry run for 1 nvidia-h100 GPU for 600 seconds and tell me the price and routing.

A dry run does not provision or charge anything. When you are ready to provision, ask again without the dry run.

## Safety notes

- `deploy_gpu_node` without `dry_run` charges the account tied to the key right away and starts a real machine.
- Use a key with a small spend cap while testing, and keep goose in an approval mode that asks before running tools.
- Keep the key out of chat messages and shared configs.

## Links

- Server: https://github.com/KilaWattCloud/kilawatt-mcp-server
- Kilawatt Cloud: https://kilawattcloud.dev
- goose: https://block.github.io/goose
