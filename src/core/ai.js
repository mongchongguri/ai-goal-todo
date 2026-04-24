import { apiUrl, getApiBaseUrl, getApiDisabledReason, hasApiBackend } from "./api.js";

const AI_SERVER_UNAVAILABLE_MESSAGE = "현재 서버에 접근할 수 없어 AI 상태 확인 및 추천 기능을 사용할 수 없습니다.";

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

  const response = await fetch(apiUrl("/api/health"));
  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(payload?.error || "AI 서버 상태를 확인하지 못했습니다.");
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

  const response = await fetch(apiUrl("/api/plan"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(payload?.error || "오늘 계획을 가져오지 못했습니다.");
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
