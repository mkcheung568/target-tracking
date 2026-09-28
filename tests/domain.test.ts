import { test } from "node:test";
import assert from "node:assert/strict";
import {
  metrics,
  canBackfill,
  fillMissedCheckIns,
  backupSchema,
  goalSchema,
  Goal,
  CheckIn,
  scheduled,
  scheduledDayCount,
  day,
  notificationSettingsSchema,
} from "../lib/domain";
import { useStore } from "../lib/store";
const g: Goal = {
  id: "a",
  name: "Goal",
  description: "",
  icon: "target",
  color: "indigo",
  startDate: "2026-01-01",
  endDate: "2026-01-10",
  frequency: "daily",
  days: [],
  targetScore: 2,
  targetRate: 60,
  reward: "Book",
  status: "active",
  redeemedAt: null,
};
const r = (date: string, result: CheckIn["result"]): CheckIn => ({
  goalId: "a",
  date,
  result,
  note: "",
  updatedAt: new Date().toISOString(),
});
test("source-of-truth score, skipped denominator, missed days and streak", () => {
  const m = metrics(
    g,
    [
      r("2026-01-01", "completed"),
      r("2026-01-02", "completed"),
      r("2026-01-03", "failed"),
      r("2026-01-04", "skipped"),
    ],
    "2026-01-06",
  );
  assert.equal(m.score, 1);
  assert.equal(Math.round(m.rate), 67);
  assert.equal(m.progress, 50);
  assert.equal(m.streak, 0);
  assert.equal(m.best, 2);
  assert.equal(m.skipped, 1);
});
test("score progress is clamped from zero through the target", () => {
  assert.equal(metrics(g, []).progress, 0);
  assert.equal(metrics(g, [r("2026-01-01", "failed")]).progress, 0);
  assert.equal(
    metrics(g, [r("2026-01-01", "completed"), r("2026-01-02", "completed")])
      .progress,
    100,
  );
  assert.equal(
    metrics(
      { ...g, targetScore: 1 },
      [r("2026-01-01", "completed"), r("2026-01-02", "completed")],
    ).progress,
    100,
  );
});
test("unrecorded today retains streak; tomorrow missing breaks it", () => {
  const rs = [r("2026-01-01", "completed"), r("2026-01-02", "completed")];
  assert.equal(metrics(g, rs, "2026-01-03").streak, 2);
  assert.equal(metrics(g, rs, "2026-01-04").streak, 0);
});
test("completion and reward require both targets; deadline expires", () => {
  assert.equal(
    metrics(
      g,
      [r("2026-01-01", "completed"), r("2026-01-02", "completed")],
      "2026-01-03",
    ).rewardStatus,
    "unlocked",
  );
  assert.equal(metrics(g, [], "2026-01-11").status, "expired");
  assert.equal(
    metrics({ ...g, status: "paused" }, [], "2026-01-11").status,
    "paused",
  );
});
test("weekly and custom scheduled days", () => {
  assert.equal(
    scheduled({ ...g, frequency: "weekly", days: [4] }, "2026-01-01"),
    true,
  );
  assert.equal(
    scheduled({ ...g, frequency: "weekly", days: [4] }, "2026-01-02"),
    false,
  );
});
test("scheduled day count includes both endpoints and respects frequency", () => {
  assert.equal(scheduledDayCount(g), 10);
  assert.equal(
    scheduledDayCount({ ...g, frequency: "weekly", days: [4] }),
    2,
  );
  assert.equal(
    scheduledDayCount({ ...g, frequency: "custom", days: [0, 6] }),
    3,
  );
  assert.equal(scheduledDayCount({ ...g, endDate: "" }), 0);
});
test("goal requires at least one scheduled day", () => {
  const result = goalSchema.safeParse({
    ...g,
    startDate: "2026-01-02",
    endDate: "2026-01-02",
    frequency: "weekly",
    days: [4],
  });
  assert.equal(result.success, false);
  if (!result.success)
    assert.equal(
      result.error.issues.some((issue) => issue.message === "日期範圍內沒有排程日"),
      true,
    );
});
test("backup rejects duplicates, orphan records and impossible dates", () => {
  const b = {
    version: 1,
    goals: [g],
    checkIns: [r("2026-01-01", "completed")],
  };
  assert.equal(backupSchema.safeParse(b).success, true);
  assert.equal(
    backupSchema.safeParse({ ...b, checkIns: [...b.checkIns, ...b.checkIns] })
      .success,
    false,
  );
  assert.equal(backupSchema.safeParse({ ...b, goals: [] }).success, false);
  assert.equal(
    backupSchema.safeParse({ ...b, goals: [{ ...g, startDate: "2026-02-30" }] })
      .success,
    false,
  );
});
test("legacy goals receive default appearance values", () => {
  const legacyGoal: Partial<Goal> = { ...g };
  delete legacyGoal.icon;
  delete legacyGoal.color;
  const result = backupSchema.safeParse({
    version: 1,
    goals: [legacyGoal],
    checkIns: [],
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.goals[0].icon, "target");
    assert.equal(result.data.goals[0].color, "indigo");
  }
});
test("notification settings default safely and validate time", () => {
  const settings = notificationSettingsSchema.parse({});
  assert.equal(settings.enabled, false);
  assert.equal(settings.time, "09:00");
  assert.equal(settings.checkInReminders, true);
  assert.equal(
    notificationSettingsSchema.safeParse({ ...settings, time: "25:00" })
      .success,
    false,
  );
});
test("store updates one record per date and cascades deletion", () => {
  const goal = { ...g, startDate: day(), endDate: day() };
  useStore.setState({ goals: [goal], checkIns: [] });
  useStore.getState().check(r(day(), "completed"));
  useStore.getState().check(r(day(), "failed"));
  assert.equal(useStore.getState().checkIns.length, 1);
  assert.equal(metrics(goal, useStore.getState().checkIns).score, -1);
  useStore.getState().remove("a");
  assert.equal(useStore.getState().checkIns.length, 0);
});
test("store reorders goals around a target and ignores invalid moves", () => {
  const goals = [
    { ...g, id: "a" },
    { ...g, id: "b" },
    { ...g, id: "c" },
  ];
  useStore.setState({ goals, checkIns: [] });
  useStore.getState().reorderGoal("c", "a");
  assert.deepEqual(
    useStore.getState().goals.map((goal) => goal.id),
    ["c", "a", "b"],
  );
  useStore.getState().reorderGoal("c", "c");
  useStore.getState().reorderGoal("missing", "a");
  useStore.getState().reorderGoal("c", "missing");
  assert.deepEqual(
    useStore.getState().goals.map((goal) => goal.id),
    ["c", "a", "b"],
  );
  useStore.getState().reorderGoal("c", "b");
  assert.deepEqual(
    useStore.getState().goals.map((goal) => goal.id),
    ["a", "b", "c"],
  );
});
test("store remembers the goal status filter", () => {
  useStore.getState().setGoalStatusFilter("active");
  assert.equal(useStore.getState().goalStatusFilter, "active");
  useStore.getState().setGoalStatusFilter("all");
});


test("historical eligibility respects status, dates and schedule", () => {
  for (const status of ["active", "completed", "expired"] as const)
    assert.equal(canBackfill({ ...g, status }, "2026-01-01", "2026-01-11"), true);
  for (const status of ["draft", "paused", "abandoned"] as const)
    assert.equal(canBackfill({ ...g, status }, "2026-01-01", "2026-01-11"), false);
  for (const d of ["2025-12-31", "2026-01-11", "2026-02-30", "bad"])
    assert.equal(canBackfill(g, d, "2026-01-11"), false);
  assert.equal(canBackfill(g, "2026-01-02", "2026-01-02"), false);
  assert.equal(canBackfill({ ...g, frequency: "weekly", days: [4] }, "2026-01-02", "2026-01-11"), false);
});

test("automatic skips catch up through yesterday, preserve records and are idempotent", () => {
  const original = { ...r("2026-01-01", "failed"), note: "Keep this" };
  const before = fillMissedCheckIns([g], [original], "2026-01-03");
  assert.equal(before.length, 2);
  assert.deepEqual(before[0], original);
  assert.equal(before[1].result, "skipped");
  assert.equal(before[1].date, "2026-01-02");
  assert.equal(fillMissedCheckIns([g], before, "2026-01-03"), before);
  const after = fillMissedCheckIns([g], before, "2026-01-20");
  assert.equal(after.length, 10);
  assert.equal(after.at(-1)?.date, g.endDate);
  assert.equal(metrics(g, before).score, metrics(g, after).score);
  assert.equal(metrics(g, before).rate, metrics(g, after).rate);
  assert.equal(fillMissedCheckIns([g], [], "2025-12-31").length, 0);
});

test("automatic skips respect all statuses and weekly/custom schedules", () => {
  for (const status of ["draft", "paused", "abandoned"] as const)
    assert.equal(fillMissedCheckIns([{ ...g, status }], [], "2026-01-11").length, 0);
  for (const status of ["active", "completed", "expired"] as const)
    assert.equal(fillMissedCheckIns([{ ...g, status }], [], "2026-01-11").length, 10);
  assert.deepEqual(fillMissedCheckIns([{ ...g, frequency: "weekly", days: [4] }], [], "2026-01-11").map((r) => r.date), ["2026-01-01", "2026-01-08"]);
  assert.equal(fillMissedCheckIns([{ ...g, frequency: "custom", days: [0, 6] }], [], "2026-01-11").length, 3);
});

test("expired goal backfill unlocks reward and replaces a skip without duplicates", () => {
  const goal = { ...g, endDate: "2026-01-03", targetScore: 3, targetRate: 100 };
  useStore.getState().replace({ version: 1, goals: [goal], checkIns: [r("2026-01-01", "completed"), r("2026-01-02", "completed")] });
  assert.equal(metrics(goal, useStore.getState().checkIns).score, 2);
  assert.equal(useStore.getState().checkIns[2].result, "skipped");
  assert.equal(useStore.getState().check({ ...r("2026-01-03", "completed"), note: "Backfilled" }), true);
  assert.equal(useStore.getState().checkIns.length, 3);
  const m = metrics(goal, useStore.getState().checkIns);
  assert.equal(m.score, 3);
  assert.equal(m.rate, 100);
  assert.equal(m.best, 3);
  assert.equal(m.rewardStatus, "unlocked");
  useStore.getState().redeem(goal.id);
  assert.equal(useStore.getState().check(r("2026-01-03", "failed")), true);
  assert.equal(metrics(useStore.getState().goals[0], useStore.getState().checkIns).rewardStatus, "redeemed");
  assert.equal(useStore.getState().check(r("2026-01-04", "completed")), false);
  assert.equal(useStore.getState().check({ ...r("2026-01-01", "completed"), note: "x".repeat(2001) }), false);
  assert.equal(useStore.getState().check(r("2099-01-01", "completed")), false);
  assert.equal(useStore.getState().check({ ...r("2026-01-01", "completed"), goalId: "missing" }), false);
  const backup = backupSchema.parse({ version: 1, goals: useStore.getState().goals, checkIns: useStore.getState().checkIns });
  useStore.getState().replace(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(useStore.getState().checkIns, backup.checkIns);
});

test("store rejects historical writes to excluded statuses and reconciles after resume", () => {
  for (const status of ["draft", "paused", "abandoned"] as const) {
    useStore.getState().replace({ version: 1, goals: [{ ...g, status }], checkIns: [r("2026-01-01", "completed")] });
    assert.equal(useStore.getState().check(r("2026-01-01", "failed")), false);
    assert.equal(useStore.getState().check(r("2026-01-02", "completed")), false);
    useStore.getState().reconcile();
    assert.equal(useStore.getState().checkIns.length, 1);
  }
  useStore.getState().save(g);
  assert.equal(useStore.getState().checkIns.length, 10);
  const records = useStore.getState().checkIns;
  useStore.getState().reconcile();
  assert.equal(useStore.getState().checkIns, records);
});
