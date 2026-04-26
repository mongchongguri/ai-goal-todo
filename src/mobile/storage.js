import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEY } from "../core/config.js";
import { createInitialState, normalizeState } from "../core/planner.js";

const HOLIDAY_STORAGE_KEY = `${STORAGE_KEY}:holidays`;

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

export async function loadStoredHolidayMap() {
  try {
    const raw = await AsyncStorage.getItem(HOLIDAY_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function loadStoredHolidayYear(year) {
  const holidayMap = await loadStoredHolidayMap();
  const cached = holidayMap[String(year)];
  return Array.isArray(cached) ? cached : null;
}

export async function saveStoredHolidayYear(year, holidays) {
  try {
    const holidayMap = await loadStoredHolidayMap();
    holidayMap[String(year)] = Array.isArray(holidays) ? holidays : [];
    await AsyncStorage.setItem(HOLIDAY_STORAGE_KEY, JSON.stringify(holidayMap));
  } catch {
    // Ignore cache persistence failures.
  }
}

export async function clearStoredHolidayMap() {
  try {
    await AsyncStorage.removeItem(HOLIDAY_STORAGE_KEY);
  } catch {
    // Ignore clear failures.
  }
}
