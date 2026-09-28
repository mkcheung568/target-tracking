import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  Backup,
  Goal,
  CheckIn,
  backupSchema,
  goalStatusSchema,
  notificationSettingsSchema,
  NotificationSettings,
  day,
  scheduled,
  metrics,
  checkSchema,
  goalSchema,
  canBackfill,
  fillMissedCheckIns,
} from "./domain";
import { Language } from "./i18n";
export type GoalStatusFilter = "all" | Goal["status"];
type State = Backup & {
  initialized: boolean;
  language: Language;
  notificationSettings: NotificationSettings;
  goalStatusFilter: GoalStatusFilter;
  storageError: string;
  replace: (b: Backup) => void;
  save: (g: Goal) => void;
  reorderGoal: (activeId: string, targetId: string) => void;
  remove: (id: string) => void;
  check: (r: CheckIn) => boolean;
  reconcile: () => void;
  redeem: (id: string) => void;
  setLanguage: (language: Language) => void;
  setGoalStatusFilter: (filter: GoalStatusFilter) => void;
  setNotificationSettings: (
    settings: Partial<NotificationSettings>,
  ) => void;
};
let storageErrorReported = false;
export const useStore = create<State>()(
  persist(
    (set, get) => ({
      version: 1,
      goals: [],
      checkIns: [],
      initialized: false,
      language: "zh-Hant",
      notificationSettings: notificationSettingsSchema.parse({}),
      goalStatusFilter: "all",
      storageError: "",
      replace: (b) => {
        const parsed = backupSchema.parse(b);
        set({
          ...parsed,
          checkIns: fillMissedCheckIns(parsed.goals, parsed.checkIns),
          initialized: true,
          language: parsed.language ?? get().language,
          notificationSettings:
            parsed.notificationSettings ?? get().notificationSettings,
        });
      },
      save: (g) => {
        const goal = goalSchema.parse(g);
        const s = get();
        const goals = s.goals.some((x) => x.id === goal.id)
          ? s.goals.map((x) => x.id === goal.id ? goal : x) : [...s.goals, goal];
        // Keep backup validity when callers change a goal's schedule.
        backupSchema.parse({ version: 1, goals, checkIns: s.checkIns });
        set({ goals, checkIns: fillMissedCheckIns(goals, s.checkIns) });
      },
      reconcile: () => {
        const s = get();
        if (!s.initialized || s.storageError) return;
        const checkIns = fillMissedCheckIns(s.goals, s.checkIns);
        if (checkIns !== s.checkIns) set({ checkIns });
      },
      reorderGoal: (activeId, targetId) =>
        set((s) => {
          const from = s.goals.findIndex((goal) => goal.id === activeId);
          const to = s.goals.findIndex((goal) => goal.id === targetId);
          if (from < 0 || to < 0 || from === to) return {};
          const goals = [...s.goals];
          const [moved] = goals.splice(from, 1);
          goals.splice(to, 0, moved);
          return { goals };
        }),
      remove: (id) =>
        set((s) => ({
          goals: s.goals.filter((g) => g.id !== id),
          checkIns: s.checkIns.filter((r) => r.goalId !== id),
        })),
      check: (r) => {
        const parsed = checkSchema.safeParse(r);
        if (!parsed.success) return false;
        r = parsed.data;
        const g = get().goals.find((g) => g.id === r.goalId);
        const today = day();
        if (!g || r.date > today || !scheduled(g, r.date)) return false;
        if (r.date < today && !canBackfill(g, r.date, today)) return false;
        const exists = get().checkIns.some(
          (x) => x.goalId === r.goalId && x.date === r.date,
        );
        if (r.date === today && !exists && metrics(g, get().checkIns).status !== "active") return false;
        set((s) => ({
          checkIns: [
            ...s.checkIns.filter(
              (x) => !(x.goalId === r.goalId && x.date === r.date),
            ),
            r,
          ],
        }));
        return true;
      },
      redeem: (id) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === id && metrics(g, s.checkIns).rewardStatus === "unlocked"
              ? { ...g, redeemedAt: new Date().toISOString() }
              : g,
          ),
        })),
      setLanguage: (language) => set({ language }),
      setGoalStatusFilter: (goalStatusFilter) => set({ goalStatusFilter }),
      setNotificationSettings: (settings) =>
        set((s) => ({
          notificationSettings: { ...s.notificationSettings, ...settings },
        })),
    }),
    {
      name: "target-tracking-v1",
      storage: createJSONStorage(() => ({
        getItem: (k) => localStorage.getItem(k),
        setItem: (k, v) => {
          try {
            localStorage.setItem(k, v);
          } catch {
            // During SSR/tests there is no browser storage; avoid a recursive
            // state update while still surfacing real browser quota failures.
            if (typeof window !== "undefined" && !storageErrorReported) {
              storageErrorReported = true;
              queueMicrotask(() =>
                useStore.setState({
                  storageError:
                    "瀏覽器無法儲存資料。請立即匯出備份；重新整理可能遺失本次變更。",
                }),
              );
            }
          }
        },
        removeItem: (k) => localStorage.removeItem(k),
      })),
      skipHydration: true,
      partialize: (s) => ({
        version: s.version,
        goals: s.goals,
        checkIns: s.checkIns,
        initialized: s.initialized,
        language: s.language,
        notificationSettings: s.notificationSettings,
        goalStatusFilter: s.goalStatusFilter,
      }),
      merge: (saved, current) => {
        const s = saved as Partial<State>;
        if (!s?.initialized) return current;
        const result = backupSchema.safeParse(s);
        if (!result.success)
          return {
            ...current,
            initialized: true,
            storageError: "本機資料格式無效，請匯入有效備份或重設。",
          };
        const language =
          s.language === "zh-Hant" ||
          s.language === "zh-Hans" ||
          s.language === "en"
            ? s.language
            : current.language;
        const goalStatusFilter =
          s.goalStatusFilter === "all" ||
          goalStatusSchema.safeParse(s.goalStatusFilter).success
            ? (s.goalStatusFilter as GoalStatusFilter)
            : current.goalStatusFilter;
        return {
          ...current,
          ...result.data,
          language,
          goalStatusFilter,
          notificationSettings:
            result.data.notificationSettings ?? current.notificationSettings,
          initialized: true,
        };
      },
    },
  ),
);
