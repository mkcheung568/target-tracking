"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ThemeProvider,
  createTheme,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Alert,
  Snackbar,
  Switch,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Popover,
} from "@mui/material";
import {
  LayoutDashboard,
  Target,
  History,
  ChartNoAxesCombined,
  Settings,
  Plus,
  ArrowUpRight,
  Check,
  Minus,
  X,
  Flame,
  Gift,
  ArrowLeft,
  Download,
  Upload,
  Leaf,
  Info,
  Dumbbell,
  BookOpen,
  Brain,
  Heart,
  Star,
  Sprout,
  CalendarDays,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { useForm, Controller, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format, parseISO } from "date-fns";
import {
  Goal,
  CheckIn,
  day,
  dates,
  metrics,
  scheduled,
  scheduledDayCount,
  goalSchema,
  backupSchema,
  demo,
  scoreOf,
} from "@/lib/domain";
import { GoalStatusFilter, useStore } from "@/lib/store";
import { Language, t } from "@/lib/i18n";
const theme = createTheme({
  palette: {
    primary: { main: "#5356d9" },
    success: { main: "#059669" },
    error: { main: "#e44868" },
  },
  typography: {
    fontFamily: 'Arial, "PingFang TC", sans-serif',
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
  },
});
const nav = [
  ["/", "Today", LayoutDashboard],
  ["/goals", "Goals", Target],
  ["/history", "History", History],
  ["/analytics", "Analytics", ChartNoAxesCombined],
  ["/settings", "Settings", Settings],
] as const;
const goalIconChoices: {
  value: Goal["icon"];
  label: string;
  Icon: LucideIcon;
}[] = [
  { value: "target", label: "Target", Icon: Target },
  { value: "dumbbell", label: "Dumbbell", Icon: Dumbbell },
  { value: "book", label: "Book", Icon: BookOpen },
  { value: "brain", label: "Brain", Icon: Brain },
  { value: "heart", label: "Heart", Icon: Heart },
  { value: "star", label: "Star", Icon: Star },
  { value: "sprout", label: "Sprout", Icon: Sprout },
  { value: "calendar", label: "Calendar", Icon: CalendarDays },
];
const goalColors: {
  value: Goal["color"];
  label: string;
  hex: string;
  tint: string;
}[] = [
  { value: "indigo", label: "Indigo", hex: "#5b5ce2", tint: "#eeefff" },
  { value: "teal", label: "Teal", hex: "#119b8b", tint: "#e3f6f3" },
  { value: "emerald", label: "Emerald", hex: "#249565", tint: "#e6f5ed" },
  { value: "amber", label: "Amber", hex: "#c98a1a", tint: "#fff4dc" },
  { value: "orange", label: "Orange", hex: "#d96a32", tint: "#fff0e8" },
  { value: "rose", label: "Rose", hex: "#d95771", tint: "#ffebf0" },
  { value: "sky", label: "Sky", hex: "#368bd5", tint: "#e7f3ff" },
  { value: "violet", label: "Violet", hex: "#8a5bd9", tint: "#f1eafe" },
];
const appearanceStyle = (goal: Pick<Goal, "color">): CSSProperties => {
  const color = goalColors.find((choice) => choice.value === goal.color) ??
    goalColors[0];
  return {
    "--goal-color": color.hex,
    "--goal-tint": color.tint,
  } as CSSProperties;
};
const GoalGlyph = ({ icon, size = 21 }: { icon: Goal["icon"]; size?: number }) => {
  const Icon = goalIconChoices.find((choice) => choice.value === icon)?.Icon ?? Target;
  return <Icon size={size} aria-hidden="true" />;
};
const resultText = (language: Language, result: CheckIn["result"]) =>
  t(
    language,
    result === "completed"
      ? "已完成"
      : result === "failed"
        ? "未完成"
        : "已略過",
  );
const statusText = (language: Language, status: string) =>
  t(
    language,
    {
      draft: "草稿",
      active: "進行中",
      paused: "已暫停",
      completed: "已完成",
      expired: "已到期",
      abandoned: "已放棄",
    }[status] ?? status,
  );
const statusOptions = [
  "draft",
  "active",
  "paused",
  "completed",
  "expired",
  "abandoned",
] as const;
const validationText = (language: Language, message: string) => {
  const translated: Record<string, Record<Language, string>> = {
    請輸入目標名稱: {
      "zh-Hant": "請輸入目標名稱",
      "zh-Hans": "请输入目标名称",
      en: "Enter a goal name",
    },
    日期無效: {
      "zh-Hant": "日期無效",
      "zh-Hans": "日期无效",
      en: "Invalid date",
    },
    結束日期不能早於開始日期: {
      "zh-Hant": "結束日期不能早於開始日期",
      "zh-Hans": "结束日期不能早于开始日期",
      en: "End date must be on or after the start date",
    },
    "目標期間最多 10 年": {
      "zh-Hant": "目標期間最多 10 年",
      "zh-Hans": "目标期间最多 10 年",
      en: "A goal can run for up to 10 years",
    },
    "Weekly 請選一天；Custom 請至少選一天": {
      "zh-Hant": "Weekly 請選一天；Custom 請至少選一天",
      "zh-Hans": "Weekly 请选一天；Custom 请至少选一天",
      en: "Choose one day for Weekly, or at least one for Custom",
    },
    日期範圍內沒有排程日: {
      "zh-Hant": "日期範圍內沒有排程日",
      "zh-Hans": "日期范围内没有排程日",
      en: "This date range has no scheduled days",
    },
    請輸入有效目標分數: {
      "zh-Hant": "請輸入有效目標分數",
      "zh-Hans": "请输入有效目标分数",
      en: "Enter a valid target score",
    },
    請輸入有效目標完成率: {
      "zh-Hant": "請輸入有效目標完成率",
      "zh-Hans": "请输入有效目标完成率",
      en: "Enter a valid target completion rate",
    },
  };
  return translated[message]?.[language] ?? message;
};
const healthText = (language: Language, health: string) => t(language, health);
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
function Liquid({
  score,
  target,
  language,
}: {
  score: number;
  target: number;
  language: Language;
}) {
  const min = 0 - Math.max(target, Math.abs(score));
  return (
    <div className="liquid-wrap">
      <div
        className="liquid"
        role="meter"
        aria-label={t(language, "Net Score")}
        aria-valuemin={min}
        aria-valuemax={Math.max(target, Math.abs(score))}
        aria-valuenow={score}
      >
        <motion.div
          initial={false}
          animate={{ width: `${Math.min(1, Math.abs(score) / target) * 50}%` }}
          className={`water ${score < 0 ? "negative" : "positive"}`}
          style={score < 0 ? { right: "50%" } : { left: "50%" }}
        />
        <i />
      </div>
      <div className="scale">
        <span>−{target}</span>
        <span>0</span>
        <span>+{target}</span>
      </div>
    </div>
  );
}
function Stats({ items }: { items: [string, string, string?][] }) {
  return (
    <div className="stats">
      {items.map(([label, value, hint]) => (
        <div className="stat" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          {hint && <small>{hint}</small>}
        </div>
      ))}
    </div>
  );
}
function Trends({
  records,
  range,
  start,
  language,
}: {
  records: CheckIn[];
  range: number;
  start?: string;
  language: Language;
}) {
  const end = day(),
    from = range === 0 ? start || end : day(addDays(new Date(), 1 - range));
  const data = dates(from > end ? end : from, end).map((date) => {
    const rs = records.filter((r) => r.date === date);
    return {
      date: format(parseISO(date), "M/d"),
      score: rs.reduce((a, r) => a + scoreOf(r), 0),
      completed: rs.filter((r) => r.result === "completed").length,
    };
  });
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="4 5"
            vertical={false}
            stroke="#eceef4"
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={35}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={30}
          />
          <Tooltip />
          <Area
            name={t(language, "每日淨分數")}
            type="monotone"
            dataKey="score"
            stroke="#6366f1"
            fill="url(#scoreFill)"
            strokeWidth={2.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
function GoalForm({
  goal,
  onClose,
  language,
}: {
  goal: Goal | null;
  onClose: () => void;
  language: Language;
}) {
  const save = useStore((s) => s.save);
  const records = useStore((s) => s.checkIns);
  const [error, setError] = useState(""),
    [closeConfirm, setCloseConfirm] = useState(false),
    [hasUnsavedChanges, setHasUnsavedChanges] = useState(false),
    [info, setInfo] = useState<{
      type: "score" | "rate";
      anchor: HTMLElement;
    } | null>(null);
  const unsavedRef = useRef(false),
    scheduleInitializedRef = useRef(false);
  const defaultValues = useMemo(
    () =>
      goal || {
        id: crypto.randomUUID(),
        name: "",
        description: "",
        icon: "target" as const,
        color: "indigo" as const,
        startDate: day(),
        endDate: "",
        frequency: "daily" as const,
        days: [1],
        targetScore: Number.NaN,
        targetRate: 100,
        reward: "",
        status: "active" as const,
        redeemedAt: null,
      },
    [goal],
  );
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Goal>({
    resolver: zodResolver(goalSchema) as Resolver<Goal>,
    defaultValues,
  });
  const startDate = useWatch({ control, name: "startDate" }),
    endDate = useWatch({ control, name: "endDate" }),
    frequency = useWatch({ control, name: "frequency" }),
    watchedDays = useWatch({ control, name: "days" });
  const selected = useMemo(() => watchedDays ?? [], [watchedDays]);
  const automaticTargetScore = useMemo(
    () =>
      scheduledDayCount({
        startDate,
        endDate,
        frequency,
        days: selected,
      }),
    [endDate, frequency, selected, startDate],
  );
  useEffect(() => {
    if (!scheduleInitializedRef.current) {
      scheduleInitializedRef.current = true;
      return;
    }
    setValue(
      "targetScore",
      automaticTargetScore > 0 ? automaticTargetScore : Number.NaN,
      { shouldDirty: true, shouldValidate: false },
    );
  }, [automaticTargetScore, setValue]);
  const markUnsaved = () => {
    unsavedRef.current = true;
    setHasUnsavedChanges(true);
  };
  const field = (name: keyof Goal, label: string, type = "text") => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <TextField
          {...field}
          value={
            type === "number" &&
            typeof field.value === "number" &&
            Number.isNaN(field.value)
              ? ""
              : (field.value ?? "")
          }
          label={label}
          type={type}
          slotProps={{ inputLabel: { shrink: true } }}
          onInput={markUnsaved}
          onChange={(e) => {
            markUnsaved();
            field.onChange(
              type === "number"
                ? e.target.value === ""
                  ? Number.NaN
                  : Number(e.target.value)
                : e.target.value,
            );
          }}
          error={!!errors[name]}
          helperText={
            validationText(language, String(errors[name]?.message ?? "")) ||
            undefined
          }
        />
      )}
    />
  );
  const numberField = (
    name: "targetScore" | "targetRate",
    label: string,
    infoType: "score" | "rate",
  ) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <TextField
          {...field}
          value={Number.isNaN(field.value) ? "" : field.value}
          label={label}
          type="number"
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              min: 1,
              max: name === "targetRate" ? 100 : 10000,
            },
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    type="button"
                    size="small"
                    aria-label={
                      infoType === "score"
                        ? t(language, "目標分數說明")
                        : t(language, "目標完成率說明")
                    }
                    onClick={(event) =>
                      setInfo({ type: infoType, anchor: event.currentTarget })
                    }
                  >
                    <Info size={17} />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
          onChange={(event) => {
            markUnsaved();
            field.onChange(
              event.target.value === ""
                ? Number.NaN
                : Number(event.target.value),
            );
          }}
          error={!!errors[name]}
          helperText={
            validationText(language, String(errors[name]?.message ?? "")) ||
            undefined
          }
        />
      )}
    />
  );
  const tx = (key: string, values?: Record<string, string | number>) =>
    t(language, key, values);
  const appearancePicker = () => (
    <div className="appearance-picker">
      <p className="appearance-label">{tx("Appearance")}</p>
      <div>
        <span className="appearance-label">{tx("Icon")}</span>
        <Controller
          name="icon"
          control={control}
          render={({ field }) => (
            <div
              className="icon-choice-grid"
              role="group"
              aria-label={tx("Choose a goal icon")}
            >
              {goalIconChoices.map(({ value, label, Icon }) => (
                <IconButton
                  key={value}
                  type="button"
                  className={
                    field.value === value
                      ? "appearance-option selected"
                      : "appearance-option"
                  }
                  aria-label={tx(label)}
                  aria-pressed={field.value === value}
                  onClick={() => {
                    markUnsaved();
                    field.onChange(value);
                  }}
                >
                  <Icon size={19} />
                </IconButton>
              ))}
            </div>
          )}
        />
      </div>
      <div>
        <span className="appearance-label">{tx("Color")}</span>
        <Controller
          name="color"
          control={control}
          render={({ field }) => (
            <div
              className="color-choice-grid"
              role="group"
              aria-label={tx("Choose a goal color")}
            >
              {goalColors.map(({ value, label, hex }) => (
                <button
                  key={value}
                  type="button"
                  className={
                    field.value === value
                      ? "color-choice selected"
                      : "color-choice"
                  }
                  style={{ "--swatch-color": hex } as CSSProperties}
                  aria-label={`${tx("Color")}: ${tx(label)}`}
                  aria-pressed={field.value === value}
                  onClick={() => {
                    markUnsaved();
                    field.onChange(value);
                  }}
                />
              ))}
            </div>
          )}
        />
      </div>
    </div>
  );
  const submitGoal = (g: Goal) => {
    if (records.some((r) => r.goalId === g.id && !scheduled(g, r.date))) {
      setError("新排程會排除已有打卡。請保留已有記錄的日期與星期。");
      return;
    }
    save(g);
    onClose();
  };
  const requestClose = () => {
    if (unsavedRef.current || hasUnsavedChanges) {
      setCloseConfirm(true);
      return;
    }
    onClose();
  };
  return (
    <>
      <Dialog
        open
        onClose={(_, reason) => {
          if (reason === "backdropClick" || reason === "escapeKeyDown")
            requestClose();
        }}
        fullWidth
        maxWidth="sm"
      >
      <form
        onSubmit={handleSubmit(submitGoal)}
        onInput={markUnsaved}
        onChange={markUnsaved}
      >
        <DialogTitle>
          {goal ? tx("編輯目標") : tx("為自己訂一個目標")}
        </DialogTitle>
        <DialogContent>
          <div className="form-grid">
            {error && (
              <Alert severity="error">
                {tx("新排程會排除已有打卡。請保留已有記錄的日期與星期。")}
              </Alert>
            )}
            {field("name", tx("目標名稱"))}
            {field("description", tx("描述／成功行動"))}
            {appearancePicker()}
            <div className="two">
              {field("startDate", tx("開始日期"), "date")}
              {field("endDate", tx("結束日期"), "date")}
            </div>
            <Controller
              name="frequency"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label={tx("頻率")}
                  onChange={(e) => {
                    markUnsaved();
                    field.onChange(e);
                    if (e.target.value === "weekly")
                      setValue("days", [selected[0] ?? 1], {
                        shouldDirty: true,
                      });
                  }}
                >
                  <MenuItem value="daily">{tx("Daily")}</MenuItem>
                  <MenuItem value="weekly">{tx("Weekly")}</MenuItem>
                  <MenuItem value="custom">{tx("Custom")}</MenuItem>
                </TextField>
              )}
            />
            {frequency !== "daily" && (
              <div>
                <div className="weekdays">
                  {(language === "en"
                    ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
                    : ["日", "一", "二", "三", "四", "五", "六"]
                  ).map((v, i) => (
                    <Button
                      key={v}
                      type="button"
                      variant={selected.includes(i) ? "contained" : "outlined"}
                      onClick={() => {
                        markUnsaved();
                        setValue(
                          "days",
                          frequency === "weekly"
                            ? [i]
                            : selected.includes(i)
                              ? selected.filter((d) => d !== i)
                              : [...selected, i],
                          { shouldDirty: true },
                        );
                      }}
                    >
                      {v}
                    </Button>
                  ))}
                </div>
                {errors.days && (
                  <p className="error">
                    {validationText(language, String(errors.days.message))}
                  </p>
                )}
              </div>
            )}
            <div className="two">
              {numberField("targetScore", tx("Target score"), "score")}
              {numberField("targetRate", tx("目標完成率 %"), "rate")}
            </div>
            {field("reward", tx("完成後的小獎勵"))}
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label={tx("狀態")}
                  onChange={(e) => {
                    markUnsaved();
                    field.onChange(e);
                  }}
                >
                  {(goal
                    ? ["draft", "active", "paused", "abandoned"]
                    : ["draft", "active"]
                  ).map((s) => (
                    <MenuItem key={s} value={s}>
                      {statusText(language, s)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <small>
              {tx("分數與完成率均達標後自動完成。到期未達標則顯示已到期。")}
            </small>
            <Popover
              open={info !== null}
              anchorEl={info?.anchor ?? null}
              onClose={() => setInfo(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              <p className="metric-info">
                {info?.type === "score"
                  ? tx("目標分數解釋")
                  : tx("目標完成率解釋")}
              </p>
            </Popover>
          </div>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={requestClose}>
            {tx("取消")}
          </Button>
          <Button type="submit" variant="contained">
            {tx("儲存目標")}
          </Button>
        </DialogActions>
      </form>
      </Dialog>
      <Dialog
        open={closeConfirm}
        onClose={() => setCloseConfirm(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{tx("未儲存變更")}</DialogTitle>
        <DialogContent>{tx("你有尚未儲存的目標內容，要儲存後離開嗎？")}</DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseConfirm(false)}>
            {tx("繼續編輯")}
          </Button>
          <Button
            color="error"
            onClick={() => {
              setCloseConfirm(false);
              onClose();
            }}
          >
            {tx("放棄變更")}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setCloseConfirm(false);
              void handleSubmit(submitGoal)();
            }}
          >
            {tx("儲存並離開")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
type SortableHandle = Pick<
  ReturnType<typeof useSortable>,
  "attributes" | "listeners" | "setActivatorNodeRef"
>;

function SortableGoalCard({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: (handle: SortableHandle) => ReactNode;
}) {
  const sortable = useSortable({ id, disabled });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    zIndex: sortable.isDragging ? 2 : undefined,
  };
  return (
    <div
      ref={sortable.setNodeRef}
      className={`sortable-goal${sortable.isDragging ? " is-dragging" : ""}`}
      style={style}
    >
      {children({
        attributes: sortable.attributes,
        listeners: sortable.listeners,
        setActivatorNodeRef: sortable.setActivatorNodeRef,
      })}
    </div>
  );
}

export default function Workspace() {
  const path = usePathname();
  return <WorkspaceView key={path} />;
}
function WorkspaceView() {
  const store = useStore();
  const language = store.language;
  const tx = (key: string, values?: Record<string, string | number>) =>
    t(language, key, values);
  const [ready, setReady] = useState(false),
    [form, setForm] = useState<Goal | null | undefined>(),
    [range, setRange] = useState(7),
    [search, setSearch] = useState(""),
    [recordFilter, setRecordFilter] = useState("all"),
    [arrangingGoals, setArrangingGoals] = useState(false),
    [message, setMessage] = useState(""),
    [noteGoal, setNoteGoal] = useState<Goal | null>(null),
    [note, setNote] = useState(""),
    [confirm, setConfirm] = useState<{ text: string; run: () => void } | null>(
      null,
    );
  const path = usePathname(),
    router = useRouter();
  const dragSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [, tick] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.resolve(useStore.persist.rehydrate()).then(() => {
      if (!useStore.getState().initialized) useStore.getState().replace(demo());
      if (live) setReady(true);
    });
    const timer = setInterval(() => tick((x) => x + 1), 30000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  const today = day(),
    detailId = path.startsWith("/goals/")
      ? decodeURIComponent(path.split("/")[2])
      : null,
    goal = store.goals.find((g) => g.id === detailId),
    page = detailId ? "detail" : path.split("/")[1] || "today";
  const ms = store.goals.map((g) => ({ g, m: metrics(g, store.checkIns) }));
  const visibleGoals = ms.filter(
    ({ g, m }) =>
      g.name.toLowerCase().includes(search.toLowerCase()) &&
      (store.goalStatusFilter === "all" ||
        m.status === store.goalStatusFilter),
  );
  const visibleGoalIds = visibleGoals.map(({ g }) => g.id);
  useEffect(() => {
    if (arrangingGoals && visibleGoalIds.length < 2) setArrangingGoals(false);
  }, [arrangingGoals, visibleGoalIds.length]);
  const goalName = (id: string | number) =>
    store.goals.find((candidate) => candidate.id === String(id))?.name ??
    tx("目標");
  const dragAnnouncements: Announcements = {
    onDragStart: ({ active }) =>
      tx("Picked up {goal}.", { goal: goalName(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? tx("{goal} is over {target}.", {
            goal: goalName(active.id),
            target: goalName(over.id),
          })
        : tx("{goal} is no longer over a drop target.", {
            goal: goalName(active.id),
          }),
    onDragEnd: ({ active, over }) =>
      over
        ? tx("Moved {goal} to {target}.", {
            goal: goalName(active.id),
            target: goalName(over.id),
          })
        : tx("Move cancelled for {goal}.", { goal: goalName(active.id) }),
    onDragCancel: ({ active }) =>
      tx("Move cancelled for {goal}.", { goal: goalName(active.id) }),
  };
  const handleGoalDragEnd = ({ active, over }: DragEndEvent) => {
    if (!arrangingGoals || !over || active.id === over.id) return;
    store.reorderGoal(String(active.id), String(over.id));
  };
  const notificationSettings = store.notificationSettings;
  const notificationPermission: NotificationPermission | "unsupported" =
    typeof window === "undefined" || !("Notification" in window)
      ? "unsupported"
      : Notification.permission;
  useEffect(() => {
    if (
      !ready ||
      !notificationSettings.enabled ||
      !notificationSettings.checkInReminders
    )
      return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const notifyIfDue = () => {
      const current = useStore.getState();
      const settings = current.notificationSettings;
      const now = new Date();
      const todayDate = day(now);
      if (
        format(now, "HH:mm") !== settings.time ||
        settings.lastSentDate === todayDate ||
        Notification.permission !== "granted"
      )
        return;
      const pending = current.goals.filter((g) => {
        const m = metrics(g, current.checkIns, todayDate);
        return (
          g.status === "active" &&
          m.status === "active" &&
          scheduled(g, todayDate) &&
          !current.checkIns.some(
            (r) => r.goalId === g.id && r.date === todayDate,
          )
        );
      });
      if (!pending.length) return;
      new Notification(t(current.language, "目標提醒"), {
        body:
          t(current.language, "今天有 {count} 個目標待打卡", {
            count: pending.length,
          }) + "\n" + pending.map((g) => g.name).join("、"),
        tag: `target-tracking-${todayDate}`,
      });
      current.setNotificationSettings({ lastSentDate: todayDate });
    };
    notifyIfDue();
    const timer = window.setInterval(notifyIfDue, 30000);
    return () => window.clearInterval(timer);
  }, [
    ready,
    notificationSettings.enabled,
    notificationSettings.checkInReminders,
    notificationSettings.time,
    notificationSettings.lastSentDate,
  ]);
  const todays = ms.filter(
    ({ g, m }) =>
      scheduled(g, today) &&
      (m.status === "active" ||
        store.checkIns.some((r) => r.goalId === g.id && r.date === today)),
  );
  const todayRecords = store.checkIns.filter(
    (r) => r.date === today && todays.some((x) => x.g.id === r.goalId),
  );
  const allScore = store.checkIns.reduce((a, r) => a + scoreOf(r), 0);
  const requestNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setMessage(tx("此瀏覽器不支援通知"));
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      store.setNotificationSettings({ enabled: true });
      setMessage(tx("通知已開啟"));
    } else {
      setMessage(
        permission === "denied"
          ? tx("通知權限被拒絕")
          : tx("通知未開啟"),
      );
    }
  };
  const sendTestNotification = () => {
    if (notificationPermission !== "granted") {
      void requestNotifications();
      return;
    }
    new Notification(tx("目標提醒"), {
      body: tx("這是 Target Tracking 的測試通知"),
      tag: "target-tracking-test",
    });
    setMessage(tx("通知已開啟"));
  };
  const check = (g: Goal, result: CheckIn["result"]) => {
    const old = store.checkIns.find(
      (r) => r.goalId === g.id && r.date === today,
    );
    store.check({
      goalId: g.id,
      date: today,
      result,
      note: old?.note || "",
      updatedAt: new Date().toISOString(),
    });
    setMessage(old ? tx("已更新今天的打卡") : tx("已記錄，今天又前進了一步"));
  };
  const actions = (g: Goal) => {
    const current = store.checkIns.find(
      (r) => r.goalId === g.id && r.date === today,
    );
    return (
      <div className="check-actions">
        {(["failed", "skipped", "completed"] as const).map((r) => (
          <Button
            key={r}
            color={
              r === "completed"
                ? "success"
                : r === "failed"
                  ? "error"
                  : "inherit"
            }
            variant={current?.result === r ? "contained" : "outlined"}
            startIcon={
              r === "completed" ? (
                <Check size={15} />
              ) : r === "failed" ? (
                <X size={15} />
              ) : (
                <Minus size={15} />
              )
            }
            onClick={() => check(g, r)}
          >
            {r === "completed"
              ? tx("完成 +1")
              : r === "failed"
                ? tx("未完成 −1")
                : tx("略過")}
          </Button>
        ))}
        {current && (
          <button
            className="text-button"
            onClick={() => {
              setNoteGoal(g);
              setNote(current.note);
            }}
          >
            {tx("備註")}
          </button>
        )}
      </div>
    );
  };
  const card = (
    g: Goal,
    quick = false,
    arranging = false,
    sortable?: SortableHandle,
  ) => {
    const m = metrics(g, store.checkIns);
    const position = store.goals.findIndex((goal) => goal.id === g.id);
    const visiblePosition = visibleGoalIds.indexOf(g.id);
    const previousVisibleId = visibleGoalIds[visiblePosition - 1];
    const nextVisibleId = visibleGoalIds[visiblePosition + 1];
    return (
      <motion.article layout className="goal-card" key={g.id}>
        <div className="card-top">
          <div className="goal-icon" style={appearanceStyle(g)}>
            <GoalGlyph icon={g.icon} />
          </div>
          {arranging ? (
            <div className="reorder-controls">
              <IconButton
                ref={sortable?.setActivatorNodeRef}
                type="button"
                size="small"
                className="drag-handle"
                {...(sortable?.attributes ?? {})}
                {...(sortable?.listeners ?? {})}
                aria-label={tx("Drag to reorder")}
                title={tx("Drag to reorder")}
              >
                <GripVertical size={18} />
              </IconButton>
              <span>
                {position + 1} / {store.goals.length}
              </span>
              <IconButton
                type="button"
                size="small"
                aria-label={tx("Move earlier")}
                disabled={!previousVisibleId}
                onClick={() =>
                  previousVisibleId &&
                  store.reorderGoal(g.id, previousVisibleId)
                }
              >
                <ChevronLeft size={18} />
              </IconButton>
              <IconButton
                type="button"
                size="small"
                aria-label={tx("Move later")}
                disabled={!nextVisibleId}
                onClick={() =>
                  nextVisibleId && store.reorderGoal(g.id, nextVisibleId)
                }
              >
                <ChevronRight size={18} />
              </IconButton>
            </div>
          ) : (
            <Chip
              size="small"
              label={healthText(language, m.health)}
              className={m.health === "At Risk" ? "risk" : "health"}
            />
          )}
        </div>
        <Link href={`/goals/${g.id}`} className="goal-link">
          {g.name}
          <ArrowUpRight size={18} />
        </Link>
        <p>{g.description}</p>
        <div className="mini-metrics">
          <div>
            <small>{tx("Net Score")}</small>
            <strong className={m.score < 0 ? "red" : "green"}>
              {signed(m.score)}
              <em> / {g.targetScore}</em>
            </strong>
          </div>
          <div>
            <small>{tx("完成率")}</small>
            <strong>
              {Math.round(m.rate)}
              <em>%</em>
            </strong>
          </div>
          <div>
            <small>{tx("Streak")}</small>
            <strong>
              <Flame size={16} />
              {m.streak}
            </strong>
          </div>
        </div>
        <Liquid score={m.score} target={g.targetScore} language={language} />
        <div className="card-meta">
          <span>
            {statusText(language, m.status)} ·{" "}
            {g.frequency === "daily"
              ? tx("Daily")
              : g.frequency === "weekly"
                ? tx("Weekly")
                : tx("Custom")}
          </span>
          <span>
            {format(parseISO(g.endDate), "M/d")}{" "}
            {language === "en"
              ? "due"
              : language === "zh-Hans"
                ? "截止"
                : "截止"}
          </span>
        </div>
        {quick ? (
          actions(g)
        ) : (
          <div className="reward-line">
            <Gift size={15} />
            {g.reward || tx("尚未設定獎勵")}
          </div>
        )}
      </motion.article>
    );
  };
  const history = (records: CheckIn[]) => {
    const rows = [...records].sort((a, b) => b.date.localeCompare(a.date));
    return rows.length ? (
      <div className="history">
        <div className="history-head">
          <span>
            {language === "en"
              ? "Date"
              : language === "zh-Hans"
                ? "日期"
                : "日期"}
          </span>
          <span>{tx("目標")}</span>
          <span>
            {language === "en"
              ? "Result"
              : language === "zh-Hans"
                ? "结果"
                : "結果"}
          </span>
          <span>
            {language === "en"
              ? "Score"
              : language === "zh-Hans"
                ? "分数"
                : "分數"}
          </span>
          <span>{tx("備註")}</span>
        </div>
        {rows.map((r) => (
          <div className="history-row" key={r.goalId + r.date}>
            <span>
              {r.date}
              <small>
                {format(parseISO(r.updatedAt), "HH:mm")}{" "}
                {language === "en"
                  ? "updated"
                  : language === "zh-Hans"
                    ? "更新"
                    : "更新"}
              </small>
            </span>
            <Link href={`/goals/${r.goalId}`}>
              {store.goals.find((g) => g.id === r.goalId)?.name}
            </Link>
            <span className={`result ${r.result}`}>
              {resultText(language, r.result)}
            </span>
            <span>{signed(scoreOf(r))}</span>
            <span className="history-note">{r.note || tx("—")}</span>
          </div>
        ))}
      </div>
    ) : (
      <div className="empty">{tx("這段時間還沒有打卡記錄。")}</div>
    );
  };
  const rangeControl = (all = false) => (
    <div className="segments">
      {(all ? [7, 30, 0] : [7, 30]).map((v) => (
        <button
          key={v}
          className={range === v ? "selected" : ""}
          onClick={() => setRange(v)}
        >
          {v
            ? `${v} ${language === "en" ? "days" : language === "zh-Hans" ? "天" : "日"}`
            : language === "en"
              ? "All"
              : language === "zh-Hans"
                ? "全部"
                : "全部"}
        </button>
      ))}
    </div>
  );
  const visibleRecords = store.checkIns.filter(
    (r) =>
      (!store.goals.some((g) => g.id === recordFilter) ||
        r.goalId === recordFilter) &&
      (!search ||
        (store.goals.find((g) => g.id === r.goalId)?.name + " " + r.note)
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  return (
    <ThemeProvider theme={theme}>
      <div className="app-shell">
        <aside className="sidebar">
          <Link href="/" className="brand">
            <span>
              <Target size={24} />
            </span>
            target<span className="brand-light">tracking</span>
          </Link>
          <nav>
            {nav.map(([url, label, Icon]) => (
              <Link
                key={url}
                href={url}
                className={
                  (url === "/" ? page === "today" : path.startsWith(url))
                    ? "active"
                    : ""
                }
              >
                <Icon size={20} />
                <span>{tx(label)}</span>
              </Link>
            ))}
          </nav>
          <div className="sidebar-foot">
            <Leaf size={20} />
            <p>
              {language === "en"
                ? "Go at your own pace."
                : language === "zh-Hans"
                  ? "照自己的节奏。"
                  : "照自己的節奏。"}
              <br />
              <small>{tx("每一小步，都算數。")}</small>
            </p>
            <span className="local-badge">● {tx("本機儲存")}</span>
          </div>
        </aside>
        <main>
          <header className="topbar">
            <span>
              {page === "detail"
                ? tx("Goal detail")
                : tx(nav.find((n) => n[0] === path)?.[1] || "Today")}
            </span>
          </header>
          {!ready ? (
            <div className="empty">
              {language === "en"
                ? "Loading your goals…"
                : language === "zh-Hans"
                  ? "正在加载你的目标…"
                  : "正在載入你的目標…"}
            </div>
          ) : (
            <div className="content">
              {store.storageError && (
                <Alert severity="error">{tx(store.storageError)}</Alert>
              )}
              {page === "today" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        {language === "en"
                          ? format(new Date(), "EEEE, MMMM d")
                          : format(new Date(), "yyyy年M月d日")}
                      </div>
                      <h1>{tx("把今天，過得更靠近目標。")}</h1>
                      <p>{tx("不求一次到位，只要持續前進。")}</p>
                    </div>
                    <Button
                      variant="contained"
                      startIcon={<Plus size={18} />}
                      onClick={() => setForm(null)}
                    >
                      {tx("新增目標")}
                    </Button>
                  </div>
                  <Stats
                    items={[
                      [
                        tx("今日目標"),
                        String(todays.length),
                        tx("今天值得投入的小事"),
                      ],
                      [
                        tx("今日已完成"),
                        `${todayRecords.filter((r) => r.result === "completed").length} / ${todays.length}`,
                        tx("完成數 / 排定目標"),
                      ],
                      [
                        tx("Net Score"),
                        signed(allScore),
                        tx("所有目標累積淨分數"),
                      ],
                      [
                        tx("Best Streak"),
                        `${Math.max(0, ...ms.map((x) => x.m.best))} ${language === "en" ? "days" : "次"}`,
                        tx("連續完成的排程日"),
                      ],
                    ]}
                  />
                  <div className="section-title">
                    <h2>
                      {tx("今天的目標")} <span>{todays.length}</span>
                    </h2>
                    <Link href="/goals">
                      {tx("查看全部")} <ArrowUpRight size={16} />
                    </Link>
                  </div>
                  <div className="goal-grid">
                    {todays.map(({ g }) => card(g, true))}
                  </div>
                  {!todays.length && (
                    <div className="panel empty">
                      {tx("今天沒有待打卡的目標。新增目標，或享受休息時間。")}
                    </div>
                  )}
                  <div className="dashboard-bottom">
                    <section className="panel">
                      <div className="section-title">
                        <div>
                          <h2>{tx("一步步累積的進展")}</h2>
                          <p>
                            {tx("最近 7 天")} · {tx("每日淨分數")}
                          </p>
                        </div>
                        <Link href="/analytics">
                          <ArrowUpRight size={19} />
                        </Link>
                      </div>
                      <Trends
                        records={store.checkIns}
                        range={7}
                        language={language}
                      />
                    </section>
                    <section className="panel today-progress">
                      <div className="eyebrow">{tx("TODAY’S MOMENTUM")}</div>
                      <div
                        className="ring"
                        style={{
                          background: `conic-gradient(#6366f1 ${(todays.length ? todayRecords.filter((r) => r.result === "completed").length / todays.length : 0) * 100}%, #eef0f7 0)`,
                        }}
                      >
                        <div>
                          <strong>
                            {todays.length
                              ? Math.round(
                                  (todayRecords.filter(
                                    (r) => r.result === "completed",
                                  ).length /
                                    todays.length) *
                                    100,
                                )
                              : 0}
                            %
                          </strong>
                          <span>{tx("今日完成")}</span>
                        </div>
                      </div>
                      <h3>
                        {todayRecords.length
                          ? tx("你正在累積改變。")
                          : tx("從一個小行動開始。")}
                      </h3>
                      <p>
                        {todays.length - todayRecords.length}
                        {language === "en"
                          ? tx("個目標尚未記錄")
                          : ` ${tx("個目標尚未記錄")}`}
                      </p>
                    </section>
                  </div>
                </>
              )}
              {page === "goals" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        {tx("MAKE ROOM FOR WHAT MATTERS")}
                      </div>
                      <h1>
                        {language === "en"
                          ? "My goals"
                          : language === "zh-Hans"
                            ? "我的目标"
                            : "我的目標"}
                      </h1>
                      <p>
                        {language === "en"
                          ? "Turn intentions into actions, one step at a time."
                          : language === "zh-Hans"
                            ? "把想做的事，慢慢变成做到的事。"
                            : "把想做的事，慢慢變成做到的事。"}
                      </p>
                    </div>
                    <div className="heading-actions">
                      <Button
                        variant="outlined"
                        startIcon={<ArrowUpDown size={17} />}
                        disabled={visibleGoals.length < 2}
                        onClick={() => setArrangingGoals((value) => !value)}
                      >
                        {arrangingGoals ? tx("Done") : tx("Arrange")}
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<Plus size={18} />}
                        onClick={() => setForm(null)}
                      >
                        {tx("新增目標")}
                      </Button>
                    </div>
                  </div>
                  <div className="filters">
                    <TextField
                      label={
                        language === "en"
                          ? "Search goals"
                          : language === "zh-Hans"
                            ? "搜索目标"
                            : "搜尋目標"
                      }
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <TextField
                      select
                      label={tx("狀態")}
                      value={store.goalStatusFilter}
                      onChange={(e) =>
                        store.setGoalStatusFilter(
                          e.target.value as GoalStatusFilter,
                        )
                      }
                    >
                      <MenuItem value="all">
                        {language === "en" ? "All" : "全部"}
                      </MenuItem>
                      {statusOptions.map((k) => (
                        <MenuItem value={k} key={k}>
                          {statusText(language, k)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </div>
                  {arrangingGoals && (
                    <p className="arrange-note">
                      {tx(
                        "Drag cards with the handle or use the arrow buttons.",
                      )}
                    </p>
                  )}
                  <DndContext
                    sensors={dragSensors}
                    collisionDetection={closestCenter}
                    accessibility={{
                      announcements: dragAnnouncements,
                      screenReaderInstructions: {
                        draggable: tx(
                          "Press space to pick up a goal. Use the arrow keys to move it, then press space to drop it.",
                        ),
                      },
                    }}
                    onDragEnd={handleGoalDragEnd}
                  >
                    <SortableContext
                      items={visibleGoalIds}
                      strategy={rectSortingStrategy}
                    >
                      <div className="goal-grid">
                        {visibleGoals.map(({ g }) => (
                          <SortableGoalCard
                            id={g.id}
                            disabled={!arrangingGoals}
                            key={g.id}
                          >
                            {(sortable) =>
                              card(g, false, arrangingGoals, sortable)
                            }
                          </SortableGoalCard>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  {!visibleGoals.length && (
                    <div className="empty">
                      {language === "en"
                        ? "No goals match. Try adding a goal or changing the filter."
                        : language === "zh-Hans"
                          ? "没有符合的目标。试试新增目标或更改筛选。"
                          : "沒有符合的目標。試試新增目標或更改篩選。"}
                    </div>
                  )}
                </>
              )}
              {page === "detail" &&
                (goal ? (
                  (() => {
                    const m = metrics(goal, store.checkIns),
                      rs = store.checkIns.filter((r) => r.goalId === goal.id);
                    return (
                      <>
                        <Link href="/goals" className="back">
                          <ArrowLeft size={16} /> {tx("所有目標")}
                        </Link>
                        <div className="page-heading">
                          <div>
                            <div className="eyebrow">
                              {statusText(language, m.status)} ·{" "}
                              {healthText(language, m.health)}
                            </div>
                            <div className="goal-detail-title">
                              <div
                                className="goal-icon goal-icon-detail"
                                style={appearanceStyle(goal)}
                              >
                                <GoalGlyph icon={goal.icon} size={25} />
                              </div>
                              <h1>{goal.name}</h1>
                            </div>
                            <p>{goal.description}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outlined"
                              onClick={() => setForm(goal)}
                            >
                              {tx("編輯目標")}
                            </Button>
                            <Button
                              onClick={() =>
                                store.save({
                                  ...goal,
                                  status:
                                    goal.status === "paused"
                                      ? "active"
                                      : "paused",
                                })
                              }
                            >
                              {goal.status === "paused"
                                ? tx("繼續")
                                : tx("暫停")}
                            </Button>
                            <Button
                              color="error"
                              onClick={() =>
                                setConfirm({
                                  text: tx(
                                    "刪除此目標及所有打卡記錄？此操作無法復原。",
                                  ),
                                  run: () => {
                                    store.remove(goal.id);
                                    router.push("/goals");
                                  },
                                })
                              }
                            >
                              {tx("刪除")}
                            </Button>
                          </div>
                        </div>
                        <Stats
                          items={[
                            [
                              tx("Net Score"),
                              signed(m.score),
                              tx("目標 +{score}", { score: goal.targetScore }),
                            ],
                            [
                              tx("完成率"),
                              `${Math.round(m.rate)}%`,
                              tx("目標 {rate}%", { rate: goal.targetRate }),
                            ],
                            [
                              tx("Time Progress"),
                              `${Math.round(m.time)}%`,
                              `${goal.startDate} → ${goal.endDate}`,
                            ],
                            [
                              language === "en"
                                ? "Streak / Best"
                                : language === "zh-Hans"
                                  ? "连续 / 最佳"
                                  : "連續 / 最佳",
                              `${m.streak} / ${m.best}`,
                              tx("以排程日計算"),
                            ],
                          ]}
                        />
                        <section className="panel">
                          <div className="section-title">
                            <h2>{tx("目標進度")}</h2>
                            <Chip label={healthText(language, m.health)} />
                          </div>
                          <Liquid
                            score={m.score}
                            target={goal.targetScore}
                            language={language}
                          />
                          {scheduled(goal, today) &&
                            (m.status === "active" ||
                              rs.some((r) => r.date === today)) &&
                            actions(goal)}
                          <div className="reward-detail">
                            <Gift />
                            <div>
                              <strong>
                                {goal.reward || tx("尚未設定獎勵")}
                              </strong>
                              <p>
                                {m.rewardStatus === "redeemed"
                                  ? tx("Redeemed · 已領取")
                                  : m.rewardStatus === "unlocked"
                                    ? tx("Unlocked · 達標了，犒賞自己吧")
                                    : tx("Locked · 分數與完成率皆達標後解鎖")}
                              </p>
                            </div>
                            {goal.reward && (
                              <Button
                                disabled={m.rewardStatus !== "unlocked"}
                                onClick={() => store.redeem(goal.id)}
                                variant="outlined"
                              >
                                {m.rewardStatus === "redeemed"
                                  ? tx("已領取")
                                  : tx("領取獎勵")}
                              </Button>
                            )}
                          </div>
                        </section>
                        <section className="panel">
                          <div className="section-title">
                            <h2>{tx("每日趨勢")}</h2>
                            {rangeControl(true)}
                          </div>
                          <Trends
                            records={rs}
                            range={range}
                            start={goal.startDate}
                            language={language}
                          />
                        </section>
                        <section className="panel">
                          <h2>{tx("打卡日曆 · 最近 30 天")}</h2>
                          <p className="muted">
                            {tx(
                              "綠：完成 · 紅：未完成 · 黃：略過 · 淺灰：No Record · 斜線：未排程",
                            )}
                          </p>
                          <div className="heatmap">
                            {dates(day(addDays(new Date(), -29)), today).map(
                              (d) => {
                                const r = rs.find((r) => r.date === d);
                                return (
                                  <div
                                    key={d}
                                    tabIndex={0}
                                    title={`${d} · ${r ? resultText(language, r.result) : scheduled(goal, d) ? tx("No Record") : tx("未排程")}${r?.note ? " · " + r.note : ""}`}
                                    className={`heat ${r?.result || (!scheduled(goal, d) ? "unscheduled" : "")}`}
                                  >
                                    <small>{format(parseISO(d), "M/d")}</small>
                                    <span>
                                      {r
                                        ? r.result === "completed"
                                          ? "✓"
                                          : r.result === "failed"
                                            ? "×"
                                            : "−"
                                        : "·"}
                                    </span>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </section>
                        <section className="panel">
                          <h2>{tx("備註與歷史")}</h2>
                          {history(rs)}
                        </section>
                      </>
                    );
                  })()
                ) : (
                  <div className="empty">
                    {tx("找不到這個目標。")}{" "}
                    <Link href="/goals">{tx("返回目標列表")}</Link>
                  </div>
                ))}
              {(page === "history" || page === "analytics") && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">{tx("REFLECT & GROW")}</div>
                      <h1>
                        {page === "history"
                          ? tx("每一次，都有記錄。")
                          : tx("看見自己的節奏。")}
                      </h1>
                      <p>
                        {page === "history"
                          ? tx("回看完成、挫折，以及當下的想法。")
                          : tx("從最近的行動，找到下一步的方向。")}
                      </p>
                    </div>
                    {page === "analytics" && rangeControl()}
                  </div>
                  <div className="filters">
                    <TextField
                      select
                      label={tx("目標")}
                      value={
                        store.goals.some((g) => g.id === recordFilter)
                          ? recordFilter
                          : "all"
                      }
                      onChange={(e) => setRecordFilter(e.target.value)}
                    >
                      <MenuItem value="all">{tx("所有目標")}</MenuItem>
                      {store.goals.map((g) => (
                        <MenuItem key={g.id} value={g.id}>
                          {g.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    {page === "history" && (
                      <TextField
                        label={tx("搜尋目標或備註")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    )}
                  </div>
                  {page === "history" ? (
                    <section className="panel">
                      {history(visibleRecords)}
                    </section>
                  ) : (
                    (() => {
                      const rs = store.checkIns.filter(
                        (r) =>
                          (!store.goals.some((g) => g.id === recordFilter) ||
                            r.goalId === recordFilter) &&
                          r.date >= day(addDays(new Date(), 1 - (range || 30))),
                      );
                      const c = rs.filter(
                          (r) => r.result === "completed",
                        ).length,
                        f = rs.filter((r) => r.result === "failed").length,
                        s = rs.filter((r) => r.result === "skipped").length;
                      return (
                        <>
                          <Stats
                            items={[
                              [tx("Completed"), String(c)],
                              [tx("Failed"), String(f)],
                              [tx("Skipped"), String(s)],
                              [
                                tx("完成率"),
                                `${c + f ? Math.round((c / (c + f)) * 100) : 0}%`,
                                tx("略過與未記錄不列入分母"),
                              ],
                            ]}
                          />
                          <section className="panel">
                            <h2>{tx("每日淨分數")}</h2>
                            <Trends
                              records={rs}
                              range={range || 30}
                              language={language}
                            />
                          </section>
                          <section className="panel">
                            <h2>{tx("打卡結果分佈")}</h2>
                            <div className="chart">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={[
                                    {
                                      name: tx("Completed"),
                                      count: c,
                                      fill: "#10b981",
                                    },
                                    {
                                      name: tx("Failed"),
                                      count: f,
                                      fill: "#f43f5e",
                                    },
                                    {
                                      name: tx("Skipped"),
                                      count: s,
                                      fill: "#f59e0b",
                                    },
                                  ]}
                                >
                                  <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <YAxis allowDecimals={false} />
                                  <Tooltip />
                                  <Bar
                                    dataKey="count"
                                    name={
                                      language === "en"
                                        ? "Count"
                                        : language === "zh-Hans"
                                          ? "次数"
                                          : "次數"
                                    }
                                    radius={[8, 8, 0, 0]}
                                    maxBarSize={90}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            {!rs.length && (
                              <p>
                                {tx("這段時間還沒有打卡。從今天記錄第一步。")}
                              </p>
                            )}
                          </section>
                        </>
                      );
                    })()
                  )}
                </>
              )}
              {page === "settings" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        {tx("YOUR SPACE, YOUR DATA")}
                      </div>
                      <h1>
                        {language === "en"
                          ? "Settings & data"
                          : language === "zh-Hans"
                            ? "设置与数据"
                            : "設定與資料"}
                      </h1>
                      <p>{tx("資料保留在這個瀏覽器，備份由你掌握。")}</p>
                    </div>
                  </div>
                  <section className="panel settings-panel language-panel">
                    <div>
                      <h2>{tx("語言")}</h2>
                      <p>
                        {language === "en"
                          ? "Choose the language used across the app."
                          : language === "zh-Hans"
                            ? "选择整个应用使用的语言。"
                            : "選擇整個應用使用的語言。"}
                      </p>
                    </div>
                    <TextField
                      select
                      label={tx("語言")}
                      value={language}
                      onChange={(e) =>
                        store.setLanguage(e.target.value as Language)
                      }
                    >
                      <MenuItem value="zh-Hant">{tx("繁體中文")}</MenuItem>
                      <MenuItem value="zh-Hans">
                        {tx("簡體中文")}
                      </MenuItem>
                      <MenuItem value="en">{tx("英文")}</MenuItem>
                    </TextField>
                  </section>
                  <section className="panel settings-panel notification-panel">
                    <div className="notification-heading">
                      <div>
                        <h2>{tx("提醒設定")}</h2>
                        <p>{tx("開啟提醒後，會在設定時間通知今天尚未打卡的目標。")}</p>
                      </div>
                      <FormControlLabel
                        label={tx("開啟提醒")}
                        control={
                          <Switch
                            checked={notificationSettings.enabled}
                            onChange={(_, checked) => {
                              if (checked && notificationPermission !== "granted") {
                                void requestNotifications();
                                return;
                              }
                              store.setNotificationSettings({
                                enabled: checked,
                                ...(checked ? { lastSentDate: null } : {}),
                              });
                            }}
                          />
                        }
                      />
                    </div>
                    <div className="notification-grid">
                      <TextField
                        type="time"
                        label={tx("提醒時間")}
                        value={notificationSettings.time}
                        disabled={!notificationSettings.enabled}
                        onChange={(e) =>
                          store.setNotificationSettings({
                            time: e.target.value,
                            lastSentDate: null,
                          })
                        }
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                      <FormControlLabel
                        label={tx("打卡目標提醒")}
                        control={
                          <Switch
                            checked={notificationSettings.checkInReminders}
                            disabled={!notificationSettings.enabled}
                            onChange={(_, checked) =>
                              store.setNotificationSettings({
                                checkInReminders: checked,
                                lastSentDate: null,
                              })
                            }
                          />
                        }
                      />
                    </div>
                    <div className="notification-status">
                      <span>
                        {notificationPermission === "granted"
                          ? tx("通知權限已允許")
                          : notificationPermission === "denied"
                            ? tx("通知權限被拒絕")
                            : notificationPermission === "unsupported"
                              ? tx("此瀏覽器不支援通知")
                              : tx("通知未開啟")}
                      </span>
                      <Button
                        variant="outlined"
                        onClick={sendTestNotification}
                        disabled={notificationPermission === "unsupported"}
                      >
                        {notificationPermission === "granted"
                          ? tx("測試通知")
                          : tx("允許瀏覽器通知")}
                      </Button>
                    </div>
                    {notificationPermission === "denied" && (
                      <small className="notification-note">
                        {tx("請在瀏覽器設定中允許通知。")}
                      </small>
                    )}
                    <div className="notification-schedule">
                      {notificationSettings.enabled &&
                      notificationSettings.checkInReminders
                        ? tx("每天 {time} 提醒", {
                            time: notificationSettings.time,
                          })
                        : tx("提醒已關閉")}
                    </div>
                    <small className="notification-note">
                      {tx(
                        "目前只會在 App 開啟時檢查提醒；瀏覽器完全關閉時的推送需要後端 Web Push。",
                      )}
                    </small>
                  </section>
                  <section className="panel settings-panel">
                    <h2>{tx("JSON 備份")}</h2>
                    <p>
                      {tx(
                        "目前有 {goals} 個目標、{checkIns} 筆打卡。匯入會取代現有資料，建議先匯出。",
                        {
                          goals: store.goals.length,
                          checkIns: store.checkIns.length,
                        },
                      )}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="contained"
                        startIcon={<Download size={17} />}
                        onClick={() => {
                          const blob = new Blob(
                            [
                              JSON.stringify(
                                {
                                  version: 1,
                                  goals: store.goals,
                                  checkIns: store.checkIns,
                                  language: store.language,
                                  notificationSettings:
                                    store.notificationSettings,
                                },
                                null,
                                2,
                              ),
                            ],
                            { type: "application/json" },
                          );
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `target-tracking-${today}.json`;
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                          setMessage(tx("備份已匯出"));
                        }}
                      >
                        {tx("Export JSON")}
                      </Button>
                      <Button
                        component="label"
                        variant="outlined"
                        startIcon={<Upload size={17} />}
                      >
                        {tx("Import JSON")}
                        <input
                          hidden
                          type="file"
                          accept=".json,application/json"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file) return;
                            if (file.size > 10 * 1024 * 1024) {
                              setMessage(tx("檔案不能超過 10 MB"));
                              return;
                            }
                            try {
                              const parsed = backupSchema.parse(
                                JSON.parse(await file.text()),
                              );
                              setConfirm({
                                text: tx(
                                  "以備份中的 {goals} 個目標及 {checkIns} 筆打卡取代目前資料？",
                                  {
                                    goals: parsed.goals.length,
                                    checkIns: parsed.checkIns.length,
                                  },
                                ),
                                run: () => {
                                  store.replace(parsed);
                                  setMessage(tx("備份已匯入"));
                                },
                              });
                            } catch {
                              setMessage(
                                tx(
                                  "匯入失敗：格式、日期或打卡關聯無效。原資料未變更。",
                                ),
                              );
                            }
                          }}
                        />
                      </Button>
                    </div>
                  </section>
                  <section className="panel settings-panel">
                    <h2>{tx("計算規則")}</h2>
                    <p>
                      {tx(
                        "Net Score = 完成次數 − 未完成次數。Completion Rate = 完成 ÷（完成 + 未完成）；略過及 No Record 均不列入分母。",
                      )}
                    </p>
                    <p>
                      {tx(
                        "Streak 計算連續完成的排程日；略過、未完成或過去漏打卡會中斷。今天尚未打卡不會提前中斷。",
                      )}
                    </p>
                    <p>
                      {tx(
                        "進度健康度比較「淨分數 / 目標分數」與已過時間比例：領先 10 個百分點為 Ahead；落後不超過 10 為 On Track；落後不超過 25 為 Slightly Behind，其餘為 At Risk。",
                      )}
                    </p>
                    <p>
                      {tx(
                        "暫停期間不顯示待辦，但日期不會順延。獎勵領取後保留領取記錄，即使後來修改當天打卡。",
                      )}
                    </p>
                  </section>
                  <section className="panel settings-panel">
                    <h2>{tx("重新開始")}</h2>
                    <p>
                      {language === "en"
                        ? "Clearing does not restore demo data automatically. Clearing browser data removes this device's records, so export backups regularly."
                        : language === "zh-Hans"
                          ? "清除后不会自动重新加入示例数据。清除浏览器数据也会移除此设备的记录，请定期备份。"
                          : "清除後不會自動重新加入示範資料。清除瀏覽器資料也會移除此裝置的記錄，請定期備份。"}
                    </p>
                    <Button
                      color="error"
                      variant="outlined"
                      onClick={() =>
                        setConfirm({
                          text: tx("清除所有目標與打卡？此操作無法復原。"),
                          run: () =>
                            store.replace({
                              version: 1,
                              goals: [],
                              checkIns: [],
                            }),
                        })
                      }
                    >
                      {tx("清除所有資料")}
                    </Button>
                    <Button
                      onClick={() =>
                        setConfirm({
                          text: tx("使用示範資料取代目前所有資料？"),
                          run: () => store.replace(demo()),
                        })
                      }
                    >
                      {tx("重設示範資料")}
                    </Button>
                  </section>
                </>
              )}
              {![
                "today",
                "goals",
                "detail",
                "history",
                "analytics",
                "settings",
              ].includes(page) && (
                <div className="empty">
                  {tx("找不到頁面。")} <Link href="/">{tx("回到 Today")}</Link>
                </div>
              )}
              <footer>
                {tx("一步一步，成為你想成為的自己。")}
                <span>Target Tracking</span>
              </footer>
            </div>
          )}
        </main>
        <nav className="mobile-nav">
          {nav.map(([url, label, Icon]) => (
            <Link
              key={url}
              href={url}
              className={
                (url === "/" ? page === "today" : path.startsWith(url))
                  ? "active"
                  : ""
              }
            >
              <Icon size={21} />
              <span>{tx(label)}</span>
            </Link>
          ))}
        </nav>
      </div>
      {form !== undefined && (
        <GoalForm
          goal={form}
          onClose={() => setForm(undefined)}
          language={language}
        />
      )}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        <DialogTitle>{tx("確認操作")}</DialogTitle>
        <DialogContent>{confirm?.text}</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>{tx("取消")}</Button>
          <Button
            color="error"
            onClick={() => {
              confirm?.run();
              setConfirm(null);
            }}
          >
            {tx("確認")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!noteGoal}
        onClose={() => setNoteGoal(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{tx("今天的備註")}</DialogTitle>
        <DialogContent>
          <TextField
            label={tx("發生了什麼？")}
            multiline
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteGoal(null)}>{tx("取消")}</Button>
          <Button
            onClick={() => {
              const r = store.checkIns.find(
                (r) => r.goalId === noteGoal?.id && r.date === today,
              );
              if (r)
                store.check({
                  ...r,
                  note,
                  updatedAt: new Date().toISOString(),
                });
              setNoteGoal(null);
            }}
          >
            {tx("儲存備註")}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={!!message}
        autoHideDuration={4500}
        onClose={() => setMessage("")}
        message={message}
      />
    </ThemeProvider>
  );
}
