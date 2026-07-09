import path from 'path'
import fs from 'fs'

const INITIAL_TYPES = {
  import: 0,
  require: 0,
  'ts-import-equals': 0,
  call: 0,
  instantiate: 0,
  inherit: 0,
  implement: 0
}

const state = {
  name: 'File Dependency Types',
  description: 'Aggregates file-to-file dependency counts broken down by type (import, require, call, instantiate, inherit, implement)',
  result: {},
  id: 'dependency-types',
  dependencies: ['file-coupling', 'function-coupling', 'class-coupling', 'functions-per-file', 'classes-per-file'],
  status: false
}

function initFile (result, filePath) {
  if (!result[filePath]) {
    result[filePath] = {}
  }
}

function incType (result, sourceFile, targetFile, type, count = 1) {
  if (!result[sourceFile][targetFile]) {
    result[sourceFile][targetFile] = { ...INITIAL_TYPES }
  }
  result[sourceFile][targetFile][type] += count
}

function findClassFile (className, classesPerFile) {
  for (const [filePath, classes] of Object.entries(classesPerFile || {})) {
    if (classes[className]) return filePath
  }
  return null
}

function findFunctionFile (functionName, functionsPerFile) {
  for (const [filePath, functions] of Object.entries(functionsPerFile || {})) {
    if (functions[functionName]) return filePath
  }
  return null
}

function resolveImportPath (importingFile, importSource) {
  if (!importSource.startsWith('.') && !path.isAbsolute(importSource)) return null

  const EXTENSIONS = ['.js', '.cjs', '.ts', '.jsx', '.tsx', '.json']
  const basePath = path.resolve(path.dirname(importingFile), importSource)

  if (fs.existsSync(basePath) && fs.lstatSync(basePath).isFile()) return basePath

  for (const ext of EXTENSIONS) {
    const fullPath = basePath + ext
    if (fs.existsSync(fullPath)) return fullPath
  }

  for (const ext of EXTENSIONS) {
    const indexPath = path.join(basePath, 'index' + ext)
    if (fs.existsSync(indexPath)) return indexPath
  }

  return null
}

const visitors = {
  Program (path) {
    state.currentFile = path.node.filePath
    initFile(state.result, state.currentFile)
  },

  ImportDeclaration (path) {
    const absoluteImport = resolveImportPath(state.currentFile, path.node.source.value)
    if (!absoluteImport || absoluteImport === state.currentFile) return
    initFile(state.result, absoluteImport)
    incType(state.result, state.currentFile, absoluteImport, 'import')
  },

  CallExpression (path) {
    const node = path.node
    if (
      node.callee.name === 'require' &&
      node.arguments.length === 1 &&
      node.arguments[0].type === 'StringLiteral'
    ) {
      const absoluteImport = resolveImportPath(state.currentFile, node.arguments[0].value)
      if (!absoluteImport || absoluteImport === state.currentFile) return
      initFile(state.result, absoluteImport)
      incType(state.result, state.currentFile, absoluteImport, 'require')
    }
  },

  TSImportEqualsDeclaration (path) {
    const importSource = path.node.moduleReference.expression.value
    const absoluteImport = resolveImportPath(state.currentFile, importSource)
    if (!absoluteImport || absoluteImport === state.currentFile) return
    initFile(state.result, absoluteImport)
    incType(state.result, state.currentFile, absoluteImport, 'ts-import-equals')
  },

  NewExpression (path) {
    if (
      path.node.callee.type === 'Identifier' &&
      path.node.callee.name
    ) {
      if (!state._newExpr) state._newExpr = {}
      if (!state._newExpr[state.currentFile]) state._newExpr[state.currentFile] = []
      state._newExpr[state.currentFile].push(path.node.callee.name)
    }
  },

  ClassDeclaration (path) {
    if (
      path.node.superClass &&
      path.node.superClass.type === 'Identifier' &&
      path.node.superClass.name
    ) {
      if (!state._extends) state._extends = {}
      if (!state._extends[state.currentFile]) state._extends[state.currentFile] = []
      state._extends[state.currentFile].push(path.node.superClass.name)
    }

    if (path.node.implements) {
      for (const impl of path.node.implements) {
        if (impl.expression?.type === 'Identifier' && impl.expression.name) {
          if (!state._implements) state._implements = {}
          if (!state._implements[state.currentFile]) state._implements[state.currentFile] = []
          state._implements[state.currentFile].push(impl.expression.name)
        }
      }
    }
  }
}

function postProcessing (state) {
  const classesPerFile = state.dependencies['classes-per-file'] || {}
  const functionsPerFile = state.dependencies['functions-per-file'] || {}
  const functionCoupling = state.dependencies['function-coupling'] || {}

  let classCoupling = state.dependencies['class-coupling'] || {}
  if (Array.isArray(classCoupling)) {
    classCoupling = {}
  }

  const result = state.result

  for (const filePath of Object.keys(functionsPerFile)) {
    initFile(result, filePath)
  }
  for (const filePath of Object.keys(classesPerFile)) {
    initFile(result, filePath)
  }

  const newExpr = state._newExpr || {}
  for (const [sourceFile, classNames] of Object.entries(newExpr)) {
    for (const className of classNames) {
      const targetFile = findClassFile(className, classesPerFile)
      if (targetFile && targetFile !== sourceFile) {
        initFile(result, targetFile)
        incType(result, sourceFile, targetFile, 'instantiate')
      }
    }
  }

  const extends_ = state._extends || {}
  for (const [sourceFile, parentClasses] of Object.entries(extends_)) {
    for (const parentClass of parentClasses) {
      const targetFile = findClassFile(parentClass, classesPerFile)
      if (targetFile && targetFile !== sourceFile) {
        initFile(result, targetFile)
        incType(result, sourceFile, targetFile, 'inherit')
      }
    }
  }

  const implements_ = state._implements || {}
  for (const [sourceFile, interfaceNames] of Object.entries(implements_)) {
    for (const interfaceName of interfaceNames) {
      const targetFile = findClassFile(interfaceName, classesPerFile)
      if (targetFile && targetFile !== sourceFile) {
        initFile(result, targetFile)
        incType(result, sourceFile, targetFile, 'implement')
      }
    }
  }

  for (const [sourceFile, functions] of Object.entries(functionCoupling)) {
    for (const funcData of Object.values(functions)) {
      const fanOut = funcData['fan-out'] || {}
      for (const [calleeName, count] of Object.entries(fanOut)) {
        const targetFile = findFunctionFile(calleeName, functionsPerFile)
        if (targetFile && targetFile !== sourceFile) {
          initFile(result, targetFile)
          incType(result, sourceFile, targetFile, 'call', count)
        }
      }
    }
  }

  for (const [sourceFile, classes] of Object.entries(classCoupling)) {
    for (const methods of Object.values(classes)) {
      if (!Array.isArray(methods)) continue
      for (const methodNode of methods) {
        const fanOut = methodNode['fan-out'] || {}
        for (const [targetClass, calleeMethods] of Object.entries(fanOut)) {
          for (const [calleeMethod, count] of Object.entries(calleeMethods)) {
            if (calleeMethod === '_constructor') continue
            const targetFile = findClassFile(targetClass, classesPerFile)
            if (targetFile && targetFile !== sourceFile) {
              initFile(result, targetFile)
              incType(result, sourceFile, targetFile, 'call', count)
            }
          }
        }
      }
    }
  }

  for (const [sourceFile, targets] of Object.entries(result)) {
    for (const [targetFile, types] of Object.entries(targets)) {
      let hasNonZero = false
      for (const val of Object.values(types)) {
        if (val > 0) { hasNonZero = true; break }
      }
      if (!hasNonZero) {
        delete result[sourceFile][targetFile]
      }
    }
    if (Object.keys(result[sourceFile]).length === 0) {
      delete result[sourceFile]
    }
  }

  delete state.currentFile
  delete state.dependencies
  delete state._newExpr
  delete state._extends
  delete state._implements

  state.status = true
}

export { state, visitors, postProcessing }
