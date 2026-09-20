import { z } from "zod";
import {
  format,
  parseISO,
  isValid,
  addDays,
  differenceInCalendarDays,
  getDay,
} from "date-fns";
export const day = (d = new Date()) => format(d, "yyyy-MM-dd");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期無效")
  .refine((v) => isValid(parseISO(v)) && day(parseISO(v)) === v, "日期無效");
export const goalStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
  "expired",
  "abandoned",
]);
export const goalSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1, "請輸入目標名稱").max(100),
    description: z.string().max(1000),
    startDate: date,
    endDate: date,
    frequency: z.enum(["daily", "weekly", "custom"]),
    days: z.array(z.number().int().min(0).max(6)).max(7),
    targetScore: z
      .number({ error: "請輸入有效目標分數" })
      .int()
      .min(1)
      .max(10000),
    targetRate: z
      .number({ error: "請輸入有效目標完成率" })
      .min(1)
      .max(100),
    reward: z.string().max(200),
    status: goalStatusSchema,
    redeemedAt: z.string().nullable(),
  })
  .superRefine((g, c) => {
    if (g.endDate < g.startDate)
      c.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "結束日期不能早於開始日期",
      });
    if (
      differenceInCalendarDays(parseISO(g.endDate), parseISO(g.startDate)) >
      3650
    )
      c.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "目標期間最多 10 年",
      });
    if (
      g.frequency !== "daily" &&
      (g.days.length === 0 || (g.frequency === "weekly" && g.days.length !== 1))
    )
      c.addIssue({
        code: "custom",
        path: ["days"],
        message: "Weekly 請選一天；Custom 請至少選一天",
      });
    if (
      g.endDate >= g.startDate &&
      (g.frequency === "daily" ||
        (g.days.length > 0 &&
          (g.frequency !== "weekly" || g.days.length === 1))) &&
      scheduledDayCount(g) === 0
    )
      c.addIssue({
        code: "custom",
        path: ["days"],
        message: "日期範圍內沒有排程日",
      });
  });
export type Goal = z.infer<typeof goalSchema>;
export const checkSchema = z.object({
  goalId: z.string(),
  date,
  result: z.enum(["completed", "failed", "skipped"]),
  note: z.string().max(2000),
  updatedAt: z.string().datetime(),
});
export type CheckIn = z.infer<typeof checkSchema>;
export const notificationSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "提醒時間無效").default("09:00"),
  checkInReminders: z.boolean().default(true),
  lastSentDate: date.nullable().default(null),
});
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
export const backupSchema = z
  .object({
    version: z.literal(1),
    goals: z.array(goalSchema).max(500),
    checkIns: z.array(checkSchema).max(100000),
    language: z.enum(["zh-Hant", "zh-Hans", "en"]).optional(),
    notificationSettings: notificationSettingsSchema.optional(),
  })
  .superRefine((b, c) => {
    const ids = new Set(b.goals.map((g) => g.id));
    if (ids.size !== b.goals.length)
      c.addIssue({ code: "custom", message: "重複目標 ID" });
    const keys = new Set<string>();
    for (const r of b.checkIns) {
      const g = b.goals.find((g) => g.id === r.goalId);
      const k = r.goalId + ":" + r.date;
      if (!g || !scheduled(g, r.date) || r.date > day() || keys.has(k))
        c.addIssue({
          code: "custom",
          message: "打卡包含重複、未排程、未來或不存在的目標記錄",
        });
      keys.add(k);
    }
  });
export type Backup = z.infer<typeof backupSchema>;
export type GoalSchedule = Pick<
  Goal,
  "startDate" | "endDate" | "frequency" | "days"
>;
export function scheduled(g: GoalSchedule, d: string) {
  return (
    d >= g.startDate &&
    d <= g.endDate &&
    (g.frequency === "daily" || g.days.includes(getDay(parseISO(d))))
  );
}
export function dates(start: string, end: string) {
  if (start > end) return [];
  return Array.from(
    { length: differenceInCalendarDays(parseISO(end), parseISO(start)) + 1 },
    (_, i) => day(addDays(parseISO(start), i)),
  );
}
export function scheduledDayCount(g: GoalSchedule) {
  if (
    !date.safeParse(g.startDate).success ||
    !date.safeParse(g.endDate).success ||
    g.endDate < g.startDate
  )
    return 0;
  return dates(g.startDate, g.endDate).filter((d) => scheduled(g, d)).length;
}
export const scoreOf = (r: CheckIn) =>
  r.result === "completed" ? 1 : r.result === "failed" ? -1 : 0;
export function metrics(g: Goal, all: CheckIn[], today = day()) {
  const records = all.filter((r) => r.goalId === g.id && r.date <= today);
  const completed = records.filter((r) => r.result === "completed").length,
    failed = records.filter((r) => r.result === "failed").length,
    skipped = records.filter((r) => r.result === "skipped").length;
  const score = completed - failed,
    rate = completed + failed ? (completed / (completed + failed)) * 100 : 0;
  const time = Math.max(
    0,
    Math.min(
      100,
      ((differenceInCalendarDays(parseISO(today), parseISO(g.startDate)) + 1) /
        (differenceInCalendarDays(parseISO(g.endDate), parseISO(g.startDate)) +
          1)) *
        100,
    ),
  );
  const byDate = new Map(records.map((r) => [r.date, r]));
  let streak = 0,
    best = 0;
  for (const d of dates(
    g.startDate,
    today < g.endDate ? today : g.endDate,
  ).filter((d) => scheduled(g, d))) {
    const r = byDate.get(d);
    if (d === today && !r) continue;
    streak = r?.result === "completed" ? streak + 1 : 0;
    best = Math.max(best, streak);
  }
  const achieved = score >= g.targetScore && rate >= g.targetRate;
  const status =
    g.status !== "active"
      ? g.status
      : achieved
        ? "completed"
        : today > g.endDate
          ? "expired"
          : "active";
  const gap = (score / g.targetScore) * 100 - time;
  const health =
    gap >= 10
      ? "Ahead"
      : gap >= -10
        ? "On Track"
        : gap >= -25
          ? "Slightly Behind"
          : "At Risk";
  return {
    completed,
    failed,
    skipped,
    score,
    rate,
    time,
    streak,
    best,
    achieved,
    status,
    health,
    rewardStatus: g.redeemedAt ? "redeemed" : achieved ? "unlocked" : "locked",
  };
}
export function demo(): Backup {
  const today = day();
  const make = (
    id: string,
    name: string,
    description: string,
    reward: string,
    targetScore = 25,
  ): Goal => ({
    id,
    name,
    description,
    reward,
    targetScore,
    targetRate: 80,
    startDate: day(addDays(new Date(), -20)),
    endDate: day(addDays(new Date(), 20)),
    frequency: "daily",
    days: [],
    status: "active",
    redeemedAt: null,
  });
  const goals = [
    make(
      "move",
      "每天動一動",
      "運動 30 分鐘，留一點時間給自己。",
      "一雙新的跑鞋",
    ),
    make(
      "read",
      "每天閱讀 20 頁",
      "放下手機，讀完床頭那本書。",
      "週末書店小旅行",
    ),
    make(
      "focus",
      "留給深度工作的時間",
      "每天安排一段不被打擾的 60 分鐘。",
      "喜歡的手沖咖啡器具",
    ),
    {
      ...make(
        "week",
        "每週回顧",
        "整理這週的收穫與下一步。",
        "一頓美好的晚餐",
        5,
      ),
      frequency: "weekly" as const,
      days: [0],
    },
  ];
  const checkIns: CheckIn[] = [];
  goals.forEach((g, n) =>
    dates(g.startDate, today).forEach((d, i) => {
      if (!scheduled(g, d) || d === today || (i + n) % 9 === 0) return;
      checkIns.push({
        goalId: g.id,
        date: d,
        result:
          n === 2
            ? i % 3 === 0
              ? "completed"
              : "failed"
            : (i + n) % 7 === 0
              ? "skipped"
              : (i + n) % 6 === 0
                ? "failed"
                : "completed",
        note: i % 4 === 0 ? "今天有做到，繼續保持自己的節奏。" : "",
        updatedAt: new Date().toISOString(),
      });
    }),
  );
  return { version: 1, goals, checkIns };
}
