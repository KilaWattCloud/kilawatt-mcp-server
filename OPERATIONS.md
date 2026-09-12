# Operations and Ownership

This document defines the operating model for `kilawatt-mcp-server` so configuration, publishing, and ownership decisions are explicit and repeatable.

## 1) Source of Truth for Configuration

Configuration for this server is versioned in this repository:

- Runtime behavior and validation: `/home/runner/work/kilawatt-mcp-server/kilawatt-mcp-server/index.js`
- MCP distribution metadata: `/home/runner/work/kilawatt-mcp-server/kilawatt-mcp-server/server.json`
- Package metadata and scripts: `/home/runner/work/kilawatt-mcp-server/kilawatt-mcp-server/package.json`
- Human-facing setup docs: `/home/runner/work/kilawatt-mcp-server/kilawatt-mcp-server/README.md`

Required and optional runtime environment variables:

- `KILAWATT_API_KEY` (required)
- `KILAWATT_BASE_URL` (optional)

Rule: any config change must update all impacted files above in the same PR.

## 2) Publishing Workflow (Lovable → GitHub → Production)

1. Author or iterate in Lovable/local environment.
2. Sync code into this GitHub repository on a feature branch.
3. Open a pull request to `main` with:
   - passing CI checks
   - changelog updates (if user-visible behavior changed)
   - review approval
4. Merge to `main`.
5. Publish a release by creating/pushing semantic tag `v*.*.*`.
6. GitHub release workflow (`.github/workflows/release.yml`) generates the GitHub Release from the tag.
7. npm publish (if intended for this version) follows the release checklist.

Rule: no direct production publish from Lovable without a corresponding GitHub commit/tag.

## 3) Ownership Model

Repository ownership is enforced through CODEOWNERS and branch protection.

- Product/behavior owner: approves API/tool behavior and breaking changes.
- Release owner: approves versioning, changelog quality, and release/tag operations.
- Operations owner: maintains CI workflows, security tooling, and incident response.

Minimum policy:

- at least one approver on every PR to `main`
- required CI checks must pass before merge
- stale approvals dismissed on new commits

If one person holds multiple roles, those role decisions should still be explicit in PR descriptions.
