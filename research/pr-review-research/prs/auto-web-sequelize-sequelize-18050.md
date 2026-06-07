# sequelize/sequelize #18050 — feat(oracle): add oracle support

**[View PR on GitHub](https://github.com/sequelize/sequelize/pull/18050)**

| | |
|---|---|
| **Author** | @sudarshan12s |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @WikiRik
> To ensure bind numbering continues correctly between the two queries, `createBindParamGenerator` was updated to accept the dialect parameter and continue numbering based on `Object.keys(bind).length`.

### @coderabbitai
> Lines 397 and 407 return T-SQL syntax (`COMMIT TRANSACTION` / `ROLLBACK TRANSACTION`), which Oracle does not support. Oracle requires `COMMIT` and `ROLLBACK` without the `TRANSACTION` keyword.

### @coderabbitai
> Splicing array elements while iterating `idxToDelete` in forward order causes index misalignment. After the first `splice`, remaining indices point to wrong elements.

### @coderabbitai
> `getDefaultSchema` will throw in non-replication setups [because] Line 110 accesses `this.sequelize.options.replication.write.username` without safe optional chaining on `replication` or `write`.

### @coderabbitai
> Line 898 compares `attribute.type === 'DOUBLE'` (strict equality with a string), but `attribute.type` is a DataType class instance. This condition is unreachable dead code.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
