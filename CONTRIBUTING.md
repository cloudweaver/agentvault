# Contributing to AgentVault

Thank you for your interest in contributing to AgentVault! This document provides guidelines and information for contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/agentvault.git`
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development Setup

### Prerequisites

- Rust 1.75+
- Solana CLI 1.18+
- Anchor 0.32+
- Node.js 20+
- pnpm 9+

### Local Development

```bash
# Start local Solana validator
solana-test-validator

# Deploy program locally
anchor deploy --provider.cluster localnet

# Run runtime in dev mode
pnpm --filter runtime dev

# Run frontend
pnpm --filter app dev
```

## Code Style

### Rust (Solana Program)

- Follow Rust standard formatting (`cargo fmt`)
- Use `cargo clippy` for linting
- Document public functions with `///` comments

### TypeScript (Runtime & Frontend)

- Use ESLint and Prettier
- Follow existing code patterns
- Add JSDoc comments for public APIs

## Testing

```bash
# Run all tests
pnpm test

# Run Solana program tests
anchor test

# Run runtime tests
pnpm --filter runtime test
```

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add a clear description of changes
4. Reference any related issues

## Commit Messages

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test changes
- `refactor:` Code refactoring
- `chore:` Build/tooling changes

Example: `feat: add Jupiter swap adapter`

## Security

If you discover a security vulnerability, please email security@agentvault.io instead of opening a public issue.

## Questions?

Join our [Discord](https://discord.gg/agentvault) for discussions and support.
