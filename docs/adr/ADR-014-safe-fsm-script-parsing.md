# ADR-014: Safe FSM Script Parsing

## Status

Accepted.

## Decision

Parse Mermaid and Python-like DSL with bounded declarative parsers. Do not
execute Python, Mermaid plugins, subprocesses or arbitrary code.

## Consequences

Unsupported syntax returns diagnostics with line and column. The Python-like DSL
is documented as declarative text, not Python runtime code.
