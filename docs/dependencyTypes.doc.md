# File Dependency Types Metric

### ID

`dependency-types`

### Name

**File Dependency Types**

### Description

Aggregates **file-to-file dependency counts broken down by type**. For each pair of files (A → B), it produces a tuple of 6 counters covering the different ways A can depend on B.

### Output Format (example)

```json
{
  "name": "File Dependency Types",
  "description": "Aggregates file-to-file dependency counts broken down by type (import, require, call, instantiate, inherit)",
  "result": {
    "/path/to/main.js": {
      "/path/to/helper.js": {
        "import": 1,
        "require": 1,
        "ts-import-equals": 0,
        "call": 2,
        "instantiate": 0,
        "inherit": 0
      },
      "/path/to/base.js": {
        "import": 1,
        "require": 0,
        "ts-import-equals": 0,
        "call": 0,
        "instantiate": 1,
        "inherit": 1
      }
    }
  },
  "status": true
}
```

### Type breakdown

| Position | Key | Description |
|----------|-----|-------------|
| 1 | `import` | ES module `import` declarations |
| 2 | `require` | CommonJS `require()` calls |
| 3 | `ts-import-equals` | TypeScript `import = require()` declarations |
| 4 | `call` | Function/method calls (via `function-coupling` and `class-coupling`) |
| 5 | `instantiate` | `new` expressions (`NewExpression`) |
| 6 | `inherit` | Class `extends` (`ClassDeclaration` with `superClass`) |
| 7 | `implement` | TypeScript `implements` (`ClassDeclaration` with `implements` clause) |

### How it works

1. **Dependencies**

    * Requires `file-coupling`, `function-coupling`, `class-coupling`, `functions-per-file`, and `classes-per-file`.

2. **AST Traversal**

    * `ImportDeclaration` → counts `.import`
    * `CallExpression` (with `require`) → counts `.require`
    * `TSImportEqualsDeclaration` → counts `.ts-import-equals`
    * `NewExpression` → stores the class name for later file resolution
    * `ClassDeclaration` with `superClass` → stores the parent class name for later file resolution

3. **Post-processing aggregation**

    * Resolves stored class names to file paths using `classes-per-file` and increments `.instantiate` / `.inherit`.
    * Reads `function-coupling` fan-out, resolves callee function names to files via `functions-per-file`, and increments `.call`.
    * Reads `class-coupling` fan-out, resolves target class names to files via `classes-per-file` (skipping `_constructor` entries handled by the AST visitor), and increments `.call`.

### Notes

* Only local files are considered—external packages are ignored.
* The `_constructor` convention from `class-coupling` is used to avoid double-counting instantiations.
* Files with no outgoing dependencies are omitted from the result.
* Useful for displaying a detailed dependency type breakdown on edge click in a graph visualization (e.g., `mmfrontend`).
