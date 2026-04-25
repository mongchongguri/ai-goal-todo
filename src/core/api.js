const DEFAULT_API_BASE_URL = "https://ai-goal-todo-production.up.railway.app";

function readApiBaseUrl() {
  if (typeof process !== "undefined" && process.env) {
    const expoValue = process.env.EXPO_PUBLIC_API_BASE_URL;
    const viteValue = process.env.VITE_API_BASE_URL;
    return String(expoValue || viteValue || DEFAULT_API_BASE_URL).replace(/\/+$/u, "");
  }

  return DEFAULT_API_BASE_URL;
}

const API_BASE_URL = readApiBaseUrl();

function isNativeAppRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  const capacitor = window.Capacitor;
  if (capacitor) {
    if (typeof capacitor.isNativePlatform === "function") {
      return capacitor.isNativePlatform();
    }

    if (capacitor.platform && capacitor.platform !== "web") {
      return true;
    }
  }

  return window.location.hostname === "localhost"
    && !window.location.port
    && ["https:", "capacitor:", "ionic:"].includes(window.location.protocol);
}

export function hasApiBackend() {
  return Boolean(API_BASE_URL) || !isNativeAppRuntime();
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function getApiDisabledReason() {
  return hasApiBackend() ? "" : "현재 서버에 접근할 수 없어 AI 상태 확인 및 추천 기능을 사용할 수 없습니다.";
}

export function apiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}
