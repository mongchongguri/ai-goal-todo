import { AppState } from "react-native";
import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import { createPlannerHealthSnapshot, fetchPlannerHealth, getAiServerUnavailableMessage, requestAiPlan } from "../core/ai.js";
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
import { clearStoredState, loadStoredState, saveStoredState } from "./storage.js";
import {
  getNotificationPermissionStatus,
  requestNotificationPermission as requestNotificationPermissionNative,
  syncDailyReminder,
} from "./notifications.js";

function cloneState(state) {
  return normalizeState(JSON.parse(JSON.stringify(state)));
}

function buildReminderTitle(state) {
  return state.goal.trim() ? "오늘 할 일을 확인해보세요" : "먼저 올해 목표를 설정해보세요";
}

function buildReminderBody(state) {
  if (!state.goal.trim()) {
    return "목표를 입력하면 오늘 처리할 일을 자동으로 추천해드립니다.";
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
  const stateRef = useRef(state);
  const requestIdRef = useRef(0);
  const activeRequestRef = useRef({ key: "", promise: null });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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
      const nextHealth = await refreshHealth();
      if (!nextHealth.ready) {
        const message = nextHealth.error || "AI 추천 준비가 아직 완료되지 않았습니다.";
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
          if (draft.goal !== payload.goal || draft.currentDate !== payload.currentDate) {
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
    await ensurePlan();
    await syncNotificationPermission();
  });

  useEffect(() => {
    let active = true;

    (async () => {
      const stored = await loadStoredState();
      syncStateWithToday(stored);
      await saveStoredState(stored);

      if (!active) {
        return;
      }

      stateRef.current = stored;
      setState(stored);
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

    void refreshHealth();
    void ensurePlan();
    void syncNotificationPermission();
  }, [ensurePlan, isHydrated, refreshHealth, syncNotificationPermission]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refreshForForeground();
      }
    });

    const timerId = setInterval(() => {
      void refreshForForeground();
    }, 60000);

    return () => {
      subscription.remove();
      clearInterval(timerId);
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
    state.insight,
    state.preferences.notificationsEnabled,
    state.preferences.reminderTime,
    state.tasks,
  ]);

  return {
    ready: isHydrated,
    state,
    health,
    isGenerating,
    errorMessage,
    notificationPermission,
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
      const nextState = createInitialState();
      stateRef.current = nextState;
      startTransition(() => {
        setState(nextState);
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
