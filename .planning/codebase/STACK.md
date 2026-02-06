# Technology Stack

**Analysis Date:** 2026-02-06

## Languages

**Primary:**
- TypeScript 5.9.3 - All source code and build system

**Secondary:**
- Node.js built-in modules (fs, path, crypto) - Utilities and file operations

## Runtime

**Environment:**
- Node.js 18.0.0+ (as per `engines` in package.json)

**Package Manager:**
- npm
- Lockfile: package-lock.json (referenced in .npmignore but not committed)

## Frameworks

**Core:**
- No web framework (library package, not a server application)
- ResearchAgent class is the main orchestrator (`src/ResearchAgent.ts`)
- Pipeline orchestrator for research workflow (`src/orchestrator/Pipeline.ts`)

**Build/Dev:**
- TypeScript - Compilation and type checking
- tsx 4.20.6 - TypeScript execution runner for examples and scripts
- tsc - TypeScript compiler for production builds

## Key Dependencies

**Critical:**
- axios 1.13.2 - HTTP client for API requests (OpenRouter, SearXNG, Jina.ai)
- better-sqlite3 12.4.1 - SQLite database for caching search results, LLM responses, and session state
- dotenv 17.2.3 - Environment variable loading from .env files

**Infrastructure:**
- @types/node 24.10.1 (dev) - Node.js type definitions
- @types/better-sqlite3 7.6.12 (dev) - SQLite library type definitions

## Configuration

**Environment:**
- Loaded from `.env` file via `dotenv` package
- Example provided in `.env.example`

**Build:**
- TypeScript config: `tsconfig.json`
  - Target: ES2022
  - Module: ESNext
  - Module resolution: Bundler
  - Output: `dist/` directory
  - Source: `src/` directory
  - Strict mode enabled, source maps enabled

**NPM Scripts:**
```bash
build           # Compile TypeScript to dist/
dev             # Run basic example with tsx
example:basic   # Run basic usage example
example:advanced # Run advanced features example
example:custom   # Run custom depth example
example:features # Run advanced features demo
clean           # Remove dist/ directory
prepublishOnly  # Clean and build before npm publish
fetch-models    # Fetch available models from OpenRouter
searxng:start   # Start SearXNG Docker container
searxng:stop    # Stop SearXNG container
searxng:logs    # View SearXNG logs
searxng:restart # Restart SearXNG container
```

## Platform Requirements

**Development:**
- Node.js 18.0.0 or higher
- npm for package management
- Docker (optional, for local SearXNG instance)

**Production:**
- Node.js 18.0.0 or higher
- Internet connectivity for API calls
- Storage path for SQLite cache database (if persistence enabled)

## Publishing

**Package Type:**
- ES Module (ESM) - `"type": "module"` in package.json
- Main entry: `dist/index.js`
- Types: `dist/index.d.ts`

**Distribution Files:**
- Only `dist/`, `README.md`, and `LICENSE` shipped to npm (via `files` field)
- Source TypeScript, examples, and scripts excluded from npm package

## Version & Compatibility

**Current Version:** 1.0.0

**ESM Configuration:**
- ts-node ESM enabled: `"ts-node": { "esm": true }`
- All imports use `.js` extension for ES module compatibility

---

*Stack analysis: 2026-02-06*
