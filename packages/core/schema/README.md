# Result schema

`pragu-result.schema.json` (JSON Schema 2020-12) describes `pragu-result.json`, the file every scan writes. It is Pragu's stable machine contract: CI scripts, dashboards and the GitHub Action read it.

## Versioning

`schemaVersion` in every result follows semantic versioning, and the schema's `$id` carries the same version.

- **Before 1.0** (now): any change bumps the minor version (0.6.0 → 0.7.0) and is listed in `RESULT_SCHEMA_VERSION`'s comment in `packages/core/src/model.ts`. Fields may still change.
- **From 1.0:** adding an optional field is a minor version. Removing or renaming a field, or changing its meaning or type, is a major version, announced one minor release ahead with the field marked deprecated in this schema.

The schema rejects unknown fields on purpose. A test validates real results from Pragu Bench against it, so the code and the schema cannot drift apart unnoticed.
