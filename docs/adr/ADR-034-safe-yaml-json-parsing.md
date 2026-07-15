# ADR-034: Safe YAML/JSON Parsing

Status: accepted for core slice

No safe YAML parser dependency is currently present. V1 therefore implements a
restricted canonical YAML reader/writer and rejects general YAML features.

JSON is scanned before native parsing to reject duplicate and prototype keys.
