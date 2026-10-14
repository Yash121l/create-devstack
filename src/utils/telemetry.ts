import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

// Anonymous usage telemetry. One event per run: which modules were picked, how long it took
// and how it exited. Never project names, paths, file contents or option values.
// Opt out with DO_NOT_TRACK=1 or CREATE_DEVSTACK_TELEMETRY=0. Off in CI and under tests.

// Public client key for the maintainer's PostHog project. It can only write events.
const POSTHOG_KEY = 'phc_oLm8fb7L4CXDqGdJcc7a6boCtR8rVjf6dNx7G995eGdy'
const ENDPOINT = 'https://us.i.posthog.com/i/v0/e/'
const TIMEOUT_MS = 8000

// Runs in a detached child process so the CLI exits without waiting on the network.
const SENDER = `fetch(${JSON.stringify(ENDPOINT)}, { method: 'POST', headers: { 'content-type': 'application/json' }, body: process.env.CREATE_DEVSTACK_TELEMETRY_PAYLOAD, signal: AbortSignal.timeout(${TIMEOUT_MS}) }).catch(() => {})`

const NOTICE = `create-devstack collects anonymous usage data (modules picked, version, OS, duration,
exit code) to see how it is used. It never sends project names, paths or file contents.
Turn it off with CREATE_DEVSTACK_TELEMETRY=0 or DO_NOT_TRACK=1. This notice is shown once.
`

interface State {
  installId: string
  noticeShown: boolean
}

export type TelemetryValue = string | number | boolean | null | string[]

export interface RunEvent {
  command: string
  duration_ms: number
  exit_code: number
  [extra: string]: TelemetryValue
}

const isOff = (value: string | undefined): boolean =>
  value !== undefined && ['0', 'false', 'off', 'no'].includes(value.trim().toLowerCase())
const isOn = (value: string | undefined): boolean =>
  value !== undefined && value !== '' && !isOff(value)

export function telemetryEnabled(env: NodeJS.ProcessEnv): boolean {
  if (isOn(env.DO_NOT_TRACK)) return false
  if (isOff(env.CREATE_DEVSTACK_TELEMETRY)) return false
  if (isOn(env.CI) || env.VITEST !== undefined || env.NODE_ENV === 'test') return false
  return true
}

export function configDir(env: NodeJS.ProcessEnv): string {
  if (process.platform === 'win32' && env.APPDATA) return path.join(env.APPDATA, 'create-devstack')
  return path.join(env.XDG_CONFIG_HOME || path.join(homedir(), '.config'), 'create-devstack')
}

/** The package version, found by walking up from this file (works from src and dist). */
export function packageVersion(): string {
  let dir = __dirname
  for (let i = 0; i < 4; i += 1) {
    const file = path.join(dir, 'package.json')
    if (existsSync(file)) {
      try {
        const pkg = JSON.parse(readFileSync(file, 'utf8')) as { name?: string; version?: string }
        if (pkg.name === 'create-devstack' && pkg.version) return pkg.version
      } catch {
        // keep looking
      }
    }
    dir = path.dirname(dir)
  }
  return 'unknown'
}

function writeState(dir: string, state: State): boolean {
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'telemetry.json'), `${JSON.stringify(state, null, 2)}\n`)
    return true
  } catch {
    return false
  }
}

function loadState(dir: string): State | null {
  try {
    const parsed = JSON.parse(
      readFileSync(path.join(dir, 'telemetry.json'), 'utf8')
    ) as Partial<State>
    if (typeof parsed.installId === 'string' && parsed.installId) {
      return { installId: parsed.installId, noticeShown: parsed.noticeShown === true }
    }
  } catch {
    // first run, or unreadable: start fresh below
  }
  const state: State = { installId: randomUUID(), noticeShown: false }
  return writeState(dir, state) ? state : null
}

/** Sends one cli_command_run event from a detached process. Never throws and never blocks exit. */
export function recordRun(event: RunEvent, env: NodeJS.ProcessEnv = process.env): void {
  try {
    if (!telemetryEnabled(env)) return
    const dir = configDir(env)
    const state = loadState(dir)
    if (state === null) return
    if (!state.noticeShown) {
      process.stderr.write(`\n${NOTICE}`)
      writeState(dir, { ...state, noticeShown: true })
    }
    const payload = JSON.stringify({
      api_key: POSTHOG_KEY,
      event: 'cli_command_run',
      distinct_id: state.installId,
      properties: {
        app: 'create-devstack',
        version: packageVersion(),
        ...event,
        os: process.platform,
        arch: process.arch,
        node_version: process.versions.node,
        $process_person_profile: false
      }
    })
    const child = spawn(process.execPath, ['-e', SENDER], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: { PATH: env.PATH ?? '', CREATE_DEVSTACK_TELEMETRY_PAYLOAD: payload }
    })
    child.on('error', () => {})
    child.unref()
  } catch {
    // telemetry must never affect the CLI
  }
}
