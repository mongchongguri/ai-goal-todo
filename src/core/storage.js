import { STORAGE_KEY } from "./config.js";
import { createInitialState, normalizeState } from "./planner.js";

export function loadState() {
  if (typeof localStorage === "undefined") {
    return createInitialState();
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialState();
    }
    return normalizeState(JSON.parse(raw));
  } catch {
    return createInitialState();
  }
}

export function saveState(state) {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
