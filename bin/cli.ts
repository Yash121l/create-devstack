#!/usr/bin/env node
import { Command } from 'commander'

import { runCreateDevstack, type CreateDevstackResult } from '../src'
import { recordRun } from '../src/utils/telemetry'

const program = new Command()
const startedAt = Date.now()
let flags: Record<string, boolean> = {}
let result: CreateDevstackResult | undefined

program
  .name('create-devstack')
  .description('Modular backend project scaffolding CLI')
  .argument('[project-name]', 'Name of the project to create')
  .option('--preset <name>', 'Use a predefined preset (example: backend)')
  .option('--yes', 'Skip interactive prompts and use defaults', false)
  .option('--advanced', 'Enable advanced module selection mode', false)
  .option('--in-place', 'Generate in current directory instead of creating a new folder', false)
  .option('--skip-install', 'Skip dependency installation', false)
  .option('--skip-git', 'Skip git initialization', false)
  .action(async (projectName: string | undefined, options: Record<string, unknown>) => {
    // Telemetry gets which flags were used, never their values.
    flags = {
      preset: typeof options.preset === 'string',
      yes: options.yes === true,
      advanced: options.advanced === true,
      in_place: options.inPlace === true,
      skip_install: options.skipInstall === true,
      skip_git: options.skipGit === true
    }
    result = await runCreateDevstack({
      projectName,
      options: {
        preset: typeof options.preset === 'string' ? options.preset : undefined,
        yes: options.yes === true,
        advanced: options.advanced === true,
        inPlace: options.inPlace === true,
        skipInstall: options.skipInstall === true,
        skipGit: options.skipGit === true
      }
    })
  })

function report(exitCode: number): void {
  recordRun({
    command: 'create',
    duration_ms: Date.now() - startedAt,
    exit_code: exitCode,
    ...flags,
    modules: result ? [...result.selectedModules].sort() : [],
    module_count: result ? result.selectedModules.length : 0,
    package_manager: result ? result.packageManager : null
  })
}

program
  .parseAsync(process.argv)
  .then(() => report(0))
  .catch((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`create-devstack failed: ${errorMessage}`)
    process.exitCode = 1
    report(1)
  })
