# Contributing to Kilawatt MCP Server

Thank you for your interest in contributing to the Kilawatt MCP Server! We welcome contributions from the community.

## How to Report Bugs

If you discover a bug, please open a GitHub Issue with the following information:

- **Title**: A clear, concise description of the bug
- **Description**: Detailed explanation of the issue
- **Reproduction Steps**: Step-by-step instructions to reproduce the bug
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: OS, Node.js version, package version
- **Screenshots/Logs**: If applicable, include error messages or logs

## How to Submit a Pull Request

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feature/your-feature-name`
3. **Make your changes** and commit with clear, descriptive messages
4. **Follow code style** guidelines (see below)
5. **Push** your branch to your fork
6. **Open a Pull Request** against the `main` branch
   - Link any related issues
   - Describe your changes clearly
   - Include any testing you've done

## Development Setup

```bash
# Clone the repository
git clone https://github.com/KilaWattCloud/kilawatt-mcp-server.git
cd kilawatt-mcp-server

# Install dependencies
npm install

# Run syntax checks
npm run check
```

## Code Style Expectations

- Match existing JavaScript style in the repository
- Use descriptive variable and function names
- Keep functions focused and testable
- Add comments only when they clarify non-obvious behavior

## Pull Request Process

1. Ensure your code passes `npm run check`
2. Confirm CI passes for supported Node.js versions
3. Update documentation if you've changed functionality
4. Add a clear description of what your PR does
5. Be responsive to review feedback
6. Once approved, a maintainer will merge your PR

## Branch Protection and Reviews

- Pull requests to `main` should include at least one review.
- CI checks from `.github/workflows/test.yml` must pass before merge.
- Maintainers should keep `main` protected with required status checks and review enforcement.

## Questions?

Reach out to us at hello@kilawattcloud.dev or open a discussion in the repository.

Thank you for contributing!