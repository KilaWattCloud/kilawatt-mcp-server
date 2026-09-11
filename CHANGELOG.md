# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-11

### Added
- Initial release of kilawatt-mcp-server
- MCP server integration with Kilawatt Cloud GPU provisioning API
- `deploy_gpu_node` tool for provisioning GPU compute nodes
- Real-time API calls to Kilawatt gateway (no mock responses)
- Comprehensive error handling with retry logic
- Support for dry-run mode for cost estimation
- Smart routing policies (lowest_cost, lowest_latency, zero_quota)