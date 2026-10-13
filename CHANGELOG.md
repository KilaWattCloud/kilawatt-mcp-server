# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Goose quickstart and extension configuration example
- Setup documentation and configuration examples for goose, Claude Desktop, and Cursor
- FAQ covering spend caps, wallet safety, dry runs, tool scope, endpoints, and reporting
- Mocked HTTP tests for the gateway endpoint override and x402 confirmation and spend-cap guards
- MCP client discoverability metadata and a Works with section in the README

## [0.1.4] - 2026-10-08

### Fixed
- Restored index.js after an accidental truncation in bccae7b; added startup test and bin entry

## [0.2.0] - 2026-10-10

### Added
- x402 quote, pay-per-job, and job-status MCP tools using Base USDC
- Local payment safeguards, spend caps, and secure storage for the one-time API key

## [0.1.2] - 2026-09-07

### Added
- CI/CD workflow for test on push and PR
- Contributing guidelines
- Code of Conduct
- Syntax validation for plain JavaScript via npm check script

## [0.1.1] - 2026-09-02

### Added
- Initial release of kilawatt-mcp-server
- MCP server for Kilawatt Cloud GPU provisioning
- Integration with Kilawatt public gateway
- GPU deployment tool with retry logic
- MIT License
- Security policy
