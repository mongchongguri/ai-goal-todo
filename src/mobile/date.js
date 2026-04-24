import { todayKey } from "../core/utils.js";

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const WEEKDAY_SHORT = ["일", "월", "화", "수", "목", "금", "토"];

export function parseDateKey(dateKey) {
  return new Date(`${dateKey}T12:00:00`);
}

export function dateToKey(date) {
  return todayKey(date);
}

export function createMonthAnchor(dateKey) {
  const base = parseDateKey(dateKey);
  return new Date(base.getFullYear(), base.getMonth(), 1, 12);
}

export function shiftMonth(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

export function formatMonthLabel(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

export function formatDisplayDate(dateKey) {
  const date = parseDateKey(dateKey);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}`;
}

export function formatTimeLabel(timeValue) {
  const [hoursText, minutesText] = String(timeValue || "09:00").split(":");
  const hours = Number.parseInt(hoursText, 10);
  const minutes = Number.parseInt(minutesText, 10);
  const period = hours >= 12 ? "오후" : "오전";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${period} ${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function timeValueToDate(timeValue) {
  const [hoursText, minutesText] = String(timeValue || "09:00").split(":");
  const now = new Date();
  now.setHours(Number.parseInt(hoursText, 10), Number.parseInt(minutesText, 10), 0, 0);
  return now;
}

export function dateToTimeValue(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function weekdayShortLabel(index) {
  return WEEKDAY_SHORT[index];
}

export function weekdayTone(dayOfWeek) {
  if (dayOfWeek === 0) {
    return "sunday";
  }

  if (dayOfWeek === 6) {
    return "saturday";
  }

  return "default";
}

export function getFirstCalendarCell(viewDate) {
  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1, 12);
  const offset = monthStart.getDay();
  const firstCell = new Date(monthStart);
  firstCell.setDate(monthStart.getDate() - offset);
  return firstCell;
}

export function getLastCalendarCell(viewDate) {
  const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 12);
  const offset = 6 - monthEnd.getDay();
  const lastCell = new Date(monthEnd);
  lastCell.setDate(monthEnd.getDate() + offset);
  return lastCell;
}

export function getCalendarCellCount(firstCell, lastCell) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((lastCell.getTime() - firstCell.getTime()) / dayMs) + 1;
}

export function getVisibleYears(viewDate) {
  const years = new Set();
  const firstCell = getFirstCalendarCell(viewDate);
  const lastCell = getLastCalendarCell(viewDate);
  const cellCount = getCalendarCellCount(firstCell, lastCell);

  for (let index = 0; index < cellCount; index += 1) {
    const current = new Date(firstCell);
    current.setDate(firstCell.getDate() + index);
    years.add(current.getFullYear());
  }

  return Array.from(years).sort((left, right) => left - right);
}
