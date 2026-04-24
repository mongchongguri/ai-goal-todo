import { useEffect, useMemo, useRef, useState } from "react";
import { fetchPublicHolidays } from "../core/holidays.js";
import { formatDisplayDate, todayKey } from "../core/utils.js";
import { TaskItem } from "./MainTab.jsx";

const HOLIDAY_COUNTRY = "KR";

const WEEKDAYS = {
  monday: ["월", "화", "수", "목", "금", "토", "일"],
  sunday: ["일", "월", "화", "수", "목", "금", "토"],
};

function createMonthAnchor(dateKey) {
  return new Date(`${dateKey}T12:00:00`);
}

function shiftMonth(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

function formatMonthLabel(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function dateToKey(date) {
  return todayKey(date);
}

function weekdayTone(dayOfWeek) {
  if (dayOfWeek === 0) {
    return "is-sunday";
  }
  if (dayOfWeek === 6) {
    return "is-saturday";
  }
  return "";
}

function summarizeTasks(tasks) {
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
  }));
}

function buildEntries(history, currentDate, currentTasks) {
  const map = new Map();

  history.forEach((entry) => {
    map.set(entry.date, normalizeEntryTasks(entry.tasks, entry.date));
  });

  map.set(currentDate, normalizeEntryTasks(currentTasks, currentDate));
  return map;
}

function filterTasks(tasks, preferences) {
  if (preferences.showCompletedInCalendar) {
    return tasks;
  }

  return tasks.filter((task) => task.status !== "done");
}

function getMonthStartOffset(monthStart, startOfWeek) {
  const day = monthStart.getDay();
  return startOfWeek === "monday" ? (day + 6) % 7 : day;
}

function getFirstCalendarCell(viewDate, startOfWeek) {
  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1, 12);
  const offset = getMonthStartOffset(monthStart, startOfWeek);
  const firstCell = new Date(monthStart);
  firstCell.setDate(monthStart.getDate() - offset);
  return firstCell;
}

function getLastCalendarCell(viewDate, startOfWeek) {
  const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 12);
  const offset = 6 - getMonthStartOffset(monthEnd, startOfWeek);
  const lastCell = new Date(monthEnd);
  lastCell.setDate(monthEnd.getDate() + offset);
  return lastCell;
}

function getCalendarCellCount(firstCell, lastCell) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((lastCell.getTime() - firstCell.getTime()) / dayMs) + 1;
}

function getVisibleYears(viewDate, startOfWeek) {
  const years = new Set();
  const firstCell = getFirstCalendarCell(viewDate, startOfWeek);
  const lastCell = getLastCalendarCell(viewDate, startOfWeek);
  const cellCount = getCalendarCellCount(firstCell, lastCell);

  for (let index = 0; index < cellCount; index += 1) {
    const cellDate = new Date(firstCell);
    cellDate.setDate(firstCell.getDate() + index);
    years.add(cellDate.getFullYear());
  }

  return Array.from(years).sort((left, right) => left - right);
}

function buildHolidayMap(holidayYears) {
  const map = new Map();

  Object.values(holidayYears).flat().forEach((holiday) => {
    const list = map.get(holiday.date) || [];
    list.push(holiday);
    map.set(holiday.date, list);
  });

  return map;
}

function normalizeHolidayList(holidays = []) {
  return holidays
    .map((holiday) => ({
      date: holiday.date,
      localName: holiday.localName || holiday.name || "공휴일",
      name: holiday.name || holiday.localName || "Holiday",
      types: Array.isArray(holiday.types) ? holiday.types : [],
    }))
    .filter((holiday) => /^\d{4}-\d{2}-\d{2}$/u.test(holiday.date));
}

function buildCalendarDays(viewDate, entries, currentDate, preferences, holidayMap) {
  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1, 12);
  const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 12);
  const days = [];
  const firstCell = getFirstCalendarCell(viewDate, preferences.startOfWeek);
  const lastCell = getLastCalendarCell(viewDate, preferences.startOfWeek);
  const cellCount = getCalendarCellCount(firstCell, lastCell);

  for (let index = 0; index < cellCount; index += 1) {
    const cellDate = new Date(firstCell);
    cellDate.setDate(firstCell.getDate() + index);

    const dateKey = dateToKey(cellDate);
    const rawTasks = entries.get(dateKey) || [];
    const summary = summarizeTasks(rawTasks);
    const tasks = filterTasks(rawTasks, preferences);
    const holidays = holidayMap.get(dateKey) || [];

    days.push({
      date: cellDate,
      dateKey,
      dayNumber: cellDate.getDate(),
      dayTone: weekdayTone(cellDate.getDay()),
      isSaturday: cellDate.getDay() === 6,
      isSunday: cellDate.getDay() === 0,
      isCurrentMonth: cellDate >= monthStart && cellDate <= monthEnd,
      isToday: dateKey === currentDate,
      isHoliday: holidays.length > 0,
      holidays,
      tasks,
      summary,
    });
  }

  return days;
}

export function CalendarTab({
  currentDate,
  currentTasks,
  history,
  preferences,
  onUpdateTaskStatus,
  onUpdateTaskTitle,
  onDeleteTask,
}) {
  const [viewDate, setViewDate] = useState(() => createMonthAnchor(currentDate));
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [holidayYears, setHolidayYears] = useState({});
  const [holidayStatus, setHolidayStatus] = useState({ loading: false, error: "" });
  const monthSwipeRef = useRef({ x: 0, y: 0, didSwipe: false });

  useEffect(() => {
    setViewDate(createMonthAnchor(currentDate));
    setSelectedDate(currentDate);
  }, [currentDate]);

  const entries = useMemo(
    () => buildEntries(history, currentDate, currentTasks),
    [history, currentDate, currentTasks],
  );

  const visibleYears = useMemo(
    () => getVisibleYears(viewDate, preferences.startOfWeek),
    [viewDate, preferences.startOfWeek],
  );

  useEffect(() => {
    const missingYears = visibleYears.filter((year) => !holidayYears[year]);
    if (missingYears.length === 0) {
      return undefined;
    }

    let active = true;
    setHolidayStatus({ loading: true, error: "" });

    Promise.all(
      missingYears.map((year) => (
        fetchPublicHolidays(year, HOLIDAY_COUNTRY)
          .then((payload) => [year, normalizeHolidayList(payload.holidays)])
      )),
    )
      .then((results) => {
        if (!active) {
          return;
        }

        setHolidayYears((previous) => {
          const next = { ...previous };
          results.forEach(([year, holidays]) => {
            next[year] = holidays;
          });
          return next;
        });
        setHolidayStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setHolidayStatus({
          loading: false,
          error: error instanceof Error ? error.message : "공휴일 데이터를 가져오지 못했습니다.",
        });
      });

    return () => {
      active = false;
    };
  }, [holidayYears, visibleYears]);

  const holidayMap = useMemo(
    () => buildHolidayMap(holidayYears),
    [holidayYears],
  );

  const days = useMemo(
    () => buildCalendarDays(viewDate, entries, currentDate, preferences, holidayMap),
    [viewDate, entries, currentDate, preferences, holidayMap],
  );

  const selectedEntry = days.find((day) => day.dateKey === selectedDate)
    || {
      dateKey: selectedDate,
      holidays: holidayMap.get(selectedDate) || [],
      tasks: [],
      summary: { done: 0, failed: 0, pending: 0 },
    };
  const selectedTaskCount = selectedEntry.summary.done + selectedEntry.summary.pending + selectedEntry.summary.failed;
  const selectedIncompleteCount = selectedEntry.summary.pending + selectedEntry.summary.failed;

  const monthTasks = days.reduce((sum, day) => (day.isCurrentMonth ? sum + day.summary.done + day.summary.pending + day.summary.failed : sum), 0);
  const monthIncomplete = days.reduce((sum, day) => (day.isCurrentMonth ? sum + day.summary.pending + day.summary.failed : sum), 0);
  const monthDone = days.reduce((sum, day) => (day.isCurrentMonth ? sum + day.summary.done : sum), 0);

  const moveMonth = (amount) => {
    const nextDate = shiftMonth(viewDate, amount);
    setViewDate(nextDate);
    setSelectedDate(dateToKey(nextDate));
  };

  const goToToday = () => {
    setViewDate(createMonthAnchor(currentDate));
    setSelectedDate(currentDate);
  };

  const handleMonthSwipeStart = (event) => {
    monthSwipeRef.current = {
      x: event.clientX,
      y: event.clientY,
      didSwipe: false,
    };
  };

  const handleMonthSwipeEnd = (event) => {
    const deltaX = event.clientX - monthSwipeRef.current.x;
    const deltaY = Math.abs(event.clientY - monthSwipeRef.current.y);
    if (Math.abs(deltaX) < 48 || deltaY > 42) {
      return;
    }

    monthSwipeRef.current.didSwipe = true;
    moveMonth(deltaX < 0 ? 1 : -1);
    window.setTimeout(() => {
      monthSwipeRef.current.didSwipe = false;
    }, 250);
  };

  const selectDate = (dateKey) => {
    if (monthSwipeRef.current.didSwipe) {
      monthSwipeRef.current.didSwipe = false;
      return;
    }

    setSelectedDate(dateKey);
  };

  return (
    <div className="tab-stack">
      <section className="section-shell">
        <div className="calendar-head">
          <div className="calendar-month-nav">
            <button className="calendar-month-button" type="button" onClick={() => moveMonth(-1)} aria-label="이전 달">
              ‹
            </button>
            <h2 className="calendar-month-title">{formatMonthLabel(viewDate)}</h2>
            <button className="calendar-month-button" type="button" onClick={() => moveMonth(1)} aria-label="다음 달">
              ›
            </button>
          </div>
          <button className="calendar-today-button" type="button" onClick={goToToday}>
            오늘
          </button>
        </div>

        <div className="calendar-stats-grid">
          <article className="mini-stat-card">
            <strong>{monthTasks}개</strong>
            <p>할일</p>
          </article>
          <article className="mini-stat-card">
            <strong>{monthDone}개</strong>
            <p>완료</p>
          </article>
          <article className="mini-stat-card">
            <strong>{monthIncomplete}개</strong>
            <p>미완료</p>
          </article>
        </div>
      </section>

      <section className="section-shell calendar-shell">
        <div
          className="calendar-grid-wrap"
          onPointerDown={handleMonthSwipeStart}
          onPointerUp={handleMonthSwipeEnd}
        >
          <div className="weekday-row">
            {WEEKDAYS[preferences.startOfWeek].map((day, index) => {
              const dayOfWeek = preferences.startOfWeek === "monday" ? (index + 1) % 7 : index;
              return (
                <div key={day} className={["weekday-label", weekdayTone(dayOfWeek)].filter(Boolean).join(" ")}>
                  {day}
                </div>
              );
            })}
          </div>

          <div className="calendar-grid">
            {days.map((day) => (
              <button
                key={day.dateKey}
                className={[
                  "calendar-day",
                  day.isCurrentMonth ? "" : "is-outside",
                  day.isToday ? "is-today" : "",
                  day.dayTone,
                  day.isHoliday ? "is-holiday" : "",
                  day.dateKey === selectedDate ? "is-selected" : "",
                ].filter(Boolean).join(" ")}
                type="button"
                onClick={() => selectDate(day.dateKey)}
              >
                <div className="calendar-day-topline">
                  <span className="calendar-day-number">{day.dayNumber}</span>
                </div>

                {day.holidays[0] && <span className="calendar-holiday-name">{day.holidays[0].localName}</span>}

                <div className="calendar-day-summary">
                  <div className="calendar-day-tags">
                    {day.tasks.length > 0 && <span className="calendar-chip pending">{`할일 ${day.tasks.length}`}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell">
        <div className="section-head calendar-detail-head">
          <div>
            <p className="section-label">선택 날짜</p>
            <h2 className="calendar-selected-title">{formatDisplayDate(selectedEntry.dateKey)}</h2>
          </div>
          <div className="detail-toolbar">
            {selectedEntry.holidays.length > 0 && <span className="panel-chip holiday-chip">공휴일</span>}
            <span className="panel-chip">{`할일 ${selectedTaskCount}`}</span>
            <span className="panel-chip">{`완료 ${selectedEntry.summary.done}`}</span>
            <span className="panel-chip">{`미완료 ${selectedIncompleteCount}`}</span>
          </div>
        </div>

        {selectedEntry.holidays.length > 0 && (
          <div className="holiday-detail-list">
            {selectedEntry.holidays.map((holiday) => (
              <article key={`${holiday.date}-${holiday.localName}`} className="holiday-detail-card">
                <strong>{holiday.localName}</strong>
                <p>{holiday.name}</p>
              </article>
            ))}
          </div>
        )}

        {selectedEntry.tasks.length === 0 ? (
          <div className="empty-state-card">
            <strong>기록된 일정 없음</strong>
            <p>{selectedEntry.holidays.length > 0 ? "공휴일 정보만 표시 중이며 저장된 할 일은 없습니다." : "선택한 날짜에 저장된 할 일이 없습니다."}</p>
          </div>
        ) : (
          <div className="calendar-task-list">
            {selectedEntry.tasks.map((task) => (
              <TaskItem
                key={`${selectedEntry.dateKey}-${task.id}`}
                task={task}
                onToggleDone={(taskId, status) => onUpdateTaskStatus(selectedEntry.dateKey, taskId, status)}
                onUpdateTitle={(taskId, title) => onUpdateTaskTitle(selectedEntry.dateKey, taskId, title)}
                onDelete={(taskId) => onDeleteTask(selectedEntry.dateKey, taskId)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
