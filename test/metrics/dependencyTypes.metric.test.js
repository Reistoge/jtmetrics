import path from 'path'
import { calculateMetrics } from '../../src/index.js'
import { fileURLToPath } from 'url'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Dependency Types Metric', function () {
  beforeEach(() => {
    jest.resetModules()
  })

  it('metricsResults is defined', async () => {
    const codePath = path.resolve(__dirname, '../test-src/dependency-types/example-1/')
    const metricsResults = await calculateMetrics({ codePath })
    expect(metricsResults).toBeDefined()
  })

  it('Dependency Types metric is defined, has correct name, description and status', async () => {
    const codePath = path.resolve(__dirname, '../test-src/dependency-types/example-1/')
    const metricsResults = await calculateMetrics({ codePath })
    expect(metricsResults).toHaveProperty('dependency-types')
    expect(metricsResults['dependency-types']).toHaveProperty('name', 'File Dependency Types')
    expect(metricsResults['dependency-types'].description).toBeDefined()
    expect(metricsResults['dependency-types'].description).toContain('Aggregates file-to-file dependency counts broken down by type')
    expect(metricsResults['dependency-types'].result).toBeDefined()
    expect(metricsResults['dependency-types'].status).toBeTruthy()
  })

  it('Dependency Types metric returns correct result for JS files', async () => {
    const codePath = path.resolve(__dirname, '../test-src/dependency-types/example-1/JS')
    const metricsResults = await calculateMetrics({ codePath })
    expect(metricsResults).toHaveProperty('dependency-types')
    expect(metricsResults['dependency-types'].status).toBeTruthy()

    const result = metricsResults['dependency-types'].result

    const mainFile = `${codePath}/main.js`
    const helperFile = `${codePath}/helper.js`
    const baseFile = `${codePath}/base.js`

    expect(mainFile in result).toBe(true)

    expect(helperFile in result[mainFile]).toBe(true)
    expect(result[mainFile][helperFile]).toStrictEqual({
      import: 1,
      require: 1,
      'ts-import-equals': 0,
      call: 2,
      instantiate: 0,
      inherit: 0,
      implement: 0
    })

    expect(baseFile in result[mainFile]).toBe(true)
    expect(result[mainFile][baseFile]).toStrictEqual({
      import: 1,
      require: 0,
      'ts-import-equals': 0,
      call: 0,
      instantiate: 1,
      inherit: 1,
      implement: 0
    })
  })

  it('Dependency Types metric returns correct result for TS files with ts-import-equals', async () => {
    const codePath = path.resolve(__dirname, '../test-src/dependency-types/example-1/TS')
    const metricsResults = await calculateMetrics({ codePath })
    expect(metricsResults).toHaveProperty('dependency-types')
    expect(metricsResults['dependency-types'].status).toBeTruthy()

    const result = metricsResults['dependency-types'].result

    const mainFile = `${codePath}/main.ts`
    const helperFile = `${codePath}/helper.ts`
    const baseFile = `${codePath}/base.ts`

    expect(mainFile in result).toBe(true)

    expect(helperFile in result[mainFile]).toBe(true)
    expect(result[mainFile][helperFile]).toStrictEqual({
      import: 1,
      require: 0,
      'ts-import-equals': 1,
      call: 2,
      instantiate: 0,
      inherit: 0,
      implement: 0
    })

    expect(baseFile in result[mainFile]).toBe(true)
    expect(result[mainFile][baseFile]).toStrictEqual({
      import: 1,
      require: 0,
      'ts-import-equals': 0,
      call: 0,
      instantiate: 1,
      inherit: 1,
      implement: 1
    })
  })

  it('returns empty result when no dependencies exist', async () => {
    const codePath = path.resolve(__dirname, '../test-src/file-coupling/example-3/')
    const metricsResults = await calculateMetrics({ codePath })
    const result = metricsResults['dependency-types'].result

    for (const entry of Object.values(result)) {
      expect(Object.keys(entry).length).toBe(0)
    }
  })
})
