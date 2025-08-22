# Contributing to twitter-mcp-server

Thank you for your interest in contributing to twitter-mcp-server! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue on GitHub with the following information:

1. A clear, descriptive title
2. A detailed description of the issue
3. Steps to reproduce the bug
4. Expected behavior
5. Actual behavior
6. Screenshots (if applicable)
7. Environment information (OS, Node.js version, etc.)

### Suggesting Enhancements

If you have an idea for an enhancement, please create an issue on GitHub with the following information:

1. A clear, descriptive title
2. A detailed description of the enhancement
3. The motivation behind the enhancement
4. Any potential implementation details

### Pull Requests

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature-name`)
3. Make your changes
4. Run tests (`npm test`)
5. Run linting (`npm run lint`)
6. Commit your changes (`git commit -am 'Add some feature'`)
7. Push to the branch (`git push origin feature/your-feature-name`)
8. Create a new Pull Request

## Development Setup

1. Clone the repository
```bash
git clone https://github.com/ryanmac/twitter-mcp-server.git
cd twitter-mcp-server
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file with your Twitter credentials (see README.md for details)

4. Build the project
```bash
npm run build
```

5. Run tests
```bash
npm test
```

## Project Structure

```
twitter-mcp-server/
├── src/                      # Source code
│   ├── index.ts              # Main entry point
│   ├── types.ts              # Type definitions
│   ├── authentication.ts     # Authentication manager
│   ├── twitter-client.ts     # Twitter client wrapper
│   ├── health.ts             # Health check functionality
│   ├── test-interface.ts     # Interactive testing interface
│   ├── tools/                # MCP tool implementations
│   └── utils/                # Utility functions
├── docs/                     # Documentation
├── tests/                    # Tests
└── build/                    # Compiled output (generated)
```

## Coding Standards

- Use TypeScript for all code
- Follow the existing code style
- Write tests for new features
- Document new features in the appropriate documentation files
- Use meaningful commit messages

## Testing

- Run `npm test` to run all tests
- Run `npm run lint` to check for linting issues
- Run `npm run test:interface` to test the interactive interface

## Documentation

- Update documentation when adding or changing features
- Follow the existing documentation style
- Keep documentation clear and concise

## Release Process

1. Update the version in package.json
2. Update the CHANGELOG.md file
3. Commit the changes
4. Create a new tag (`git tag v1.0.0`)
5. Push the changes and tags (`git push && git push --tags`)
6. Create a new release on GitHub
7. Publish to npm (`npm publish`)

## Questions?

If you have any questions, please create an issue on GitHub or reach out to the maintainers directly.

Thank you for contributing to twitter-mcp-server!
