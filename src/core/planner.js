import { DEFAULT_DAILY_UPDATE_TIME, DIFFICULTY_CONFIG } from "./config.js";
import {
  formatGoalText,
  getActiveGoals,
  getGoalCounts,
  getGoalDaysRemaining,
  hasActiveGoals,
  normalizeGoalItems,
  serializeGoalItems,
} from "./goals.js";
import { compactText, getPhase, getPhaseLabel, normalizeTimeValue, scheduledPlanDateKey, shortenGoal, todayKey } from "./utils.js";

export function createInitialState() {
  return {
    version: 10,
    createdAt: "",
    currentDate: todayKey(),
    goal: "",
    goals: [],
    difficulty: "balanced",
    insight: "",
    nextId: 1,
    tasks: [],
    history: [],
    pendingCarryover: emptyCarryover(),
    preferences: normalizePreferences(),
    planMeta: normalizePlanMeta(),
  };
}

export function normalizeState(raw) {
  const base = createInitialState();
  const normalized = Object.assign(base, raw || {});
  normalized.goals = normalizeGoalItems(raw?.goals, raw?.goal);
  normalized.goal = formatGoalText(normalized.goals);
  normalized.difficulty = DIFFICULTY_CONFIG[normalized.difficulty] ? normalized.difficulty : "balanced";
  normalized.preferences = normalizePreferences(normalized.preferences);
  if (!raw?.version || raw.version < 5) {
    normalized.preferences.startOfWeek = "sunday";
  }
  if (!raw?.version || raw.version < 6) {
    normalized.preferences.considerMissedTasks = true;
  }
  if (!raw?.version || raw.version < 8) {
    normalized.preferences.countCompletedTasksInPlan = true;
  }
  if (!raw?.version || raw.version < 9) {
    normalized.preferences.dailyUpdateTime = DEFAULT_DAILY_UPDATE_TIME;
  }
  normalized.currentDate = normalized.currentDate || todayKey();
  normalized.insight = compactText(normalized.insight);
  normalized.nextId = Number.isFinite(normalized.nextId) && normalized.nextId > 0 ? normalized.nextId : 1;
  normalized.tasks = Array.isArray(normalized.tasks) ? normalized.tasks.map(normalizeTask).filter(Boolean) : [];
  normalized.history = Array.isArray(normalized.history)
    ? normalized.history.map(normalizeHistoryEntry).filter(Boolean)
    : [];
  normalized.pendingCarryover = normalizePendingCarryover(normalized.pendingCarryover);
  normalized.planMeta = normalizePlanMeta(normalized.planMeta);
  return normalized;
}

export function summarizeRecent(history) {
  const recent = history.slice(-7);
  const totals = {
    days: recent.length,
    done: 0,
    failed: 0,
    missed: 0,
  };

  recent.forEach((entry) => {
    totals.done += entry.summary.done;
    totals.failed += entry.summary.failed;
    totals.missed += entry.summary.missed;
  });

  const allTasks = totals.done + totals.failed + totals.missed;
  const completionRate = allTasks > 0 ? totals.done / allTasks : 0;
  const failureRate = allTasks > 0 ? (totals.failed + totals.missed) / allTasks : 0;

  return {
    days: totals.days,
    done: totals.done,
    failed: totals.failed,
    missed: totals.missed,
    completionRate,
    failureRate,
  };
}

function summarizeRecentWithoutMisses(history) {
  const recent = history.slice(-7);
  const done = recent.reduce((sum, entry) => sum + entry.summary.done, 0);

  return {
    days: recent.length,
    done,
    failed: 0,
    missed: 0,
    completionRate: done > 0 ? 1 : 0,
    failureRate: 0,
  };
}

function summarizeRecentAi(history) {
  const recent = history.slice(-7);
  const totals = {
    days: recent.length,
    done: 0,
    failed: 0,
    missed: 0,
  };

  recent.forEach((entry) => {
    const aiSummary = summarizeHistoryTasks(entry.tasks.filter((task) => !task.manual));
    totals.done += aiSummary.done;
    totals.failed += aiSummary.failed;
    totals.missed += aiSummary.missed;
  });

  const allTasks = totals.done + totals.failed + totals.missed;
  const completionRate = allTasks > 0 ? totals.done / allTasks : 0;
  const failureRate = allTasks > 0 ? (totals.failed + totals.missed) / allTasks : 0;

  return {
    days: totals.days,
    done: totals.done,
    failed: totals.failed,
    missed: totals.missed,
    completionRate,
    failureRate,
  };
}

function summarizeRecentAiWithoutMisses(history) {
  const recent = history.slice(-7);
  const done = recent.reduce((sum, entry) => {
    const aiSummary = summarizeHistoryTasks(entry.tasks.filter((task) => !task.manual));
    return sum + aiSummary.done;
  }, 0);

  return {
    days: recent.length,
    done,
    failed: 0,
    missed: 0,
    completionRate: done > 0 ? 1 : 0,
    failureRate: 0,
  };
}

export function syncStateWithToday(state, currentDate = new Date()) {
  state.preferences = normalizePreferences(state.preferences);
  state.goals = normalizeGoalItems(state.goals, state.goal);
  state.goal = formatGoalText(state.goals);
  const now = currentDate instanceof Date ? currentDate : new Date(currentDate);
  const calendarToday = todayKey(Number.isNaN(now.getTime()) ? new Date() : now);
  const today = scheduledPlanDateKey(now, state.preferences.dailyUpdateTime);
  const previousDate = state.currentDate || today;

  if (!hasActiveGoals(state.goals, state.goal)) {
    const goalCounts = getGoalCounts(state.goals, state.goal);
    const rolledOver = previousDate < calendarToday;
    if (rolledOver) {
      archiveCurrentTasks(state);
      state.tasks = [];
    } else {
      state.tasks = state.tasks.filter((task) => task.manual);
    }

    state.currentDate = calendarToday;
    state.pendingCarryover = emptyCarryover();
    state.planMeta.pendingReason = "";
    state.planMeta.lastError = "";
    state.insight = buildNoActiveGoalInsight(goalCounts, state.tasks.length > 0);
    return {
      changed: previousDate !== calendarToday,
      rolledOver,
    };
  }

  if (previousDate < today) {
    const carryover = archiveCurrentTasks(state);
    state.currentDate = today;
    state.pendingCarryover = carryover;
    state.tasks = [];
    state.insight = "업데이트 시간이 지나 이전 기록을 반영한 새 계획을 준비하고 있습니다.";
    markPlanPending(state, "rollover");
    return {
      changed: true,
      rolledOver: true,
    };
  }

  if (needsPlan(state)) {
    if (!state.planMeta.pendingReason) {
      markPlanPending(state, "startup");
    }
    if (!state.insight) {
      state.insight = "AI가 오늘 할 일을 계산할 준비를 마쳤습니다.";
    }
    return {
      changed: true,
      rolledOver: false,
    };
  }

  return {
    changed: false,
    rolledOver: false,
  };
}

export function updateGoalSettings(state, goals, difficulty) {
  const normalizedGoals = normalizeGoalItems(goals);
  const normalizedGoal = formatGoalText(normalizedGoals);
  const normalizedDifficulty = DIFFICULTY_CONFIG[difficulty] ? difficulty : "balanced";
  const today = scheduledPlanDateKey(new Date(), state.preferences.dailyUpdateTime);
  const goalCounts = getGoalCounts(normalizedGoals);

  state.goals = normalizedGoals;
  state.goal = normalizedGoal;
  state.difficulty = normalizedDifficulty;
  state.createdAt = normalizedGoal ? state.createdAt || new Date().toISOString() : "";
  state.currentDate = today;

  if (!normalizedGoal) {
    state.tasks = state.tasks.filter((task) => task.manual);
    state.pendingCarryover = emptyCarryover();
    state.planMeta = normalizePlanMeta();
    state.insight = buildNoActiveGoalInsight(goalCounts, state.tasks.length > 0);
    return state;
  }

  state.tasks = state.tasks.filter((task) => task.manual || task.status === "done");
  state.pendingCarryover = emptyCarryover();
  state.insight = "목표와 난이도를 기준으로 오늘 할 일을 다시 계산합니다.";
  markPlanPending(state, "goalUpdate");
  return state;
}

export function updatePreferences(state, nextPreferences) {
  state.preferences = normalizePreferences({
    ...state.preferences,
    ...(nextPreferences || {}),
  });
  return state;
}

export function markNotificationSent(state, dateKey = todayKey()) {
  state.preferences.lastNotificationDate = dateKey;
  return state;
}

export function appendManualTask(state, title) {
  const normalizedTitle = compactText(title);
  if (!normalizedTitle) {
    return state;
  }

  state.tasks.push(createTask(state, normalizedTitle, {
    source: "manual",
    manual: true,
    category: "manual",
    createdFor: state.currentDate,
    originalTitle: normalizedTitle,
    note: "사용자가 직접 추가한 오늘 할 일입니다.",
  }));

  return state;
}

export function setTaskStatus(state, taskId, status) {
  const task = state.tasks.find((item) => String(item.id) === String(taskId));
  if (!task) {
    return state;
  }

  task.status = ["pending", "done", "failed"].includes(status) ? status : "pending";
  return state;
}

function findHistoryTask(entry, taskId) {
  return entry.tasks.find((item) => String(item.id) === String(taskId));
}

function refreshHistorySummary(entry) {
  entry.summary = summarizeHistoryTasks(entry.tasks);
}

export function setCalendarTaskStatus(state, dateKey, taskId, status) {
  if (dateKey === state.currentDate) {
    return setTaskStatus(state, taskId, status);
  }

  const entry = state.history.find((item) => item.date === dateKey);
  if (!entry) {
    return state;
  }

  const task = findHistoryTask(entry, taskId);
  if (!task) {
    return state;
  }

  task.status = status === "done" ? "done" : "missed";
  refreshHistorySummary(entry);
  return state;
}

export function updateManualTaskTitle(state, taskId, title) {
  const task = state.tasks.find((item) => String(item.id) === String(taskId));
  const normalizedTitle = compactText(title);
  if (!task || !task.manual || !normalizedTitle) {
    return state;
  }

  task.title = normalizedTitle;
  task.originalTitle = normalizedTitle;
  task.note = "사용자가 직접 수정한 오늘 할 일입니다.";
  return state;
}

export function updateCalendarManualTaskTitle(state, dateKey, taskId, title) {
  if (dateKey === state.currentDate) {
    return updateManualTaskTitle(state, taskId, title);
  }

  const entry = state.history.find((item) => item.date === dateKey);
  const normalizedTitle = compactText(title);
  if (!entry || !normalizedTitle) {
    return state;
  }

  const task = findHistoryTask(entry, taskId);
  if (!task || !task.manual) {
    return state;
  }

  task.title = normalizedTitle;
  task.note = "사용자가 직접 수정한 할일입니다.";
  return state;
}

export function removeTask(state, taskId) {
  state.tasks = state.tasks.filter((task) => String(task.id) !== String(taskId));
  return state;
}

export function removeCalendarTask(state, dateKey, taskId) {
  if (dateKey === state.currentDate) {
    return removeTask(state, taskId);
  }

  const entry = state.history.find((item) => item.date === dateKey);
  if (!entry) {
    return state;
  }

  entry.tasks = entry.tasks.filter((task) => String(task.id) !== String(taskId));
  refreshHistorySummary(entry);
  return state;
}

export function addAiTasksToToday(state) {
  if (!hasActiveGoals(state.goals, state.goal)) {
    return state;
  }

  state.insight = "AI 할 일을 추가로 요청했습니다.";
  markPlanPending(state, "manualAdd");
  return state;
}

export function needsPlan(state) {
  return hasActiveGoals(state.goals, state.goal) && (
    Boolean(state.planMeta.pendingReason)
    || state.planMeta.lastPlannedFor !== state.currentDate
  );
}

export function createPlanPayload(state) {
  if (!hasActiveGoals(state.goals, state.goal)) {
    return null;
  }

  const difficultyConfig = DIFFICULTY_CONFIG[state.difficulty] || DIFFICULTY_CONFIG.balanced;
  const goals = getActiveGoals(state.goals, state.goal);
  const phase = getPhase(state.currentDate);
  const planReason = state.planMeta.pendingReason || "startup";
  const isManualAdd = planReason === "manualAdd";
  const considerMissedTasks = state.preferences.considerMissedTasks !== false;
  const recentSummary = considerMissedTasks ? summarizeRecentAi(state.history) : summarizeRecentAiWithoutMisses(state.history);
  const manualTasks = state.tasks
    .filter((task) => task.manual)
    .map((task) => ({
      title: task.title,
      status: task.status,
      carryoverCount: task.carryoverCount,
    }));
  const completedTodayTasks = state.tasks
    .filter((task) => task.status === "done")
    .map((task) => task.title);
  const currentAiTasks = state.tasks
    .filter((task) => !task.manual && task.status !== "done")
    .map((task) => task.title);
  const completedAiTodayCount = state.preferences.countCompletedTasksInPlan === false
    ? 0
    : state.tasks.filter((task) => task.status === "done" && !task.manual).length;
  const rawUnfinishedAiTasks = dedupeCarryover([
    ...state.pendingCarryover.ai,
    ...collectUnfinishedAiTasks(state),
  ]);
  const unfinishedAiTasks = considerMissedTasks && !isManualAdd ? rawUnfinishedAiTasks : [];
  const unfinishedManualTasks = [];
  const missedPressure = considerMissedTasks
    ? recentSummary.failed + recentSummary.missed + unfinishedAiTasks.length
    : 0;
  const taskTarget = isManualAdd
    ? calculateAdditionalTaskTarget(difficultyConfig.baseTasks, currentAiTasks.length)
    : calculateTaskTarget(difficultyConfig.baseTasks, goals.length, missedPressure, completedAiTodayCount);
  const focusMinutes = difficultyConfig.focusMinutes + (missedPressure > 0 ? 15 : 0);
  const recentHistory = state.history.slice(-7).map((entry) => {
    const aiTasks = entry.tasks.filter((task) => !task.manual);
    const aiSummary = summarizeHistoryTasks(aiTasks);

    return {
      date: entry.date,
      summary: considerMissedTasks
        ? aiSummary
        : {
          done: aiSummary.done,
          failed: 0,
          missed: 0,
        },
      tasks: considerMissedTasks
        ? aiTasks.slice(0, 6).map((task) => ({
          title: task.title,
          status: task.status,
        }))
        : aiTasks
          .filter((task) => task.status === "done")
          .slice(0, 6)
          .map((task) => ({
            title: task.title,
            status: task.status,
          })),
    };
  });

  return {
    goal: formatGoalText(goals),
    goals: goals.map((goal) => goal.title),
    goalDetails: goals.map((goal) => ({
      title: goal.title,
      status: goal.status,
      targetDate: goal.targetDate,
      detail: goal.detail,
      daysRemaining: getGoalDaysRemaining(goal.targetDate, state.currentDate),
    })),
    goalSignature: serializeGoalItems(goals),
    difficulty: state.difficulty,
    difficultyLabel: difficultyConfig.label,
    taskTarget,
    focusMinutes,
    currentDate: state.currentDate,
    phase,
    phaseLabel: getPhaseLabel(phase),
    planReason,
    manualTasks,
    currentAiTasks,
    completedTodayTasks,
    completedAiTodayCount,
    unfinishedAiTasks,
    unfinishedManualTasks,
    recentSummary,
    recentHistory,
    considerMissedTasks,
    countCompletedTasksInPlan: state.preferences.countCompletedTasksInPlan !== false,
  };
}

export function applyAiPlan(state, plan, meta = {}) {
  const preservedTasks = meta.append
    ? [...state.tasks]
    : state.tasks.filter((task) => task.manual || task.status === "done");
  const blocked = new Set(preservedTasks.map((task) => normalizeTitleKey(task.title)));
  const nextTasks = [...preservedTasks];

  (Array.isArray(plan.tasks) ? plan.tasks : []).forEach((task) => {
    const title = compactText(task.title);
    const key = normalizeTitleKey(title);
    if (!title || blocked.has(key)) {
      return;
    }

    blocked.add(key);
    nextTasks.push(createTask(state, title, {
      category: normalizeCategory(task.category),
      source: "ai",
      manual: false,
      createdFor: state.currentDate,
      originalTitle: title,
      note: compactText(task.reason) || "오늘 우선 처리해야 할 작업입니다.",
    }));
  });

  state.tasks = nextTasks;
  state.insight = compactText(plan.insight) || buildFallbackInsight(state);
  state.pendingCarryover = emptyCarryover();
  state.planMeta.pendingReason = "";
  state.planMeta.lastPlannedFor = state.currentDate;
  state.planMeta.lastGeneratedAt = new Date().toISOString();
  state.planMeta.lastModel = compactText(meta.model);
  state.planMeta.lastSource = compactText(meta.source);
  state.planMeta.lastError = "";
  return state;
}

export function markPlanError(state, message) {
  state.planMeta.lastError = compactText(message);
  if (!state.planMeta.pendingReason) {
    state.planMeta.pendingReason = "startup";
  }
  state.insight = state.planMeta.lastError || "AI 연결을 확인한 뒤 다시 시도해 주세요.";
  return state;
}

function normalizeTask(task) {
  if (!task || typeof task.title !== "string") {
    return null;
  }

  return {
    id: normalizeTaskId(task.id, task.createdFor, task.title),
    title: compactText(task.title),
    status: ["pending", "done", "failed"].includes(task.status) ? task.status : "pending",
    category: task.category || "focus",
    source: task.source || "ai",
    manual: Boolean(task.manual),
    carryoverCount: Number.isFinite(task.carryoverCount) ? task.carryoverCount : 0,
    createdFor: task.createdFor || todayKey(),
    originalTitle: compactText(task.originalTitle) || compactText(task.title),
    note: compactText(task.note),
  };
}

function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry.date !== "string") {
    return null;
  }

  const tasks = Array.isArray(entry.tasks)
    ? entry.tasks
      .map((task, index) => {
        if (!task || typeof task.title !== "string") {
          return null;
        }

        return {
          id: task.id ?? `${entry.date}-${index}`,
          title: compactText(task.title),
          status: ["done", "failed", "missed"].includes(task.status) ? task.status : "missed",
          manual: Boolean(task.manual),
          source: task.source || "ai",
          carryoverCount: Number.isFinite(task.carryoverCount) ? task.carryoverCount : 0,
          note: compactText(task.note),
        };
      })
      .filter(Boolean)
    : [];

  const summary = entry.summary || summarizeHistoryTasks(tasks);

  return {
    date: entry.date,
    archivedAt: entry.archivedAt || "",
    goalSnapshot: normalizeGoalItems(entry.goalSnapshot, entry.goal),
    tasks,
    summary: {
      done: Number.isFinite(summary.done) ? summary.done : 0,
      failed: Number.isFinite(summary.failed) ? summary.failed : 0,
      missed: Number.isFinite(summary.missed) ? summary.missed : 0,
    },
  };
}

function summarizeHistoryTasks(tasks) {
  return tasks.reduce((summary, task) => {
    if (task.status === "done") {
      summary.done += 1;
    } else if (task.status === "failed") {
      summary.failed += 1;
    } else {
      summary.missed += 1;
    }
    return summary;
  }, { done: 0, failed: 0, missed: 0 });
}

function normalizeTaskId(taskId, createdFor, title) {
  if (typeof taskId === "string" && taskId.trim()) {
    return taskId;
  }

  if (typeof taskId === "number" && Number.isFinite(taskId)) {
    return taskId;
  }

  const dateKey = createdFor || todayKey();
  const normalizedTitle = compactText(title) || "task";
  return `${dateKey}:${normalizedTitle}:${Math.random().toString(36).slice(2, 8)}`;
}

function createTask(state, taskTitle, options = {}) {
  const title = compactText(taskTitle);

  return {
    id: state.nextId++,
    title,
    originalTitle: compactText(options.originalTitle) || title,
    status: options.status || "pending",
    category: options.category || "focus",
    source: options.source || "ai",
    manual: Boolean(options.manual),
    carryoverCount: Number.isFinite(options.carryoverCount) ? options.carryoverCount : 0,
    createdFor: options.createdFor || state.currentDate || todayKey(),
    note: compactText(options.note),
  };
}

function createCarryoverTasks(state, carryoverTasks, dateKey) {
  return carryoverTasks.map((task) => {
    const originalTitle = cleanCarryoverTitle(task.originalTitle || task.title);
    return createTask(state, originalTitle, {
      category: "carryover",
      source: "carryover",
      manual: true,
      carryoverCount: task.carryoverCount || 0,
      createdFor: dateKey,
      originalTitle,
      note: task.lastStatus === "failed"
        ? "어제 실패한 수동 작업이라 오늘 다시 이어갑니다."
        : "어제 끝내지 못한 수동 작업을 오늘로 이월했습니다.",
    });
  });
}

function cleanCarryoverTitle(title) {
  return compactText(String(title || "").replace(/^(이월|복구)\s*:\s*/iu, ""));
}

function archiveCurrentTasks(state) {
  if (!state.tasks.length) {
    return emptyCarryover();
  }

  const carryover = emptyCarryover();
  const archivedTasks = state.tasks.map((task) => {
    const finalStatus = task.status === "done" ? "done" : task.status === "failed" ? "failed" : "missed";
    const archivedTask = {
      id: task.id,
      title: task.title,
      status: finalStatus,
      manual: task.manual,
      source: task.source,
      carryoverCount: task.carryoverCount || 0,
      note: task.note,
    };

    if (finalStatus !== "done") {
      const target = task.manual ? carryover.manual : carryover.ai;
      target.push({
        title: task.title,
        originalTitle: task.originalTitle || task.title,
        carryoverCount: (task.carryoverCount || 0) + 1,
        lastStatus: finalStatus,
      });
    }

    return archivedTask;
  });

  state.history = state.history.filter((entry) => entry.date !== state.currentDate);
  state.history.push({
    date: state.currentDate,
    archivedAt: new Date().toISOString(),
    goalSnapshot: state.goals,
    tasks: archivedTasks,
    summary: summarizeHistoryTasks(archivedTasks),
  });

  state.history = state.history.slice(-45);
  return carryover;
}

function normalizePendingCarryover(value) {
  return {
    manual: normalizeCarryoverList(value?.manual),
    ai: normalizeCarryoverList(value?.ai),
  };
}

function normalizeCarryoverList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((task) => {
      const title = compactText(task?.title);
      if (!title) {
        return null;
      }

      return {
        title,
        originalTitle: compactText(task.originalTitle) || title,
        carryoverCount: Number.isFinite(task.carryoverCount) ? task.carryoverCount : 1,
        lastStatus: ["failed", "missed", "pending"].includes(task.lastStatus) ? task.lastStatus : "missed",
      };
    })
    .filter(Boolean);
}

function calculateTaskTarget(baseTasks, goalCount, missedPressure, completedCount = 0) {
  const goalLoadPenalty = goalCount >= 6 ? 2 : goalCount >= 4 ? 1 : 0;
  const recoveryBump = missedPressure > 0 ? 1 : 0;
  const adjustedTarget = baseTasks + recoveryBump - goalLoadPenalty - Math.max(0, completedCount);
  return Math.min(6, Math.max(1, adjustedTarget));
}

function calculateAdditionalTaskTarget(baseTasks, currentAiTaskCount) {
  const remainingCapacity = Math.max(0, baseTasks - currentAiTaskCount);
  if (remainingCapacity <= 0) {
    return 1;
  }

  return Math.min(3, Math.max(1, remainingCapacity));
}

function normalizePreferences(value = {}) {
  return {
    theme: ["light", "dark"].includes(value.theme) ? value.theme : "light",
    notificationsEnabled: Boolean(value.notificationsEnabled),
    reminderTime: /^\d{2}:\d{2}$/u.test(String(value.reminderTime || "")) ? value.reminderTime : "21:00",
    dailyUpdateTime: normalizeTimeValue(value.dailyUpdateTime, DEFAULT_DAILY_UPDATE_TIME),
    startOfWeek: "sunday",
    showCompletedInCalendar: value.showCompletedInCalendar !== false,
    considerMissedTasks: value.considerMissedTasks !== false,
    countCompletedTasksInPlan: value.countCompletedTasksInPlan !== false,
    lastNotificationDate: typeof value.lastNotificationDate === "string" ? value.lastNotificationDate : "",
  };
}

function normalizePlanMeta(value = {}) {
  return {
    pendingReason: typeof value.pendingReason === "string" ? value.pendingReason : "",
    lastPlannedFor: typeof value.lastPlannedFor === "string" ? value.lastPlannedFor : "",
    lastGeneratedAt: typeof value.lastGeneratedAt === "string" ? value.lastGeneratedAt : "",
    lastModel: typeof value.lastModel === "string" ? value.lastModel : "",
    lastSource: typeof value.lastSource === "string" ? value.lastSource : "",
    lastError: typeof value.lastError === "string" ? value.lastError : "",
  };
}

function collectUnfinishedAiTasks(state) {
  return state.tasks
    .filter((task) => !task.manual && task.status !== "done")
    .map((task) => ({
      title: task.originalTitle || task.title,
      originalTitle: task.originalTitle || task.title,
      carryoverCount: (task.carryoverCount || 0) + 1,
      lastStatus: task.status === "failed" ? "failed" : "missed",
    }));
}

function dedupeCarryover(tasks) {
  const seen = new Set();
  const result = [];

  tasks.forEach((task) => {
    const title = compactText(task.title || task.originalTitle);
    const key = normalizeTitleKey(title);
    if (!title || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push({
      title,
      originalTitle: compactText(task.originalTitle) || title,
      carryoverCount: Number.isFinite(task.carryoverCount) ? task.carryoverCount : 1,
      lastStatus: ["failed", "missed", "pending"].includes(task.lastStatus) ? task.lastStatus : "missed",
    });
  });

  return result;
}

function normalizeCategory(value) {
  return ["focus", "support", "review"].includes(value) ? value : "focus";
}

function normalizeTitleKey(value) {
  return compactText(value).toLowerCase();
}

function emptyCarryover() {
  return {
    manual: [],
    ai: [],
  };
}

function markPlanPending(state, reason) {
  state.planMeta.pendingReason = reason;
  state.planMeta.lastError = "";
}

function buildFallbackInsight(state) {
  const difficulty = DIFFICULTY_CONFIG[state.difficulty] || DIFFICULTY_CONFIG.balanced;
  const recent = summarizeRecent(state.history);
  const nearestGoal = getActiveGoals(state.goals, state.goal)
    .filter((goal) => goal.targetDate)
    .sort((left, right) => left.targetDate.localeCompare(right.targetDate))[0];
  const parts = [
    `AI가 "${shortenGoal(state.goal)}" 목표를 ${difficulty.label} 난이도로 해석해 오늘 할 일을 구성했습니다.`,
    `현재 시점은 ${getPhaseLabel(getPhase(state.currentDate))}입니다.`,
  ];

  if (nearestGoal?.targetDate) {
    const daysRemaining = getGoalDaysRemaining(nearestGoal.targetDate, state.currentDate);
    if (daysRemaining !== null) {
      parts.push(`${nearestGoal.title} 목표일까지 ${daysRemaining}일 남은 점을 반영했습니다.`);
    }
  }

  if (recent.days > 0) {
    parts.push(`최근 7일 완료율 ${Math.round(recent.completionRate * 100)}%를 반영했습니다.`);
  }

  return parts.join(" ");
}

function buildNoActiveGoalInsight(goalCounts, hasManualTasks = false) {
  if (goalCounts.success > 0 && goalCounts.active === 0) {
    return hasManualTasks
      ? "모든 목표가 성공 상태라 AI 추천은 멈췄습니다. 직접 추가한 오늘 할 일은 계속 관리할 수 있습니다."
      : "모든 목표가 성공 상태입니다. 새 진행중 목표를 추가하면 AI 추천을 다시 시작합니다.";
  }

  return hasManualTasks
    ? "진행중인 목표가 없어 AI 추천은 비활성입니다. 직접 추가한 오늘 할 일을 관리할 수 있습니다."
    : "진행중인 목표가 없어도 직접 할 일을 추가할 수 있습니다.";
}
