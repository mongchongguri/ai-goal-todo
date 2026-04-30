import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { formatGoalStatusLabel, getGoalCounts, normalizeGoalItems } from "../../core/goals.js";
import {
  Chip,
  EmptyStateCard,
  OutlineButton,
  PrimaryButton,
  SectionCard,
  SectionHeader,
  StatusBanner,
} from "../components/Surface.js";
import { TaskCard } from "../components/TaskCard.js";

export function HomeScreen({
  palette,
  state,
  health,
  isGenerating,
  errorMessage,
  onAddTask,
  onUpdateTaskStatus,
  onUpdateTaskTitle,
  onDeleteTask,
  onAddAiTasks,
  onOpenSettings,
}) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [manualTaskTitle, setManualTaskTitle] = useState("");
  const goals = normalizeGoalItems(state.goals, state.goal);
  const goalCounts = getGoalCounts(goals);
  const hasActiveGoals = goalCounts.active > 0;
  const hasAnyGoals = goalCounts.total > 0;
  const doneCount = state.tasks.filter((task) => task.status === "done").length;
  const pendingCount = state.tasks.filter((task) => task.status !== "done").length;
  const carryoverCount = state.tasks.filter((task) => task.source === "carryover").length;
  const aiStatusLabel = health.disabled
    ? "AI 비활성"
    : health.ready
      ? "AI 준비 완료"
      : "AI 연결 확인 필요";

  const submitManualTask = () => {
    const nextTitle = manualTaskTitle.trim();
    if (!nextTitle) {
      return;
    }

    onAddTask(nextTitle);
    setManualTaskTitle("");
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <SectionCard palette={palette}>
        <SectionHeader
          palette={palette}
          label="Main"
          title="현재 집중 영역"
          action={<OutlineButton palette={palette} label="목표 설정" compact onPress={onOpenSettings} />}
        />

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <View style={styles.goalSummaryHead}>
              <Text style={styles.summaryTitle}>올해 목표</Text>
              {hasAnyGoals ? (
                <View style={styles.goalBadgeRow}>
                  {goalCounts.active > 0 ? (
                    <Chip palette={palette} kind="accent">{`진행중 ${goalCounts.active}개`}</Chip>
                  ) : null}
                  {goalCounts.success > 0 ? (
                    <Chip palette={palette} kind="ok">{`성공 ${goalCounts.success}개`}</Chip>
                  ) : null}
                </View>
              ) : null}
            </View>
            {goals.length > 0 ? (
              goals.map((goal) => (
                <View key={`${goal.title}-${goal.targetDate}-${goal.status}`} style={styles.goalItemWrap}>
                  <Text style={styles.goalLine} numberOfLines={1}>
                    <Text style={styles.goalItem}>{`- ${goal.title}`}</Text>
                    <Text style={styles.goalMeta}>{` ${formatGoalStatusLabel(goal.status)}${goal.targetDate ? ` - ${goal.targetDate}` : ""}`}</Text>
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.summaryBody}>아직 목표가 없습니다. 설정 탭에서 목표와 난이도를 정할 수 있습니다.</Text>
            )}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>오늘 집중 방향</Text>
            <Text style={styles.summaryBody}>
              {hasActiveGoals
                ? state.insight
                : hasAnyGoals
                  ? "현재는 성공한 목표만 남아 있습니다. 새 진행중 목표를 추가하면 AI 추천을 다시 시작합니다."
                  : "목표가 없어도 직접 할 일을 추가해 하루 일정을 관리할 수 있습니다."}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>진행 현황</Text>
            <Text style={styles.summaryBody}>{`완료 ${doneCount}개, 남은 일 ${pendingCount}개, 이월 ${carryoverCount}개`}</Text>
            <Chip palette={palette} kind="accent">{aiStatusLabel}</Chip>
          </View>
        </View>
      </SectionCard>

      <SectionCard palette={palette}>
        <SectionHeader
          palette={palette}
          label="Today"
          title="오늘 할 일 목록"
          action={(
            <View style={styles.todayActions}>
              {hasActiveGoals ? (
                <OutlineButton
                  palette={palette}
                  label={health.disabled ? "AI 비활성" : "AI 할일 추가"}
                  compact
                  disabled={isGenerating || health.disabled}
                  onPress={onAddAiTasks}
                />
              ) : null}
              <Chip palette={palette} style={styles.todayStatusChip}>{`${doneCount} / ${state.tasks.length} 완료`}</Chip>
            </View>
          )}
        />

        {isGenerating ? (
          <StatusBanner
            palette={palette}
            type="loading"
            title="AI 할 일을 준비하는 중"
            description="현재 할 일 목록은 유지하고, 중복되지 않는 추가 작업을 계산하고 있습니다."
          />
        ) : null}

        {!isGenerating && errorMessage ? (
          <StatusBanner
            palette={palette}
            type="error"
            title={health.disabled ? "AI 비활성" : "AI 요청 실패"}
            description={errorMessage}
          />
        ) : null}

        {!hasActiveGoals ? (
          <StatusBanner
            palette={palette}
            type="warning"
            title={hasAnyGoals ? "진행중 목표가 없습니다" : "목표가 아직 없습니다"}
            description={hasAnyGoals
              ? "성공 목표는 저장되지만 AI 추천에는 반영되지 않습니다. 진행중 목표를 추가하거나 상태를 바꿔 주세요."
              : "목표가 없어도 직접 할 일을 추가해서 사용할 수 있습니다. AI 추천은 목표를 저장한 뒤 활성화됩니다."}
          />
        ) : null}

        {state.tasks.length === 0 && !isGenerating ? (
          <EmptyStateCard
            palette={palette}
            title={hasActiveGoals ? (health.disabled ? "AI 비활성 상태" : "오늘 할 일이 없습니다") : "추가한 할 일이 없습니다"}
            description={hasActiveGoals
              ? (health.disabled
                ? "현재 서버에 접근할 수 없어 AI 추천을 사용할 수 없습니다. 직접 할 일을 추가해 사용할 수 있습니다."
                : "지금은 오늘 일정이 비어 있습니다. 설정을 조정하거나 다시 추천을 요청해보세요.")
              : "아래 입력창에서 직접 오늘 할 일을 추가해보세요."}
          />
        ) : null}

        <View style={styles.taskList}>
          {state.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              palette={palette}
              onToggleDone={onUpdateTaskStatus}
              onDelete={onDeleteTask}
              onUpdateTitle={onUpdateTaskTitle}
            />
          ))}
        </View>

        <View style={styles.manualWrap}>
          <Text style={styles.fieldLabel}>직접 할 일 추가</Text>
          <View style={styles.manualRow}>
            <TextInput
              value={manualTaskTitle}
              onChangeText={setManualTaskTitle}
              placeholder="예: 영어 뉴스 15분 듣기"
              placeholderTextColor={palette.muted}
              style={styles.manualInput}
              maxLength={120}
              onSubmitEditing={submitManualTask}
            />
            <PrimaryButton palette={palette} label="추가" onPress={submitManualTask} />
          </View>
        </View>
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
    summaryGrid: {
      gap: 8,
    },
    summaryCard: {
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 12,
      backgroundColor: palette.card,
      padding: 12,
      gap: 8,
    },
    summaryTitle: {
      fontSize: 15,
      color: palette.text,
      fontWeight: "500",
    },
    goalSummaryHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    goalBadgeRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 6,
      flexShrink: 1,
    },
    goalLine: {
      fontSize: 13,
      lineHeight: 19,
      color: palette.text,
    },
    summaryBody: {
      fontSize: 13,
      lineHeight: 19,
      color: palette.muted,
    },
    goalItem: {
      fontSize: 13,
      lineHeight: 19,
      color: palette.text,
    },
    goalItemWrap: {
      minWidth: 0,
    },
    goalMeta: {
      fontSize: 11,
      lineHeight: 19,
      color: palette.muted,
    },
    todayActions: {
      alignItems: "flex-end",
      gap: 6,
      flexShrink: 1,
    },
    todayStatusChip: {
      alignSelf: "flex-end",
    },
    taskList: {
      gap: 8,
    },
    manualWrap: {
      gap: 8,
    },
    fieldLabel: {
      fontSize: 12,
      color: palette.muted,
    },
    manualRow: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
    },
    manualInput: {
      flex: 1,
      minHeight: 46,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.card,
      color: palette.text,
      fontSize: 14,
    },
  });
}
