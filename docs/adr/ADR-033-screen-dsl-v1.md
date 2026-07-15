# ADR-033: Screen DSL V1

Status: accepted for core slice

Screen DSL V1 is a text-facing representation above ScreenInterchangeModelV1.
It is not a second screen domain model and does not change schema-v5.

Decision: implement V1 as pure conversion, parser/writer, diagnostics,
validation and semantic diff first. Application Preview/Apply is a later slice.
