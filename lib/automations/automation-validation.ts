export const INTERNAL_ACTIONS = [
  "create_task",
  "create_reminder",
  "create_followup",
  "create_recommendation",
  "create_alert",
  "add_internal_note",
  "create_calendar_event",
  "mark_recommendation_reviewed",
  "snooze_recommendation",
  "open_review_request",
  "generate_pdf_draft",
  "generate_internal_summary",
  "assign_task",
  "update_task_priority",
  "link_entities",
  "write_audit_event",
] as const;
export const DISABLED_EXTERNAL_ACTIONS = [
  "send_email",
  "send_whatsapp",
  "send_sms",
  "register_payment",
  "mark_invoice_paid",
  "create_invoice",
  "issue_invoice",
  "close_work",
  "delete_entity",
  "modify_financial_amount",
  "create_purchase",
  "sign_document",
] as const;
export const COMPARATORS = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_or_equal",
  "less_than",
  "less_or_equal",
  "contains",
  "not_contains",
  "is_empty",
  "is_not_empty",
  "before",
  "after",
  "days_overdue",
  "changed_from",
  "changed_to",
  "in",
  "not_in",
] as const;

export function validatePublishedVersion(input: {
  triggers: unknown[];
  actions: { actionType: string }[];
  conditions: { comparator: string }[];
}) {
  if (!input.triggers.length) throw new Error("AUTOMATION_TRIGGER_REQUIRED");
  if (!input.actions.length) throw new Error("AUTOMATION_ACTION_REQUIRED");
  for (const action of input.actions) {
    if (
      (DISABLED_EXTERNAL_ACTIONS as readonly string[]).includes(
        action.actionType,
      )
    )
      throw new Error("EXTERNAL_ACTION_DISABLED");
    if (!(INTERNAL_ACTIONS as readonly string[]).includes(action.actionType))
      throw new Error("UNKNOWN_AUTOMATION_ACTION");
  }
  for (const condition of input.conditions)
    if (!(COMPARATORS as readonly string[]).includes(condition.comparator))
      throw new Error("INVALID_COMPARATOR");
}
