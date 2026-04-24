import { DEFAULT_DAILY_UPDATE_TIME } from "./config.js";

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeTimeValue(value, fallback = DEFAULT_DAILY_UPDATE_TIME) {
  const text = String(value || "");
  if (/^\d{2}:\d{2}$/u.test(text)) {
    const [hours, minutes] = text.split(":").map(Number);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return text;
    }
  }

  return fallback;
}

export function scheduledPlanDateKey(date = new Date(), updateTime = DEFAULT_DAILY_UPDATE_TIME) {
  const target = date instanceof Date ? date : new Date(date);
  const safeTarget = Number.isNaN(target.getTime()) ? new Date() : target;
  const [hours, minutes] = normalizeTimeValue(updateTime).split(":").map(Number);
  const updateBoundary = new Date(
    safeTarget.getFullYear(),
    safeTarget.getMonth(),
    safeTarget.getDate(),
    hours,
    minutes,
    0,
    0,
  );

  if (safeTarget < updateBoundary) {
    return todayKey(new Date(safeTarget.getFullYear(), safeTarget.getMonth(), safeTarget.getDate() - 1, 12));
  }

  return todayKey(safeTarget);
}

export function formatDisplayDate(dateKey) {
  if (!dateKey) {
    return "";
  }

  const target = new Date(`${dateKey}T12:00:00`);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${target.getFullYear()}년 ${target.getMonth() + 1}월 ${target.getDate()}일 ${weekdays[target.getDay()]}요일`;
}

export function shortenGoal(goal, maxLength = 36) {
  const text = String(goal || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trim()}...`;
}

export function getPhase(dateKey) {
  const target = new Date(`${dateKey}T12:00:00`);
  const yearStart = new Date(target.getFullYear(), 0, 1);
  const yearEnd = new Date(target.getFullYear(), 11, 31);
  const passed = Math.floor((target - yearStart) / 86400000);
  const total = Math.floor((yearEnd - yearStart) / 86400000) + 1;
  const ratio = passed / total;

  if (ratio < 0.25) {
    return "foundation";
  }
  if (ratio < 0.6) {
    return "build";
  }
  if (ratio < 0.85) {
    return "accelerate";
  }
  return "finish";
}

export function getPhaseLabel(phase) {
  const labels = {
    foundation: "기반을 세우는 구간",
    build: "속도를 붙이는 구간",
    accelerate: "성과를 끌어올리는 구간",
    finish: "마무리에 집중하는 구간",
  };
  return labels[phase] || "집중 실행 구간";
}

export function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
