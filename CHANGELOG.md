# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Repository governance and automation files:
  - `.github/dependabot.yml`
  - `.github/CODEOWNERS`
  - Issue templates and pull request template
  - Release workflow for semantic version tags
  - `.github/FUNDING.yml`

### Changed
- README now includes build, release, and license badges.
- CONTRIBUTING now aligns contributor guidance with actual project scripts and CI.

## [0.1.2] - 2026-09-11

### Added
- CI/CD workflow for test on push and PR
- Contributing guidelines
- Code of Conduct
- Syntax validation for plain JavaScript via npm check script
- Initial changelog scaffolding and semantic version release notes format

## [0.1.1] - 2026-09-11

### Added
- Initial release of kilawatt-mcp-server
- MCP server for Kilawatt Cloud GPU provisioning
- Integration with Kilawatt public gateway
- GPU deployment tool with retry logic
- MIT License
- Security policy

### Notes
- This release established the initial API surface and project governance baseline.

[Unreleased]: https://github.com/KilaWattCloud/kilawatt-mcp-server/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/KilaWattCloud/kilawatt-mcp-server/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/KilaWattCloud/kilawatt-mcp-server/releases/tag/v0.1.1
