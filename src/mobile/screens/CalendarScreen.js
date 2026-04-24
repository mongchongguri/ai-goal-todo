import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fetchPublicHolidays } from "../../core/holidays.js";
import { buildCalendarDays, buildEntries, buildHolidayMap, normalizeHolidayList } from "../calendar.js";
import { createMonthAnchor, formatDisplayDate, formatMonthLabel, getVisibleYears, shiftMonth, weekdayShortLabel } from "../date.js";
import { Chip, EmptyStateCard, SectionCard, StatCard, StatusBanner } from "../components/Surface.js";
import { TaskCard } from "../components/TaskCard.js";

const HOLIDAY_COUNTRY = "KR";

export function CalendarScreen({
  palette,
  currentDate,
  currentTasks,
  history,
  preferences,
  onUpdateTaskStatus,
  onUpdateTaskTitle,
  onDeleteTask,
}) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [viewDate, setViewDate] = useState(() => createMonthAnchor(currentDate));
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [holidayYears, setHolidayYears] = useState({});
  const [holidayStatus, setHolidayStatus] = useState({ loading: false, error: "" });
  const swipeHandledRef = useRef(false);

  useEffect(() => {
    setViewDate(createMonthAnchor(currentDate));
    setSelectedDate(currentDate);
  }, [currentDate]);

  const entries = useMemo(
    () => buildEntries(history, currentDate, currentTasks),
    [history, currentDate, currentTasks],
  );

  const visibleYears = useMemo(
    () => getVisibleYears(viewDate),
    [viewDate],
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
    () => buildCalendarDays(viewDate, entries, currentDate, preferences.showCompletedInCalendar, holidayMap),
    [viewDate, entries, currentDate, preferences.showCompletedInCalendar, holidayMap],
  );

  const selectedEntry = days.find((day) => day.dateKey === selectedDate) || {
    dateKey: selectedDate,
    holidays: holidayMap.get(selectedDate) || [],
    tasks: [],
    summary: { done: 0, failed: 0, pending: 0 },
  };

  const monthTasks = days.reduce((sum, day) => (
    day.isCurrentMonth ? sum + day.summary.done + day.summary.pending + day.summary.failed : sum
  ), 0);
  const monthDone = days.reduce((sum, day) => (
    day.isCurrentMonth ? sum + day.summary.done : sum
  ), 0);
  const monthIncomplete = days.reduce((sum, day) => (
    day.isCurrentMonth ? sum + day.summary.pending + day.summary.failed : sum
  ), 0);

  const selectedTaskCount = selectedEntry.summary.done + selectedEntry.summary.pending + selectedEntry.summary.failed;
  const selectedIncompleteCount = selectedEntry.summary.pending + selectedEntry.summary.failed;

  const moveMonth = (amount) => {
    const nextDate = shiftMonth(viewDate, amount);
    setViewDate(nextDate);
    setSelectedDate(currentDate);
  };

  const monthSwipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => (
        Math.abs(gestureState.dx) > 22 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
      ),
      onPanResponderRelease: (_, gestureState) => {
        if (swipeHandledRef.current) {
          swipeHandledRef.current = false;
          return;
        }

        if (Math.abs(gestureState.dx) < 48 || Math.abs(gestureState.dy) > 42) {
          return;
        }

        swipeHandledRef.current = true;
        moveMonth(gestureState.dx < 0 ? 1 : -1);
        setTimeout(() => {
          swipeHandledRef.current = false;
        }, 250);
      },
    }),
  ).current;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <SectionCard palette={palette}>
        <View style={styles.monthHead}>
          <View style={styles.monthNav}>
            <Pressable style={styles.monthButton} onPress={() => moveMonth(-1)}>
              <Ionicons name="chevron-back" size={16} color={palette.muted} />
            </Pressable>
            <Text style={styles.monthTitle}>{formatMonthLabel(viewDate)}</Text>
            <Pressable style={styles.monthButton} onPress={() => moveMonth(1)}>
              <Ionicons name="chevron-forward" size={16} color={palette.muted} />
            </Pressable>
          </View>
          <Pressable style={styles.todayButton} onPress={() => {
            setViewDate(createMonthAnchor(currentDate));
            setSelectedDate(currentDate);
          }}>
            <Text style={styles.todayButtonText}>오늘</Text>
          </Pressable>
        </View>

        <View style={styles.statRow}>
          <StatCard palette={palette} value={`${monthTasks}개`} label="할 일" />
          <StatCard palette={palette} value={`${monthDone}개`} label="완료" />
          <StatCard palette={palette} value={`${monthIncomplete}개`} label="미완료" />
        </View>
      </SectionCard>

      <SectionCard palette={palette}>
        {holidayStatus.error ? (
          <StatusBanner palette={palette} type="error" title="공휴일 불러오기 실패" description={holidayStatus.error} />
        ) : null}
        {holidayStatus.loading ? (
          <StatusBanner palette={palette} type="loading" title="공휴일 동기화 중" description="이번 달과 인접 주차의 공휴일을 가져오고 있습니다." />
        ) : null}

        <View {...monthSwipeResponder.panHandlers}>
          <View style={styles.weekdayRow}>
            {Array.from({ length: 7 }, (_, index) => (
              <Text
                key={`weekday-${index}`}
                style={[
                  styles.weekdayLabel,
                  index === 0 && { color: palette.holiday },
                  index === 6 && { color: palette.saturday },
                ]}
              >
                {weekdayShortLabel(index)}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {days.map((day) => (
              <Pressable
                key={day.dateKey}
                style={[
                  styles.dayCellWrap,
                  !day.isCurrentMonth && styles.dayCellOutside,
                ]}
                onPress={() => setSelectedDate(day.dateKey)}
              >
                <View
                  style={[
                    styles.dayCell,
                    day.dateKey === selectedDate && { borderColor: palette.accent, backgroundColor: palette.accentSoft },
                  ]}
                >
                  <View style={styles.dayTopLine}>
                    <View
                      style={[
                        styles.dayNumberBadge,
                        day.tone === "sunday" && { backgroundColor: palette.holidaySoft },
                        day.tone === "saturday" && { backgroundColor: palette.saturdaySoft },
                        day.isToday && { backgroundColor: palette.accentSoft },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumberText,
                          day.tone === "sunday" && { color: palette.holiday },
                          day.tone === "saturday" && { color: palette.saturday },
                          day.isToday && { color: palette.accentStrong },
                        ]}
                      >
                        {day.dayNumber}
                      </Text>
                    </View>
                  </View>

                  {day.holidays[0] ? (
                    <Text style={[styles.holidayName, { color: palette.holiday }]} numberOfLines={2}>
                      {day.holidays[0].localName}
                    </Text>
                  ) : null}

                  {day.tasks.length > 0 ? (
                    <View style={styles.dayChipRow}>
                      <Chip palette={palette}>{`할 일 ${day.tasks.length}`}</Chip>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </SectionCard>

      <SectionCard palette={palette}>
        <View style={styles.detailHead}>
          <View style={styles.detailTitleWrap}>
            <Text style={styles.detailLabel}>선택 날짜</Text>
            <Text style={styles.detailTitle}>{formatDisplayDate(selectedEntry.dateKey)}</Text>
          </View>
          <View style={styles.detailChipRow}>
            {selectedEntry.holidays.length > 0 ? <Chip palette={palette} kind="holiday">공휴일</Chip> : null}
            <Chip palette={palette}>{`할 일 ${selectedTaskCount}`}</Chip>
            <Chip palette={palette} kind="ok">{`완료 ${selectedEntry.summary.done}`}</Chip>
            <Chip palette={palette} kind="accent">{`미완료 ${selectedIncompleteCount}`}</Chip>
          </View>
        </View>

        {selectedEntry.holidays.length > 0 ? (
          <View style={styles.holidayList}>
            {selectedEntry.holidays.map((holiday) => (
              <View key={`${holiday.date}-${holiday.localName}`} style={styles.holidayCard}>
                <Text style={[styles.holidayCardTitle, { color: palette.holiday }]}>{holiday.localName}</Text>
                <Text style={styles.holidayCardBody}>{holiday.name}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {selectedEntry.tasks.length === 0 ? (
          <EmptyStateCard
            palette={palette}
            title="기록된 일정이 없습니다"
            description={selectedEntry.holidays.length > 0
              ? "공휴일 정보만 표시 중이며 등록된 할 일은 없습니다."
              : "선택한 날짜에 등록된 할 일이 없습니다."}
          />
        ) : (
          <View style={styles.taskList}>
            {selectedEntry.tasks.map((task) => (
              <TaskCard
                key={`${selectedEntry.dateKey}-${task.id}`}
                task={task}
                palette={palette}
                onToggleDone={(taskId, status) => onUpdateTaskStatus(selectedEntry.dateKey, taskId, status)}
                onUpdateTitle={(taskId, title) => onUpdateTaskTitle(selectedEntry.dateKey, taskId, title)}
                onDelete={(taskId) => onDeleteTask(selectedEntry.dateKey, taskId)}
              />
            ))}
          </View>
        )}
      </SectionCard>
    </ScrollView>
  );
}

function createStyles(palette) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
    },
    content: {
      padding: 12,
      gap: 12,
      paddingBottom: 24,
    },
    monthHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    monthNav: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    monthButton: {
      width: 30,
      height: 30,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
    },
    monthTitle: {
      fontSize: 30,
      lineHeight: 34,
      color: palette.text,
      fontWeight: "500",
    },
    todayButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.accentSoft,
    },
    todayButtonText: {
      color: palette.accentStrong,
      fontSize: 13,
      fontWeight: "500",
    },
    statRow: {
      flexDirection: "row",
      gap: 8,
    },
    weekdayRow: {
      flexDirection: "row",
      marginBottom: 8,
    },
    weekdayLabel: {
      width: "14.2857%",
      textAlign: "center",
      fontSize: 12,
      color: palette.muted,
      fontWeight: "500",
    },
    calendarGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    dayCellWrap: {
      width: "14.2857%",
      padding: 2,
    },
    dayCellOutside: {
      opacity: 0.5,
    },
    dayCell: {
      minHeight: 82,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.card,
      padding: 5,
      gap: 4,
    },
    dayTopLine: {
      flexDirection: "row",
    },
    dayNumberBadge: {
      minWidth: 24,
      height: 24,
      borderRadius: 999,
      backgroundColor: palette.cardMuted,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    dayNumberText: {
      color: palette.text,
      fontSize: 12,
      fontWeight: "500",
    },
    holidayName: {
      fontSize: 10,
      lineHeight: 12,
      fontWeight: "500",
    },
    dayChipRow: {
      marginTop: "auto",
      alignItems: "flex-start",
    },
    detailHead: {
      gap: 10,
    },
    detailTitleWrap: {
      gap: 4,
    },
    detailLabel: {
      fontSize: 12,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      color: palette.accentStrong,
      fontWeight: "500",
    },
    detailTitle: {
      fontSize: 22,
      lineHeight: 28,
      color: palette.text,
      fontWeight: "500",
    },
    detailChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    holidayList: {
      gap: 8,
    },
    holidayCard: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.holidaySoft,
      gap: 4,
    },
    holidayCardTitle: {
      fontSize: 15,
      fontWeight: "500",
    },
    holidayCardBody: {
      color: palette.muted,
      fontSize: 13,
      lineHeight: 18,
    },
    taskList: {
      gap: 8,
    },
  });
}
