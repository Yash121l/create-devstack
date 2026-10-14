# create-devstack

`create-devstack` is a production-grade, modular TypeScript CLI for scaffolding backend projects.

## Features

- Guided wizard flow: language -> framework -> database -> architecture -> tooling -> optional features.
- Quality tooling selection includes ESLint, Prettier, and Husky/commit hooks.
- Express security/middleware selection includes CORS, origin checks, Helmet, rate limiting, logging, and compression.
- NestJS projects can also opt into the same middleware/security modules.
- Preset mode for fast project generation.
- Advanced mode for module-by-module composition.
- Module metadata with dependency/requirement/conflict handling.
- Safe file merge flow with overwrite confirmation.
- Automatic package manager detection (`npm`, `pnpm`, `yarn`, `bun`).
- Git + Husky + lint-staged + commitlint bootstrap.
- Contributor-ready structure with tests and CI.

## Installation

### Run directly

```bash
npx create-devstack my-app
```

### Local development

```bash
pnpm install
pnpm build
pnpm link
create-devstack my-app
```

## Usage

```bash
create-devstack my-app
create-devstack . --in-place
create-devstack my-app --preset backend
create-devstack my-app --advanced
create-devstack my-app --yes
```

## Telemetry

Each run sends one anonymous `cli_command_run` event so the maintainer can see which modules people pick and how often runs fail. It contains the create-devstack version, OS, CPU architecture, Node version, duration, exit code, which flags were passed (booleans only), the selected module ids, and the detected package manager. It is keyed by a random id stored in `~/.config/create-devstack/telemetry.json`. Project names, paths, file contents and option values are never sent. The first run prints a notice.

The event is sent to PostHog from a detached background process, so it never slows down or blocks the CLI. Telemetry is off in CI (`CI` set). To turn it off:

```bash
export CREATE_DEVSTACK_TELEMETRY=0
# or
export DO_NOT_TRACK=1
```

## Architecture

The CLI uses a composition engine in `src/core`:

- `module-loader.ts`: discovers and validates module definitions.
- `composer.ts`: resolves required modules and merges package metadata/dependencies.
- `validator.ts`: enforces module requirements and conflict rules.
- `file-merger.ts`: merges template files safely.
- `installer.ts`: installs dependencies, initializes git, and sets up Husky hooks.

Each module lives under `src/modules/<module-name>` and exports `DevstackModule` metadata.

```ts
export interface DevstackModule {
  name: string
  description: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  requires?: string[]
  conflictsWith?: string[]
  filesPath?: string
  packageJson?: PackageJsonFragment
  postInstall?: (context: GeneratorContext) => Promise<void>
}
```

## Included MVP Modules

- `language-node`
- `framework-express`
- `framework-nest`
- `middleware-cors`
- `security-origin-checks`
- `security-helmet`
- `middleware-morgan`
- `middleware-compression`
- `orm-prisma`
- `linter-eslint`
- `formatter-prettier`
- `quality-husky`
- `rate-limit`
- `docker-basic`
- `folder-mvc`
- `folder-clean`

## Create a New Module

1. Create `src/modules/<module-name>/index.ts`.
2. Export a typed `DevstackModule` object.
3. Add template files to `src/modules/<module-name>/files`.
4. Declare `requires` and `conflictsWith` when relevant.
5. Add tests for behavior in `tests/`.

Example:

```ts
import path from 'node:path'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'my-module',
  description: 'My custom module',
  filesPath: path.join(__dirname, 'files')
}

export default moduleDefinition
```

## Contribution Guide

1. Create a branch (`codex/<feature-name>`).
2. Keep modules small and single-purpose.
3. Run checks before opening a PR:

```bash
pnpm lint
pnpm test
pnpm build
```

4. Use conventional commits (`feat:`, `fix:`, `chore:`, etc.).
5. Update docs/tests for behavior changes.

Project governance files for open source collaboration:

- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github/pull_request_template.md`
