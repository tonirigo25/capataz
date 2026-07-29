# AI provider, DPA and transfer assessment

Status: controlled technical activation authorized for synthetic validation and one allowlisted owner company; provider/account/legal facts below remain external and must not be overstated.

## Technical controls implemented

- A single server-side transport boundary forces `store=false` on compatible Responses calls.
- Context is allowlisted, minimized and redacted before transport construction.
- Provider metadata uses pseudonymous references and a fixed allowlist.
- Raw prompts, documents and outputs are excluded from usage logs; retained response envelopes expire under company policy.
- Company/actor budgets, roles, scopes, classification, concurrency, token and payload limits fail closed.
- Sensitive effects require human confirmation and enter a transactional outbox; model output never performs the effect directly.
- Global and company kill switches preserve full manual operation.

## External facts still to approve

The controller must confirm and version: the legal OpenAI entity and DPA, active subprocessor list, contracted processing location, selected endpoint/region, international transfer mechanism and supplementary measures, approved data profile (default/MAM/ZDR where eligible), retention exceptions, incident notice channel, deletion/DSR cooperation, audit rights, and the lawful basis/purpose for each enabled use case.

No document in this repository represents ZDR, Modified Abuse Monitoring, a region, a transfer safeguard or a contractual term as active. Those facts remain `READY_FOR_EXTERNAL_INPUT` until an authorized owner supplies current evidence without exposing credentials or sensitive project identifiers.

## Controlled rollout boundary

The current authorization permits synthetic live validation and the explicitly allowlisted owner company with `store=false`, minimization, human review, budgets and kill switches. It does not prove ZDR, a processing region, a transfer mechanism or legal approval for general availability. AI document extraction remains disabled until the document payload path and its privacy facts receive separate evidence. Public registration and expansion beyond the allowlist remain blocked; this technical record is not legal advice.
