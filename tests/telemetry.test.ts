import { describe, expect, it } from 'vitest'

import { configDir, packageVersion, telemetryEnabled } from '../src/utils/telemetry'

describe('telemetryEnabled', () => {
  it('is on by default outside CI and tests', () => {
    expect(telemetryEnabled({})).toBe(true)
  })

  it('honours DO_NOT_TRACK', () => {
    expect(telemetryEnabled({ DO_NOT_TRACK: '1' })).toBe(false)
    expect(telemetryEnabled({ DO_NOT_TRACK: '0' })).toBe(true)
  })

  it('honours CREATE_DEVSTACK_TELEMETRY=0', () => {
    expect(telemetryEnabled({ CREATE_DEVSTACK_TELEMETRY: '0' })).toBe(false)
    expect(telemetryEnabled({ CREATE_DEVSTACK_TELEMETRY: 'false' })).toBe(false)
  })

  it('is off in CI and under tests', () => {
    expect(telemetryEnabled({ CI: 'true' })).toBe(false)
    expect(telemetryEnabled({ VITEST: 'true' })).toBe(false)
  })
})

describe('telemetry helpers', () => {
  it('uses XDG_CONFIG_HOME when set', () => {
    if (process.platform === 'win32') return
    expect(configDir({ XDG_CONFIG_HOME: '/tmp/xdg' })).toBe('/tmp/xdg/create-devstack')
  })

  it('finds the package version', () => {
    expect(packageVersion()).toMatch(/^\d+\.\d+\.\d+/)
  })
})
