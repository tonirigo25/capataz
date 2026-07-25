# ADR 0002: Decimal money

Status: accepted, additive transition.

Fiscal and billing evidence uses `Decimal`; existing `Float` money fields remain temporarily for compatibility. Nullable mirrors, per-company backfills, dual-write, and exact aggregate reconciliation precede any read cutover. Destructive conversion is explicitly out of scope.
