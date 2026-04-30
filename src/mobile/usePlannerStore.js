import { AppState } from "react-native";
import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import { createPlannerHealthSnapshot, fetchPlannerHealth, getAiServerUnavailableMessage, requestAiPlan } from "../core/ai.js";
import { getGoalCounts, serializeGoalItems } from "../core/goals.js";
import { fetchHolidayYear } from "../core/holidays.js";
import {
  applyAiPlan,
  appendManualTask,
  createInitialState,
  createPlanPayload,
  markPlanError,
  needsPlan,
  normalizeState,
  regenerateTodayPlan,
  removeCalendarTask,
  removeTask,
  setCalendarTaskStatus,
  setTaskStatus,
  syncStateWithToday,
  updateCalendarManualTaskTitle,
  updateGoalSettings,
  updateManualTaskTitle as renameManualTask,
  updatePreferences,
} from "../core/planner.js";
import {
  clearStoredHolidayMap,
  clearStoredState,
  loadStoredHolidayMap,
  loadStoredHolidayYear,
  loadStoredState,
  saveStoredHolidayYear,
  saveStoredState,
} from "./storage.js";
import {
  getNotificationPermissionStatus,
  requestNotificationPermission as requestNotificationPermissionNative,
  syncDailyReminder,
} from "./notifications.js";

function cloneState(state) {
  return normalizeState(JSON.parse(JSON.stringify(state)));
}

function buildReminderTitle(state) {
  return getGoalCounts(state.goals, state.goal).active > 0
    ? "오늘 할 일을 확인해보세요"
    : "먼저 진행중인 목표를 설정해보세요";
}

function buildReminderBody(state) {
  const goalCounts = getGoalCounts(state.goals, state.goal);
  if (goalCounts.active === 0) {
    return goalCounts.success > 0
      ? "성공한 목표만 남아 있습니다. 새 진행중 목표를 추가하면 오늘 할 일을 다시 추천합니다."
      : "목표를 입력하면 오늘 처리할 일을 자동으로 추천해드립니다.";
  }

  const pendingTasks = state.tasks.filter((task) => task.status !== "done");
  if (pendingTasks.length === 0) {
    return "오늘 일정이 비어 있습니다. AI 추천이나 직접 추가로 채워보세요.";
  }

  if (pendingTasks.length === 1) {
    return `남은 할 일 1개: ${pendingTasks[0].title}`;
  }

  return `오늘 남은 할 일 ${pendingTasks.length}개를 확인해보세요.`;
}

export function usePlannerStore() {
  const [state, setState] = useState(createInitialState);
  const [isHydrated, setIsHydrated] = useState(false);
  const [health, setHealth] = useState(() => createPlannerHealthSnapshot());
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notificationPermission, setNotificationPermission] = useState("undetermined");
  const [holidayYears, setHolidayYears] = useState({});
  const [holidayStatus, setHolidayStatus] = useState({ loading: false, error: "" });
  const stateRef = useRef(state);
  const holidayYearsRef = useRef({});
  const requestIdRef = useRef(0);
  const activeRequestRef = useRef({ key: "", promise: null });
  const holidayRequestRef = useRef(new Map());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    holidayYearsRef.current = holidayYears;
  }, [holidayYears]);

  const commit = useEffectEvent((recipe) => {
    const draft = cloneState(stateRef.current);
    recipe(draft);
    const nextState = normalizeState(draft);
    stateRef.current = nextState;
    void saveStoredState(nextState);
    startTransition(() => {
      setState(nextState);
    });
    return nextState;
  });

  const syncNotificationPermission = useEffectEvent(async () => {
    const permission = await getNotificationPermissionStatus();
    setNotificationPermission(permission);
    return permission;
  });

  const refreshHealth = useEffectEvent(async () => {
    try {
      const nextHealth = await fetchPlannerHealth();
      setHealth(nextHealth);
      return nextHealth;
    } catch {
      const fallback = createPlannerHealthSnapshot({
        reachable: false,
        ready: false,
        disabled: false,
        error: getAiServerUnavailableMessage(),
      });
      setHealth(fallback);
      return fallback;
    }
  });

  const ensurePlan = useEffectEvent(async () => {
    if (!isHydrated) {
      return;
    }

    const syncedState = commit((draft) => {
      syncStateWithToday(draft);
    });

    if (!needsPlan(syncedState)) {
      return;
    }

    const clientHealth = createPlannerHealthSnapshot();
    if (clientHealth.disabled) {
      const message = clientHealth.error || "AI 추천 기능이 비활성화되어 있습니다.";
      setHealth(clientHealth);
      commit((draft) => {
        markPlanError(draft, message);
      });
      setErrorMessage(message);
      return;
    }

    const payload = createPlanPayload(syncedState);
    if (!payload) {
      return;
    }

    const requestKey = JSON.stringify(payload);
    if (activeRequestRef.current.promise && activeRequestRef.current.key === requestKey) {
      return activeRequestRef.current.promise;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsGenerating(true);
    setErrorMessage("");

    const run = (async () => {
      try {
        const result = await requestAiPlan(payload);
        if (requestIdRef.current !== requestId) {
          return;
        }

        setHealth((previous) => createPlannerHealthSnapshot({
          ...previous,
          reachable: true,
          ready: true,
          disabled: false,
          error: "",
        }));
        commit((draft) => {
          if (
            draft.currentDate !== payload.currentDate
            || serializeGoalItems(draft.goals) !== payload.goalSignature
          ) {
            return;
          }

          applyAiPlan(draft, result.plan, {
            model: result.model,
            source: result.cacheHit ? "cache" : "live",
          });
        });
        setErrorMessage("");
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        const message = error instanceof Error ? error.message : "오늘 계획 요청에 실패했습니다.";
        setHealth((previous) => createPlannerHealthSnapshot({
          ...previous,
          reachable: false,
          ready: false,
          disabled: false,
          error: message,
        }));
        commit((draft) => {
          markPlanError(draft, message);
        });
        setErrorMessage(message);
      } finally {
        if (requestIdRef.current === requestId) {
          setIsGenerating(false);
        }
      }
    })();

    activeRequestRef.current = {
      key: requestKey,
      promise: run.finally(() => {
        if (activeRequestRef.current.key === requestKey) {
          activeRequestRef.current = { key: "", promise: null };
        }
      }),
    };

    return activeRequestRef.current.promise;
  });

  const refreshForForeground = useEffectEvent(async () => {
    commit((draft) => {
      syncStateWithToday(draft);
    });
    await syncNotificationPermission();
    await ensurePlan();
  });

  useEffect(() => {
    let active = true;

    (async () => {
      const stored = await loadStoredState();
      const storedHolidays = await loadStoredHolidayMap();
      syncStateWithToday(stored);
      await saveStoredState(stored);

      if (!active) {
        return;
      }

      stateRef.current = stored;
      holidayYearsRef.current = storedHolidays;
      setState(stored);
      setHolidayYears(storedHolidays);
      setIsHydrated(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void ensurePlan();
    void syncNotificationPermission();
  }, [ensurePlan, isHydrated, syncNotificationPermission]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refreshForForeground();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isHydrated, refreshForForeground]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    let active = true;

    (async () => {
      const permission = await getNotificationPermissionStatus();
      if (!active) {
        return;
      }

      setNotificationPermission(permission);
      await syncDailyReminder({
        enabled: state.preferences.notificationsEnabled && permission === "granted",
        reminderTime: state.preferences.reminderTime,
        title: buildReminderTitle(state),
        body: buildReminderBody(state),
      });
    })();

    return () => {
      active = false;
    };
  }, [
    isHydrated,
    state.currentDate,
    state.goal,
    state.goals,
    state.insight,
    state.preferences.notificationsEnabled,
    state.preferences.reminderTime,
    state.tasks,
  ]);

  const getYearHolidays = useEffectEvent(async (year) => {
    const yearKey = String(year);
    if (Object.prototype.hasOwnProperty.call(holidayYearsRef.current, yearKey)) {
      return holidayYearsRef.current[yearKey];
    }

    const activeRequest = holidayRequestRef.current.get(yearKey);
    if (activeRequest) {
      return activeRequest;
    }

    const run = (async () => {
      const stored = await loadStoredHolidayYear(yearKey);
      if (Array.isArray(stored)) {
        holidayYearsRef.current = {
          ...holidayYearsRef.current,
          [yearKey]: stored,
        };
        startTransition(() => {
          setHolidayYears((previous) => ({
            ...previous,
            [yearKey]: stored,
          }));
        });
        return stored;
      }

      try {
        const holidays = await fetchHolidayYear(year);
        await saveStoredHolidayYear(yearKey, holidays);
        holidayYearsRef.current = {
          ...holidayYearsRef.current,
          [yearKey]: holidays,
        };
        startTransition(() => {
          setHolidayYears((previous) => ({
            ...previous,
            [yearKey]: holidays,
          }));
        });
        return holidays;
      } finally {
        holidayRequestRef.current.delete(yearKey);
      }
    })();

    holidayRequestRef.current.set(yearKey, run);
    return run;
  });

  const loadHolidays = useEffectEvent(async (years) => {
    const targets = Array.isArray(years) ? years : [years];
    const yearKeys = [...new Set(targets.map((year) => String(year)).filter(Boolean))];
    if (yearKeys.length === 0) {
      return;
    }

    setHolidayStatus({ loading: true, error: "" });

    try {
      await Promise.all(yearKeys.map((year) => getYearHolidays(year)));
      setHolidayStatus({ loading: false, error: "" });
    } catch (error) {
      setHolidayStatus({
        loading: false,
        error: error instanceof Error ? error.message : "공휴일 데이터를 가져오지 못했습니다.",
      });
    }
  });

  return {
    ready: isHydrated,
    state,
    health,
    isGenerating,
    errorMessage,
    notificationPermission,
    holidayYears,
    holidayStatus,
    setGoal(goals, difficulty) {
      commit((draft) => {
        syncStateWithToday(draft);
        updateGoalSettings(draft, goals, difficulty);
      });
      void ensurePlan();
    },
    addManualTask(title) {
      commit((draft) => {
        syncStateWithToday(draft);
        appendManualTask(draft, title);
      });
    },
    updateTaskStatus(taskId, status) {
      commit((draft) => {
        syncStateWithToday(draft);
        setTaskStatus(draft, taskId, status);
      });
    },
    updateManualTaskTitle(taskId, title) {
      commit((draft) => {
        syncStateWithToday(draft);
        renameManualTask(draft, taskId, title);
      });
    },
    deleteTask(taskId) {
      commit((draft) => {
        syncStateWithToday(draft);
        removeTask(draft, taskId);
      });
    },
    updateCalendarTaskStatus(dateKey, taskId, status) {
      commit((draft) => {
        syncStateWithToday(draft);
        setCalendarTaskStatus(draft, dateKey, taskId, status);
      });
    },
    updateCalendarTaskTitle(dateKey, taskId, title) {
      commit((draft) => {
        syncStateWithToday(draft);
        updateCalendarManualTaskTitle(draft, dateKey, taskId, title);
      });
    },
    deleteCalendarTask(dateKey, taskId) {
      commit((draft) => {
        syncStateWithToday(draft);
        removeCalendarTask(draft, dateKey, taskId);
      });
    },
    regenerate() {
      commit((draft) => {
        syncStateWithToday(draft);
        regenerateTodayPlan(draft);
      });
      void ensurePlan();
    },
    setTheme(theme) {
      commit((draft) => {
        updatePreferences(draft, { theme });
      });
    },
    setNotificationSettings(settings) {
      commit((draft) => {
        updatePreferences(draft, settings);
      });
    },
    setPlanningSettings(settings) {
      commit((draft) => {
        updatePreferences(draft, settings);
        syncStateWithToday(draft);
      });
      void ensurePlan();
    },
    async requestNotificationPermission() {
      const permission = await requestNotificationPermissionNative();
      setNotificationPermission(permission);
      return permission;
    },
    async reset() {
      requestIdRef.current += 1;
      activeRequestRef.current = { key: "", promise: null };
      await clearStoredState();
      await clearStoredHolidayMap();
      const nextState = createInitialState();
      stateRef.current = nextState;
      holidayYearsRef.current = {};
      startTransition(() => {
        setState(nextState);
        setHolidayYears({});
      });
      setIsGenerating(false);
      setErrorMessage("");
      setHolidayStatus({ loading: false, error: "" });
    },
    retryPlan() {
      void refreshHealth();
      void ensurePlan();
    },
    getYearHolidays,
    loadHolidays,
  };
}
