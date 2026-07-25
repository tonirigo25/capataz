# ADR 0001: Modular monolith

Status: accepted for readiness F1.

Orqena will remain one Next.js codebase with one PostgreSQL contract and separately deployable web/worker processes. Module boundaries and versioned events provide isolation. Microservices are deferred until measured load, compliance isolation, or team ownership demonstrates a concrete need.
