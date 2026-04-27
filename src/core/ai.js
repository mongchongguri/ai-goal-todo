import { apiUrl, getApiBaseUrl, getApiDisabledReason, hasApiBackend } from "./api.js";

const AI_SERVER_UNAVAILABLE_MESSAGE = "현재 서버에 접근할 수 없어 AI 상태 확인 및 추천 기능을 사용할 수 없습니다.";
const AI_SERVER_FETCH_FAILED_MESSAGE = "현재 서버에 접근할 수 없어 AI 상태 확인 및 추천 기능을 사용할 수 없습니다.";
const AI_HEALTH_FAILED_MESSAGE = "AI 서버 상태를 확인하지 못했습니다.";
const AI_PLAN_FAILED_MESSAGE = "오늘 계획을 가져오지 못했습니다.";
const AI_TIMEOUT_MESSAGE = "서버 응답 시간이 너무 오래 걸립니다.";

export function createPlannerHealthSnapshot(overrides = {}) {
  const backendAvailable = hasApiBackend();

  return {
    provider: "gemini",
    reachable: backendAvailable,
    ready: backendAvailable,
    disabled: !backendAvailable,
    baseURL: getApiBaseUrl(),
    configuredModel: "",
    model: "",
    cacheEnabled: backendAvailable,
    error: backendAvailable ? "" : getApiDisabledReason(),
    ...overrides,
  };
}

export async function fetchPlannerHealth() {
  if (!hasApiBackend()) {
    return createPlannerHealthSnapshot();
  }

  const response = await fetchWithTimeout(apiUrl("/api/health"));
  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(payload?.error || AI_HEALTH_FAILED_MESSAGE);
  }

  return createPlannerHealthSnapshot({
    ...payload,
    disabled: false,
  });
}

export async function requestAiPlan(body) {
  if (!hasApiBackend()) {
    throw new Error(AI_SERVER_UNAVAILABLE_MESSAGE);
  }

  const response = await fetchWithTimeout(apiUrl("/api/plan"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(payload?.error || AI_PLAN_FAILED_MESSAGE);
  }

  return payload;
}

export function getAiServerUnavailableMessage() {
  return AI_SERVER_UNAVAILABLE_MESSAGE;
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(input, init, timeoutMs = 10000) {
  const controller = new AbortController();
  const timerId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(AI_TIMEOUT_MESSAGE);
    }

    if (isNetworkRequestError(error)) {
      throw new Error(AI_SERVER_FETCH_FAILED_MESSAGE);
    }

    throw error;
  } finally {
    clearTimeout(timerId);
  }
}

function isNetworkRequestError(error) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error instanceof TypeError) {
    return true;
  }

  return /failed to fetch|network request failed|load failed/i.test(error.message);
}
