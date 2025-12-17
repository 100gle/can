# Contributing to Can

Thank you for your interest in contributing to **Can**! We welcome contributions from the community to help make this project better.

## Prerequisites

Before you start, make sure you have the following installed:

- **Go**: Version 1.21 or higher.
- **Node.js**: Version 18 or higher.
- **pnpm**: Version 8+.
- **Wails**: [Installation Guide](https://wails.io/docs/gettingstarted/installation).

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/can.git
   cd can
   ```
3. **Run the development environment**:
   ```bash
   wails dev
   ```
   This will start the backend and frontend with hot reloading.

## Project Structure

- `frontend/`: React + TypeScript frontend code.
- `internal/`: Go backend logic.
- `main.go`: Application entry point.
- `wails.json`: Wails configuration.

## Coding Guidelines

### Backend (Go)
- Follow standard [Go conventions](https://go.dev/doc/effective_go).
- Run `go fmt` before committing.
- Ensure all tests pass: `go test ./...`

### Frontend (TypeScript/React)
- Follow the existing linting rules.
- Run `pnpm --dir frontend lint` to check for issues.
- Use `pnpm --dir frontend format` to format code.

## Submitting a Pull Request

1. Create a new branch for your feature or fix:
   ```bash
   git checkout -b feature/my-amazing-feature
   ```
2. Commit your changes with clear messages.
3. Push to your fork and submit a Pull Request to the `main` branch.
4. Ensure the CI checks pass.

## License

By contributing, you agree that your contributions will be licensed under the project's [Apache License 2.0](LICENSE).
