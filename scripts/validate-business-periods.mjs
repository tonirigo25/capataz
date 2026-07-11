import { expect, loadTsModule } from "./ts-test-loader.mjs";

const { resolveBusinessPeriod, isInPeriod } = loadTsModule("lib/business-periods.ts");

function ymd(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

const now = new Date(2026, 6, 11, 12, 0, 0);

const week = resolveBusinessPeriod({ id: "this_week", now });
expect(ymd(week.start) === "2026-07-06", "[business-periods] this_week must start on Monday", week);
expect(ymd(week.end) === "2026-07-13", "[business-periods] this_week must end next Monday", week);
expect(ymd(week.previousStart) === "2026-06-29", "[business-periods] previous week must be calendar week", week);

const month = resolveBusinessPeriod({ id: "this_month", now });
expect(ymd(month.start) === "2026-07-01", "[business-periods] this_month start is wrong", month);
expect(ymd(month.end) === "2026-08-01", "[business-periods] this_month end is wrong", month);
expect(ymd(month.previousStart) === "2026-06-01", "[business-periods] this_month previousStart must be previous calendar month", month);
expect(ymd(month.previousEnd) === "2026-07-01", "[business-periods] this_month previousEnd must be current month start", month);

const previousMonth = resolveBusinessPeriod({ id: "previous_month", now });
expect(ymd(previousMonth.start) === "2026-06-01", "[business-periods] previous_month start is wrong", previousMonth);
expect(ymd(previousMonth.previousStart) === "2026-05-01", "[business-periods] previous_month comparison must be May 1", previousMonth);

const quarter = resolveBusinessPeriod({ id: "this_quarter", now });
expect(ymd(quarter.start) === "2026-07-01", "[business-periods] this_quarter start is wrong", quarter);
expect(ymd(quarter.previousStart) === "2026-04-01", "[business-periods] quarter comparison must use previous quarter", quarter);

const custom = resolveBusinessPeriod({ id: "custom", from: "2026-07-05", to: "2026-07-10", now });
expect(ymd(custom.start) === "2026-07-05", "[business-periods] custom start is wrong", custom);
expect(ymd(custom.end) === "2026-07-11", "[business-periods] custom end must be exclusive next day", custom);
expect(isInPeriod(new Date(2026, 6, 10, 23), custom), "[business-periods] date inside custom period should match");
expect(!isInPeriod(new Date(2026, 6, 11, 0), custom), "[business-periods] exclusive custom end should not match");

console.log("[business-periods] OK period boundaries and comparisons");
