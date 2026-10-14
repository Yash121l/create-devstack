import path from 'node:path'

import inquirer from 'inquirer'

import { generateProject } from './core/generator'
import { loadModules } from './core/module-loader'
import { getPreset } from './core/presets'
import { runAdvancedPrompt } from './prompts/advanced'
import { runBasicPrompt } from './prompts/basic'
import { cliOptionSchema, type CliOptions } from './types/cli'
import { ConsoleLogger } from './utils/logger'
import { detectPackageManager } from './utils/package-manager'

export interface CreateDevstackInput {
  projectName?: string
  options: CliOptions
}

export interface CreateDevstackResult {
  selectedModules: string[]
  packageManager: string
}

interface ProjectTarget {
  projectName: string
  projectDir: string
}

function validateProjectName(projectName: string): string {
  const validName = /^(?:@[a-zA-Z0-9._-]+\/)?[a-zA-Z0-9._-]+$/.test(projectName)
  if (!validName) {
    throw new Error(
      'Invalid project name. Use letters, numbers, dots, underscores, dashes, and optional @ scope only.'
    )
  }

  return projectName
}

async function resolveProjectName(projectName: string | undefined, yes: boolean): Promise<string> {
  if (projectName) {
    return validateProjectName(projectName)
  }

  if (yes) {
    return 'devstack-app'
  }

  const answer = await inquirer.prompt<{ projectName: string }>([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name',
      default: 'devstack-app',
      validate: (input: unknown) => {
        try {
          if (typeof input !== 'string') {
            return 'Project name must be a string'
          }

          validateProjectName(input)
          return true
        } catch (error) {
          if (error instanceof Error) {
            return error.message
          }

          return 'Invalid project name'
        }
      }
    }
  ])

  return validateProjectName(answer.projectName)
}

async function resolveInPlaceProjectName(
  projectName: string | undefined,
  yes: boolean
): Promise<string> {
  if (projectName && projectName !== '.') {
    return validateProjectName(projectName)
  }

  const directoryName = path.basename(process.cwd())
  const defaultName = /^(?:@[a-zA-Z0-9._-]+\/)?[a-zA-Z0-9._-]+$/.test(directoryName)
    ? directoryName
    : 'devstack-app'

  if (yes) {
    return validateProjectName(defaultName)
  }

  const answer = await inquirer.prompt<{ projectName: string }>([
    {
      type: 'input',
      name: 'projectName',
      message: 'Package name for current directory',
      default: defaultName,
      validate: (input: unknown) => {
        try {
          if (typeof input !== 'string') {
            return 'Project name must be a string'
          }

          validateProjectName(input)
          return true
        } catch (error) {
          if (error instanceof Error) {
            return error.message
          }

          return 'Invalid project name'
        }
      }
    }
  ])

  return validateProjectName(answer.projectName)
}

async function resolveProjectTarget(
  projectName: string | undefined,
  options: CliOptions
): Promise<ProjectTarget> {
  if (options.inPlace || projectName === '.') {
    return {
      projectName: await resolveInPlaceProjectName(projectName, options.yes),
      projectDir: process.cwd()
    }
  }

  const resolvedProjectName = await resolveProjectName(projectName, options.yes)
  return {
    projectName: resolvedProjectName,
    projectDir: path.resolve(process.cwd(), resolvedProjectName)
  }
}

export async function runCreateDevstack(input: CreateDevstackInput): Promise<CreateDevstackResult> {
  const options = cliOptionSchema.parse(input.options)
  const logger = new ConsoleLogger(false)

  const target = await resolveProjectTarget(input.projectName, options)

  logger.info('Loading modules...')
  const registry = await loadModules()

  let selectedModules: string[] = []

  if (options.advanced) {
    const presetModules = options.preset ? (getPreset(options.preset)?.modules ?? []) : []
    selectedModules = await runAdvancedPrompt(registry, presetModules)
  } else if (options.preset) {
    const preset = getPreset(options.preset)
    if (!preset) {
      throw new Error(`Unknown preset: ${options.preset}`)
    }

    selectedModules = [...preset.modules]
  } else if (options.yes) {
    selectedModules = [...(getPreset('backend')?.modules ?? [])]
  } else {
    const basicPrompt = await runBasicPrompt(registry)
    selectedModules = basicPrompt.selectedModules
  }

  if (selectedModules.length === 0) {
    throw new Error('No modules selected. Aborting.')
  }

  const packageManager = await detectPackageManager(process.cwd())
  logger.info(`Detected package manager: ${packageManager}`)

  await generateProject({
    projectName: target.projectName,
    projectDir: target.projectDir,
    selectedModuleNames: selectedModules,
    registry,
    packageManager,
    options,
    logger
  })

  return { selectedModules, packageManager }
}
