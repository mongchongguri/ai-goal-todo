import { dateToKey, getCalendarCellCount, getFirstCalendarCell, getLastCalendarCell, weekdayTone } from "./date.js";

export function summarizeTasks(tasks) {
  return tasks.reduce((summary, task) => {
    if (task.status === "done") {
      summary.done += 1;
    } else if (task.status === "failed") {
      summary.failed += 1;
    } else {
      summary.pending += 1;
    }

    return summary;
  }, { done: 0, failed: 0, pending: 0 });
}

function normalizeEntryTasks(tasks = [], dateKey = "") {
  return tasks.map((task, index) => ({
    id: task.id ?? `${dateKey}-${index}`,
    title: task.title,
    status: task.status === "missed" ? "pending" : task.status,
    note: task.note || "",
    manual: Boolean(task.manual),
    source: task.source || "ai",
    carryoverCount: task.carryoverCount || 0,
  }));
}

export function buildEntries(history, currentDate, currentTasks) {
  const map = new Map();

  history.forEach((entry) => {
    map.set(entry.date, normalizeEntryTasks(entry.tasks, entry.date));
  });

  map.set(currentDate, normalizeEntryTasks(currentTasks, currentDate));
  return map;
}

export function buildHolidayMap(holidayYears) {
  const map = new Map();

  Object.values(holidayYears).flat().forEach((holiday) => {
    const list = map.get(holiday.date) || [];
    list.push(holiday);
    map.set(holiday.date, list);
  });

  return map;
}

export function normalizeHolidayList(holidays = []) {
  return holidays
    .map((holiday) => ({
      date: holiday.date,
      localName: holiday.localName || holiday.name || "공휴일",
      name: holiday.name || holiday.localName || "Holiday",
      types: Array.isArray(holiday.types) ? holiday.types : [],
    }))
    .filter((holiday) => /^\d{4}-\d{2}-\d{2}$/u.test(holiday.date));
}

export function buildCalendarDays(viewDate, entries, currentDate, showCompleted, holidayMap) {
  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1, 12);
  const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 12);
  const firstCell = getFirstCalendarCell(viewDate);
  const lastCell = getLastCalendarCell(viewDate);
  const cellCount = getCalendarCellCount(firstCell, lastCell);
  const days = [];

  for (let index = 0; index < cellCount; index += 1) {
    const cellDate = new Date(firstCell);
    cellDate.setDate(firstCell.getDate() + index);

    const dateKey = dateToKey(cellDate);
    const sourceTasks = entries.get(dateKey) || [];
    const tasks = showCompleted ? sourceTasks : sourceTasks.filter((task) => task.status !== "done");
    const holidays = holidayMap.get(dateKey) || [];

    days.push({
      date: cellDate,
      dateKey,
      dayNumber: cellDate.getDate(),
      tone: weekdayTone(cellDate.getDay()),
      isCurrentMonth: cellDate >= monthStart && cellDate <= monthEnd,
      isToday: dateKey === currentDate,
      isHoliday: holidays.length > 0,
      holidays,
      tasks,
      summary: summarizeTasks(sourceTasks),
    });
  }

  return days;
}
