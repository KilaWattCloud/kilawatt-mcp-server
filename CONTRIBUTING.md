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

# Build the project
npm run build

# Run type checking
npm run typecheck
```

## Code Style Expectations

- Follow ESLint configuration if present in the repo
- Use 2-space indentation
- Prefer const/let over var
- Write descriptive variable and function names
- Add comments for complex logic
- Keep functions focused and testable
- Write TypeScript with strict mode enabled
- Format code before committing (use Prettier if configured)

## Pull Request Process

1. Ensure your code passes linting and type checking
2. Verify the build succeeds with `npm run build`
3. Update documentation if you've changed functionality
4. Add a clear description of what your PR does
5. Be responsive to review feedback
6. Once approved, a maintainer will merge your PR

## Questions?

Reach out to us at hello@kilawattcloud.dev or open a discussion in the repository.

Thank you for contributing!