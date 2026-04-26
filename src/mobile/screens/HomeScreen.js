import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Chip, EmptyStateCard, OutlineButton, PrimaryButton, SectionCard, SectionHeader, StatCard, StatusBanner } from "../components/Surface.js";
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
  onRegenerate,
  onOpenSettings,
}) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [manualTaskTitle, setManualTaskTitle] = useState("");
  const goals = Array.isArray(state.goals) && state.goals.length > 0
    ? state.goals
    : state.goal.trim()
      ? [state.goal]
      : [];
  const doneCount = state.tasks.filter((task) => task.status === "done").length;
  const pendingCount = state.tasks.filter((task) => task.status !== "done").length;
  const carryoverCount = state.tasks.filter((task) => task.source === "carryover").length;
  const aiStatusLabel = health.disabled
    ? "AI 추천 비활성"
    : health.ready
      ? "AI 추천 준비 완료"
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
            <Text style={styles.summaryTitle}>올해 목표</Text>
            {goals.length > 0 ? (
              goals.map((goal) => (
                <Text key={goal} style={styles.goalItem}>
                  • {goal}
                </Text>
              ))
            ) : (
              <Text style={styles.summaryBody}>아직 목표가 없습니다. 설정 탭에서 목표와 난이도를 정할 수 있습니다.</Text>
            )}
            {goals.length > 0 && <Chip palette={palette} kind="accent">오늘 기준으로 자동 재계산 중</Chip>}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>오늘 집중 방향</Text>
            <Text style={styles.summaryBody}>
              {goals.length > 0
                ? state.insight
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
              <Chip palette={palette}>{`${doneCount} / ${state.tasks.length} 완료`}</Chip>
              {state.goal.trim() ? (
                <OutlineButton
                  palette={palette}
                  label={health.disabled ? "AI 비활성" : "AI 추천 새로고침"}
                  compact
                  disabled={isGenerating || health.disabled}
                  onPress={onRegenerate}
                />
              ) : null}
            </View>
          )}
        />

        {isGenerating ? (
          <StatusBanner
            palette={palette}
            type="loading"
            title="오늘 계획 생성 중"
            description="최근 기록과 미완료 항목을 반영해 오늘 할 일을 다시 계산하고 있습니다."
          />
        ) : null}

        {!isGenerating && errorMessage ? (
          <StatusBanner
            palette={palette}
            type="error"
            title={health.disabled ? "AI 추천 비활성" : "AI 요청 실패"}
            description={errorMessage}
          />
        ) : null}

        {!state.goal.trim() ? (
          <StatusBanner
            palette={palette}
            type="warning"
            title="목표가 아직 없습니다"
            description="목표가 없어도 직접 할 일을 추가해서 사용할 수 있습니다. AI 추천은 목표를 저장한 뒤 활성화됩니다."
          />
        ) : null}

        {state.tasks.length === 0 && !isGenerating ? (
          <EmptyStateCard
            palette={palette}
            title={state.goal.trim() ? (health.disabled ? "AI 추천 비활성 상태" : "오늘 할 일이 없습니다") : "추가한 할 일이 없습니다"}
            description={state.goal.trim()
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
    summaryBody: {
      fontSize: 13,
      lineHeight: 19,
      color: palette.muted,
    },
    goalItem: {
      fontSize: 13,
      lineHeight: 19,
      color: palette.muted,
    },
    todayActions: {
      alignItems: "flex-end",
      gap: 6,
      flexShrink: 1,
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
