# Screen Interchange Traceability

Traceability records where every exported screen, object and resource came
from.

## Screen Trace

- `sourceScreenId`
- `linkedStateIds`
- `selectedObjectIds`

`selectedObjectIds` is trace metadata only. It is excluded from authoring
object equality and included for optional read-only reconstruction.

## Object Trace

- `sourceScreenId`
- `sourceObjectId`
- `objectType`
- `resourceRefs`

## Resource Trace

- `resourceType`
- optional `sourceScreenId`
- optional `sourceObjectId`

Traceability is designed for diagnostics, package comparison and future
adapters. It is not a mutation source.
