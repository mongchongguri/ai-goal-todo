import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import { STORAGE_KEY } from "../core/config.js";
import { createPlannerHealthSnapshot, fetchPlannerHealth, getAiServerUnavailableMessage, requestAiPlan } from "../core/ai.js";
import { getGoalCounts, serializeGoalItems } from "../core/goals.js";
import {
  applyAiPlan,
  appendManualTask,
  createInitialState,
  createPlanPayload,
  markNotificationSent,
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
  updateManualTaskTitle as renameManualTask,
  updateGoalSettings,
  updatePreferences,
} from "../core/planner.js";
import { loadState, saveState } from "../core/storage.js";
import { todayKey } from "../core/utils.js";

function initializeState() {
  const state = normalizeState(loadState());
  syncStateWithToday(state);
  saveState(state);
  return state;
}

function readNotificationPermission() {
  if (typeof Notification === "undefined") {
    return "unsupported";
  }

  return Notification.permission;
}

function toMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/u.exec(String(value || ""));
  if (!match) {
    return 21 * 60;
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  return (hours * 60) + minutes;
}

function buildReminderBody(state) {
  const goalCounts = getGoalCounts(state.goals, state.goal);
  if (goalCounts.active === 0) {
    return goalCounts.success > 0
      ? "성공한 목표만 남아 있습니다. 새 진행중 목표를 추가하면 오늘 할 일을 다시 추천합니다."
      : "설정 탭에서 올해 목표를 입력하면 오늘 할 일을 자동으로 추천합니다.";
  }

  const pendingTasks = state.tasks.filter((task) => task.status !== "done");
  if (pendingTasks.length === 0) {
    return "오늘 계획을 거의 마쳤습니다. 남은 일정이 있는지 한 번 더 확인해 보세요.";
  }

  if (pendingTasks.length === 1) {
    return `남은 할 일 1개: ${pendingTasks[0].title}`;
  }

  return `남은 할 일 ${pendingTasks.length}개가 있습니다. 우선순위부터 확인해 보세요.`;
}

export function usePlannerStore() {
  const [state, setState] = useState(initializeState);
  const [health, setHealth] = useState(() => createPlannerHealthSnapshot());
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notificationPermission, setNotificationPermission] = useState(readNotificationPermission);
  const stateRef = useRef(state);
  const requestIdRef = useRef(0);
  const activeRequestRef = useRef({ key: "", promise: null });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = state.preferences.theme;
    }
  }, [state.preferences.theme]);

  const commit = useEffectEvent((recipe) => {
    const draft = normalizeState(stateRef.current);
    recipe(draft);
    stateRef.current = draft;
    saveState(draft);
    startTransition(() => {
      setState(draft);
    });
    return draft;
  });

  const refreshHealth = useEffectEvent(async () => {
    try {
      const nextHealth = await fetchPlannerHealth();
      setHealth(nextHealth);
      return nextHealth;
    } catch (error) {
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
    const syncedState = commit((draft) => {
      syncStateWithToday(draft);
    });

    if (!needsPlan(syncedState)) {
      return;
    }

    const clientHealth = createPlannerHealthSnapshot();
    if (clientHealth.disabled) {
      const message = clientHealth.error || "AI 추천 기능이 비활성화되었습니다.";
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
      const nextHealth = await refreshHealth();
      if (!nextHealth.ready) {
        const message = nextHealth.error || "AI 추천 엔진이 아직 준비되지 않았습니다.";
        commit((draft) => {
          markPlanError(draft, message);
        });
        setErrorMessage(message);
        return;
      }

      try {
        const result = await requestAiPlan(payload);
        if (requestIdRef.current !== requestId) {
          return;
        }

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
        const message = error instanceof Error ? error.message : "오늘 계획 요청에 실패했습니다.";
        if (requestIdRef.current !== requestId) {
          return;
        }
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

  const syncNotificationPermission = useEffectEvent(() => {
    setNotificationPermission(readNotificationPermission());
  });

  const maybeSendReminder = useEffectEvent(() => {
    const current = stateRef.current;
    const { notificationsEnabled, reminderTime, lastNotificationDate } = current.preferences;

    if (!notificationsEnabled || readNotificationPermission() !== "granted" || typeof Notification === "undefined") {
      return;
    }

    const now = new Date();
    const nowMinutes = (now.getHours() * 60) + now.getMinutes();
    const targetMinutes = toMinutes(reminderTime);
    const today = todayKey(now);

    if (nowMinutes < targetMinutes || lastNotificationDate === today) {
      return;
    }

    const title = getGoalCounts(current.goals, current.goal).active > 0
      ? "오늘 계획을 확인해 보세요"
      : "진행중인 목표를 먼저 설정해 보세요";
    const body = buildReminderBody(current);
    new Notification(title, {
      body,
      tag: `goal-planner-${today}`,
    });

    commit((draft) => {
      markNotificationSent(draft, today);
    });
  });

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      const next = normalizeState(event.newValue ? JSON.parse(event.newValue) : createInitialState());
      syncStateWithToday(next);
      stateRef.current = next;
      saveState(next);
      startTransition(() => {
        setState(next);
      });

      if (needsPlan(next)) {
        void ensurePlan();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const refreshForDateChange = useEffectEvent(async () => {
    commit((draft) => {
      syncStateWithToday(draft);
    });
    await ensurePlan();
  });

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        syncNotificationPermission();
        void refreshForDateChange();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", syncNotificationPermission);

    const timerId = window.setInterval(() => {
      void refreshForDateChange();
      maybeSendReminder();
    }, 60000);

    maybeSendReminder();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", syncNotificationPermission);
      window.clearInterval(timerId);
    };
  }, [maybeSendReminder, refreshForDateChange, syncNotificationPermission]);

  useEffect(() => {
    void refreshHealth();
    void ensurePlan();
    syncNotificationPermission();
  }, []);

  return {
    state,
    health,
    isGenerating,
    errorMessage,
    notificationPermission,
    setGoal(goal, difficulty) {
      commit((draft) => {
        syncStateWithToday(draft);
        updateGoalSettings(draft, goal, difficulty);
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
      maybeSendReminder();
    },
    setPlanningSettings(settings) {
      commit((draft) => {
        updatePreferences(draft, settings);
        syncStateWithToday(draft);
      });
      void ensurePlan();
    },
    setCalendarSettings(settings) {
      commit((draft) => {
        updatePreferences(draft, settings);
      });
    },
    async requestNotificationPermission() {
      if (typeof Notification === "undefined") {
        setNotificationPermission("unsupported");
        return "unsupported";
      }

      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission;
    },
    reset() {
      requestIdRef.current += 1;
      activeRequestRef.current = { key: "", promise: null };
      const next = createInitialState();
      saveState(next);
      stateRef.current = next;
      startTransition(() => {
        setState(next);
      });
      setIsGenerating(false);
      setErrorMessage("");
    },
    retryPlan() {
      void refreshHealth();
      void ensurePlan();
    },
  };
}
