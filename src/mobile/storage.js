import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEY } from "../core/config.js";
import { createInitialState, normalizeState } from "../core/planner.js";

export async function loadStoredState() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialState();
    }

    return normalizeState(JSON.parse(raw));
  } catch {
    return createInitialState();
  }
}

export async function saveStoredState(state) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore persistence failures and keep in-memory state usable.
  }
}

export async function clearStoredState() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore clear failures.
  }
}
