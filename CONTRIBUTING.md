# Contributing to kilawatt-mcp-server

Thank you for your interest in contributing to kilawatt-mcp-server! We welcome all contributions, whether they're bug reports, feature requests, documentation improvements, or code changes.

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm 8.x or higher

### Setup

1. Fork the repository and clone it locally
2. Install dependencies:

```bash
cd kilawatt-mcp-server

# Install dependencies
npm install

# Check JavaScript syntax
npm run check

# Start the server (requires KILAWATT_API_KEY)
KILAWATT_API_KEY=kw_live_your_key npm start
```

## Code Style Expectations

This is a plain JavaScript (ES6 modules) project without build, compilation, or type-checking steps. Please:

- Write clear, readable code with meaningful variable names
- Add comments for complex logic
- Follow the existing code style in the repository
- Use const for immutable values and let for reassignment

## Testing Your Changes

Before submitting a pull request, please:

1. Run `npm run check` to validate JavaScript syntax
2. Verify the server starts with `npm start` and a valid `KILAWATT_API_KEY`
3. Test your changes locally with an MCP client if possible

## Pull Request Process

1. Run `npm run check`
2. Verify the server starts with `npm start` and a valid `KILAWATT_API_KEY`
3. Update documentation if you've changed functionality
4. Add a clear description of what your PR does
5. Be responsive to review feedback

## Reporting Issues

If you find a bug or have a feature request, please open an issue with:

- A clear, descriptive title
- A detailed description of the problem or request
- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Your environment (Node.js version, OS, etc.)

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.
