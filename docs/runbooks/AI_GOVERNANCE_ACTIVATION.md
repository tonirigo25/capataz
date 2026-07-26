# AI governance activation, rotation and revocation

## Safety baseline

AI is fail-closed at two independent levels: `AI_ENABLED=false` is the global default and every company policy defaults to `enabled=false` plus `killSwitch=true`. Manual product flows and injected fake providers remain available without a live provider. Production and persistent staging are not activated by this runbook or by F6.

Only synthetic fixtures may be used until every environment-specific gate is approved. Never send customer, company, invoice, document, address, telephone, bank, tax or other real business data while validating the integration.

## Minimum OpenAI project permissions

Use a dedicated project per environment. The service account or project key must have only the permission needed to create Responses for the explicitly approved models. It must not have organization administration, billing administration, project/key management, fine-tuning, batch, file, vector store or unrelated model permissions. A human project owner retains key creation, budget and revocation rights; the runtime principal does not.

Before any broad test, the project owner configures a small hard budget where supported, low warning thresholds and named recipients. The first live validation is limited to the six `AI-LIVE-*` controls and the versioned synthetic dataset.

## Local activation

1. Complete only the OpenAI Platform secure key workflow. Select the intended non-production project and a phase-specific key name.
2. Let the trusted local-save confirmation write only `OPENAI_API_KEY` to the ignored, non-symlink `.env.local` inside this worktree. Do not copy, reveal, paste, echo or route the value through a terminal, script, chat, log or evidence file.
3. Configure non-secret names in `.env.local`: project identifier, approved data profile, exact model snapshots, `OPENAI_STORE=false`, `AI_PROVIDER_MODE=openai` and `AI_LIVE_APPROVAL=approved-local`.
4. Keep `AI_ENABLED=false` while running configuration validation. Enable it only for the bounded synthetic smoke, then return it to false.
5. Record only variable presence, model/snapshot, aggregate calls, tokens, cost, time and outcome. Never record content or provider references in raw form.

If the trusted UI cannot complete the local save, classify `AI-LIVE-001` as `READY_FOR_EXTERNAL_INPUT`; do not use a manual alternative.

## Staging activation

Staging requires separate authorization and a staging-only OpenAI project/key, confirmed project budget/alerts, approved endpoint/region/data profile and pinned snapshots. Set `AI_LIVE_APPROVAL=approved-staging`, prove the key and project are not shared with production, seed only synthetic tenants, run the six live gates, and disable the global flag after evidence collection. Never reuse the local or production key.

## Production activation

Production is a separate release decision. It requires approved DPA/subprocessor/transfer facts, reconciled provider usage, a production-only project/key and budget, incident owner, rollback window, explicit `AI_LIVE_APPROVAL=approved-production`, approved company allowlist and manual release gate. Start with the global flag off and company kill switches on. No production activation is part of F6.

## Rotation

1. Keep the current key active while a project owner creates a new scoped key through the secure Platform flow.
2. Save it through the approved environment secret mechanism without printing it. Never place it in Git, `.env.example`, artifacts or provider logs.
3. Validate the new key with the minimal synthetic smoke and `store=false`.
4. Switch one environment at a time, observe aggregate errors and usage, then revoke the old key in Platform.
5. Record key name, environment, actor/approver, timestamps and outcome only; never record the value or a fragment.

## Emergency revocation

Set the global AI flag off first, leave company kill switches on, revoke the affected key in OpenAI Platform, invalidate any derived deployment secret, assess logs using hashes/metadata only, rotate with a new scoped key, and reopen through the normal gated process. Manual product workflows remain the operational fallback.
