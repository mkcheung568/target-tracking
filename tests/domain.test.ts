import { test } from "node:test";
import assert from "node:assert/strict";
import {
  metrics,
  backupSchema,
  Goal,
  CheckIn,
  scheduled,
  day,
  notificationSettingsSchema,
} from "../lib/domain";
import { useStore } from "../lib/store";
const g: Goal = {
  id: "a",
  name: "Goal",
  description: "",
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
  assert.equal(m.streak, 0);
  assert.equal(m.best, 2);
  assert.equal(m.skipped, 1);
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
