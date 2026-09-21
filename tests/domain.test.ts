import { test } from "node:test";
import assert from "node:assert/strict";
import {
  metrics,
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
