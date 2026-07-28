# Email domain activation checklist

Status: `READY_FOR_EXTERNAL_INPUT` in F4. No live domain has been selected or modified.

The owner must provide and approve:

- sending subdomain and visible From address;
- monitored Reply-To address;
- provider-generated DKIM records and proof of verified status;
- SPF record and proof of verified status;
- DMARC policy (`quarantine` or `reject`) and reporting mailbox;
- Resend account/project ownership and authorized live API/webhook credentials;
- confirmation that click/open tracking remains disabled unless a later privacy assessment explicitly approves it.

After DNS propagation, run the production configuration gate and provider verification without exposing record values or secrets. Send only to approved test recipients, verify delivered/delayed/bounced/complained/failed/suppressed events, then record the exact release SHA and approver. Until every item is complete, `EMAIL_LIVE_ENABLED` stays false and EMAIL-010 remains `READY_FOR_EXTERNAL_INPUT`.
