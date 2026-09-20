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
  remove: (id: string) => void;
  check: (r: CheckIn) => void;
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
          initialized: true,
          language: parsed.language ?? get().language,
          notificationSettings:
            parsed.notificationSettings ?? get().notificationSettings,
        });
      },
      save: (g) =>
        set((s) => ({
          goals: s.goals.some((x) => x.id === g.id)
            ? s.goals.map((x) => (x.id === g.id ? g : x))
            : [...s.goals, g],
        })),
      remove: (id) =>
        set((s) => ({
          goals: s.goals.filter((g) => g.id !== id),
          checkIns: s.checkIns.filter((r) => r.goalId !== id),
        })),
      check: (r) => {
        const g = get().goals.find((g) => g.id === r.goalId);
        if (!g || r.date !== day() || !scheduled(g, r.date)) return;
        const exists = get().checkIns.some(
          (x) => x.goalId === r.goalId && x.date === r.date,
        );
        if (!exists && metrics(g, get().checkIns).status !== "active") return;
        set((s) => ({
          checkIns: [
            ...s.checkIns.filter(
              (x) => !(x.goalId === r.goalId && x.date === r.date),
            ),
            r,
          ],
        }));
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
