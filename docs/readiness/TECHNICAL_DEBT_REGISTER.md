# Technical debt register

Status: open, non-blocking items remain visible and must not be converted into
unqualified release claims.

| ID | Priority | Owner | Target | Debt and exit evidence |
| --- | --- | --- | --- | --- |
| TD-001 | High | Data and release | Before production candidate | Representative-data migration has no authorized sanitized snapshot. Exit: D1 signed rehearsal manifest. |
| TD-002 | High | Security operations | Before public security channel | No monitored responsible-disclosure channel. Exit: tested intake and approved `security.txt`. |
| TD-003 | High | Mobile release | Before store submission | No signed device artifacts or store-console evidence. Exit: F10 external gates. |
| TD-004 | Medium | QA | Before approving visual baselines | Candidate screenshots are not human-approved baselines. Exit: signed baseline manifest tied to SHA. |
| TD-005 | Medium | Legal and repository owner | Before buyer diligence | Public repository plus proprietary notice needs an explicit visibility decision. Exit: recorded counsel/owner decision. |
| TD-006 | Medium | Product research | Before outcome claims | No real comprehension, interview or activation cohort. Exit: consented B1/B2 and C6 evidence. |

New debt discovered during C0–C11 must be appended with an owner, priority,
target and measurable exit. Test duration and repeated failures belong in the
C5 evidence manifest rather than being silently retried.
