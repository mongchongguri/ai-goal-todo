import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  GOAL_STATUS_IN_PROGRESS,
  GOAL_STATUS_SUCCESS,
  createEmptyGoalInput,
  formatGoalStatusLabel,
  getCurrentYearEndGoalDate,
  getGoalCounts,
  isGoalDateInputValid,
  normalizeGoalDate,
  normalizeGoalDetail,
  normalizeGoalItems,
} from "../../core/goals.js";
import { Ionicons } from "@expo/vector-icons";
import {
  EmptyStateCard,
  OutlineButton,
  PrimaryButton,
  SectionCard,
  SectionHeader,
  StatusBanner,
  SummaryLinkCard,
  ToggleRow,
} from "../components/Surface.js";
import { formatDisplayDate, parseDateKey } from "../date.js";
import { TimePickerField } from "../components/TimePickerField.js";
import { todayKey } from "../../core/utils.js";

function difficultyLabel(value) {
  if (value === "easy") {
    return "가볍게";
  }

  if (value === "hard") {
    return "강하게";
  }

  return "균형 있게";
}

function permissionLabel(permission) {
  if (permission === "granted") {
    return "허용됨";
  }

  if (permission === "denied") {
    return "차단됨";
  }

  return "아직 확인 전";
}

function toGoalInputs(state) {
  const goals = normalizeGoalItems(state.goals, state.goal);
  return goals.length > 0 ? goals : [createEmptyGoalInput()];
}

function cleanGoalInputs(values) {
  const seen = new Set();

  return values
    .map((value) => ({
      title: String(value?.title || "").replace(/\s+/g, " ").trim(),
      targetDate: normalizeGoalDate(value?.targetDate),
      detail: normalizeGoalDetail(value?.detail),
      status: value?.status === GOAL_STATUS_SUCCESS ? GOAL_STATUS_SUCCESS : GOAL_STATUS_IN_PROGRESS,
    }))
    .filter((value) => {
      const key = value.title.toLowerCase();
      if (!value.title || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function serializeGoalInputs(values) {
  return values
    .map((value) => [
      value?.title || "",
      value?.targetDate || "",
      value?.detail || "",
      value?.status || GOAL_STATUS_IN_PROGRESS,
    ].join("\u0001"))
    .join("\u0002");
}

function validateGoalInputs(values) {
  for (let index = 0; index < values.length; index += 1) {
    const dateValue = String(values[index]?.targetDate || "").trim();
    if (dateValue && !isGoalDateInputValid(dateValue)) {
      return `${index + 1}번째 목표 날짜를 YYYY-MM-DD 형식으로 입력해 주세요.`;
    }
  }

  return "";
}

function createGoalDateDraft(value) {
  return normalizeGoalDate(value) || todayKey();
}

function formatGoalDateButtonLabel(value) {
  const normalized = normalizeGoalDate(value);
  return normalized ? normalized.replace(/-/g, ".") : "날짜 선택";
}

function GoalStatusButton({ palette, label, active, onPress }) {
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Pressable
      style={[
        styles.goalStatusButton,
        active && {
          borderColor: palette.accent,
          backgroundColor: palette.accentSoft,
        },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.goalStatusButtonText, active && { color: palette.accentStrong }]}>{label}</Text>
    </Pressable>
  );
}

function DifficultyButton({ palette, title, description, active, onPress }) {
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Pressable
      style={[
        styles.difficultyCard,
        active && {
          borderColor: palette.accent,
          backgroundColor: palette.accentSoft,
        },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.difficultyTitle, active && { color: palette.accentStrong }]}>{title}</Text>
      <Text style={[styles.difficultyDescription, active && { color: palette.accentStrong }]}>{description}</Text>
    </Pressable>
  );
}

export function SettingsScreen({
  palette,
  state,
  health,
  isGenerating,
  errorMessage,
  notificationPermission,
  onSubmitGoal,
  onSetTheme,
  onSetNotificationSettings,
  onSetPlanningSettings,
  onRequestNotificationPermission,
  onRetry,
  onReset,
}) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  const externalGoalValues = toGoalInputs(state);
  const externalGoalSignature = serializeGoalInputs(externalGoalValues);
  const [goalValues, setGoalValues] = useState(() => externalGoalValues);
  const [difficultyValue, setDifficultyValue] = useState(state.difficulty);
  const [goalFormError, setGoalFormError] = useState("");
  const [goalDetailEditor, setGoalDetailEditor] = useState({ index: -1, value: "" });
  const [goalDatePicker, setGoalDatePicker] = useState({
    index: -1,
    draftValue: todayKey(),
  });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [legalView, setLegalView] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const sectionOffsetsRef = useRef({});
  const scrollRef = useRef(null);
  const goalCounts = getGoalCounts(state.goals, state.goal);

  useEffect(() => {
    setGoalValues(externalGoalValues);
    setGoalFormError("");
    setGoalDetailEditor({ index: -1, value: "" });
    setGoalDatePicker({
      index: -1,
      draftValue: todayKey(),
    });
    setShowResetConfirm(false);
  }, [externalGoalSignature]);

  useEffect(() => {
    setDifficultyValue(state.difficulty);
  }, [state.difficulty]);

  const updateSectionOffset = (name, y) => {
    sectionOffsetsRef.current[name] = y;
  };

  const scrollToSection = (name) => {
    const targetY = sectionOffsetsRef.current[name];
    if (typeof targetY !== "number") {
      return;
    }

    scrollRef.current?.scrollTo({
      y: Math.max(0, targetY - 8),
      animated: true,
    });
  };

  const handleGoalSubmit = () => {
    const validationMessage = validateGoalInputs(goalValues);
    if (validationMessage) {
      setGoalFormError(validationMessage);
      return;
    }

    setGoalFormError("");
    onSubmitGoal(cleanGoalInputs(goalValues), difficultyValue);
  };

  const updateGoalValue = (index, patch) => {
    setGoalFormError("");
    setGoalValues((previous) => previous.map((goal, goalIndex) => (
      goalIndex === index
        ? {
          ...goal,
          ...patch,
        }
        : goal
    )));
  };

  const addGoalInput = () => {
    setGoalFormError("");
    setGoalValues((previous) => (
      previous.length >= 8 ? previous : [...previous, createEmptyGoalInput(getCurrentYearEndGoalDate())]
    ));
  };

  const removeGoalInput = (index) => {
    setGoalFormError("");
    setGoalValues((previous) => {
      const next = previous.filter((_, goalIndex) => goalIndex !== index);
      return next.length > 0 ? next : [createEmptyGoalInput()];
    });
  };

  const openGoalDetailEditor = (index) => {
    setGoalDetailEditor({
      index,
      value: goalValues[index]?.detail || "",
    });
  };

  const closeGoalDetailEditor = () => {
    setGoalDetailEditor({ index: -1, value: "" });
  };

  const applyGoalDetailEditor = () => {
    if (goalDetailEditor.index < 0) {
      return;
    }

    updateGoalValue(goalDetailEditor.index, {
      detail: goalDetailEditor.value,
    });
    closeGoalDetailEditor();
  };

  const closeGoalDatePicker = () => {
    setGoalDatePicker({
      index: -1,
      draftValue: todayKey(),
    });
  };

  const openGoalDatePicker = (index) => {
    setGoalFormError("");
    setGoalDatePicker({
      index,
      draftValue: createGoalDateDraft(goalValues[index]?.targetDate),
    });
  };

  const applyGoalDate = (dateValue) => {
    if (goalDatePicker.index < 0) {
      return;
    }

    updateGoalValue(goalDatePicker.index, { targetDate: normalizeGoalDate(dateValue) });
    closeGoalDatePicker();
  };

  const handleGoalDatePickerChange = (event, selectedDate) => {
    if (!selectedDate) {
      if (Platform.OS === "android") {
        closeGoalDatePicker();
      }
      return;
    }

    const nextDate = todayKey(selectedDate);
    if (Platform.OS === "android") {
      applyGoalDate(nextDate);
      return;
    }

    setGoalDatePicker((previous) => ({
      ...previous,
      draftValue: nextDate,
    }));
  };

  const handleNotificationToggle = async () => {
    if (state.preferences.notificationsEnabled) {
      onSetNotificationSettings({ notificationsEnabled: false });
      return;
    }

    if (notificationPermission === "granted") {
      onSetNotificationSettings({ notificationsEnabled: true });
      return;
    }

    const permission = await onRequestNotificationPermission();
    onSetNotificationSettings({ notificationsEnabled: permission === "granted" });
  };

  const confirmReset = () => {
    setShowResetConfirm(true);
  };

  const closeResetConfirm = () => {
    setShowResetConfirm(false);
  };

  const handleResetConfirm = () => {
    setShowResetConfirm(false);
    void onReset();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        onScroll={(event) => {
          setShowScrollTop(event.nativeEvent.contentOffset.y > 360);
        }}
        scrollEventThrottle={16}
      >
        <View onLayout={(event) => updateSectionOffset("summary", event.nativeEvent.layout.y)}>
          <SectionCard palette={palette}>
            <SectionHeader
              palette={palette}
              label="Settings"
              title="앱 설정"
              action={(
                <OutlineButton
                  palette={palette}
                  compact
                  label={health.disabled ? "AI 비활성" : "AI 연결 확인"}
                  disabled={isGenerating || health.disabled}
                  onPress={onRetry}
                />
              )}
            />

            <View style={styles.summaryStack}>
              <View style={styles.summaryInfoCard}>
                <Text style={styles.summaryInfoTitle}>AI 추천 상태</Text>
                <Text style={styles.summaryInfoBody}>
                  {health.disabled
                    ? "현재 서버에 접근할 수 없어 AI 상태 확인 및 추천 기능을 사용할 수 없습니다."
                    : health.ready
                      ? "AI 연결 설정이 준비되어 있습니다."
                      : health.error || "AI 상태 확인 중입니다."}
                </Text>
              </View>

              <SummaryLinkCard
                palette={palette}
                title="목표 설정"
                description={goalCounts.total > 0
                  ? `진행중 ${goalCounts.active}개, 성공 ${goalCounts.success}개 · ${difficultyLabel(state.difficulty)} 난이도`
                  : "올해 목표와 실행 난이도를 설정합니다."}
                onPress={() => scrollToSection("goal")}
              />
              <SummaryLinkCard
                palette={palette}
                title="현재 모드"
                description={state.preferences.theme === "dark" ? "다크 모드" : "화이트 모드"}
                onPress={() => scrollToSection("display")}
              />
              <SummaryLinkCard
                palette={palette}
                title="알림 시간"
                description={state.preferences.notificationsEnabled
                  ? `${state.preferences.reminderTime} 기준으로 알림을 보냅니다.`
                  : "알림이 꺼져 있습니다."}
                onPress={() => scrollToSection("notifications")}
              />
              <SummaryLinkCard
                palette={palette}
                title="할 일 업데이트"
                description={`${state.preferences.dailyUpdateTime} 기준으로 새 할 일을 준비합니다.`}
                onPress={() => scrollToSection("schedule")}
              />
              <SummaryLinkCard
                palette={palette}
                title="실패 반영"
                description={state.preferences.considerMissedTasks
                  ? "미완료 항목을 다음 추천에 반영합니다."
                  : "미완료 항목을 다음 추천에서 제외합니다."}
                onPress={() => scrollToSection("schedule")}
              />
              <SummaryLinkCard
                palette={palette}
                title="완료 개수 반영"
                description={state.preferences.countCompletedTasksInPlan
                  ? "완료한 AI 할 일을 새 추천 개수에서 차감합니다."
                  : "완료한 AI 할 일을 별도로 보고 새 개수를 유지합니다."}
                onPress={() => scrollToSection("schedule")}
              />
            </View>

            {errorMessage ? (
              <StatusBanner palette={palette} type="error" title="알림" description={errorMessage} />
            ) : null}
          </SectionCard>
        </View>

        <View onLayout={(event) => updateSectionOffset("goal", event.nativeEvent.layout.y)}>
          <SectionCard palette={palette}>
            <SectionHeader
              palette={palette}
              label="Goal"
              title="목표 및 난이도 설정"
              action={<PrimaryButton palette={palette} compact label="저장" onPress={handleGoalSubmit} />}
            />

            <View style={styles.formCard}>
              <View style={styles.goalHead}>
                <Text style={styles.fieldHeading}>올해 목표</Text>
                <View style={styles.goalHeadActions}>
                  <OutlineButton
                    palette={palette}
                    compact
                    label="추가"
                    onPress={addGoalInput}
                  />
                </View>
              </View>

              <View style={styles.goalList}>
                {goalValues.map((goal, index) => (
                  <View key={`goal-${index}`} style={styles.goalCard}>
                    <View style={styles.goalRowHead}>
                      <Text style={styles.goalRowLabel}>{`목표 ${index + 1}`}</Text>
                      <OutlineButton
                        palette={palette}
                        compact
                        label="삭제"
                        disabled={goalValues.length === 1}
                        onPress={() => removeGoalInput(index)}
                      />
                    </View>

                    <View style={styles.goalTitleRow}>
                      <TextInput
                      value={goal.title}
                      onChangeText={(value) => updateGoalValue(index, { title: value })}
                      placeholder={index === 0 ? "예: 정보처리기사 자격증 공부" : "추가 목표 입력"}
                      placeholderTextColor={palette.muted}
                      style={[styles.goalInput, styles.goalTitleInput]}
                      maxLength={80}
                      />
                      <Pressable
                        style={[
                          styles.goalDetailButton,
                          goal.detail && {
                            borderColor: palette.accent,
                            backgroundColor: palette.accentSoft,
                          },
                        ]}
                        onPress={() => openGoalDetailEditor(index)}
                      >
                        <Ionicons
                          name="settings-outline"
                          size={16}
                          color={goal.detail ? palette.accentStrong : palette.muted}
                        />
                      </Pressable>
                    </View>

                    <View style={styles.goalMetaRow}>
                      <Pressable
                        style={[styles.goalInput, styles.goalDateButton]}
                        onPress={() => openGoalDatePicker(index)}
                      >
                        <Text
                          style={[
                            styles.goalDateButtonText,
                            !goal.targetDate && styles.goalDateButtonPlaceholder,
                          ]}
                        >
                          {formatGoalDateButtonLabel(goal.targetDate)}
                        </Text>
                      </Pressable>
                      <View style={styles.goalStatusRow}>
                        <GoalStatusButton
                          palette={palette}
                          label={formatGoalStatusLabel(GOAL_STATUS_IN_PROGRESS)}
                          active={goal.status !== GOAL_STATUS_SUCCESS}
                          onPress={() => updateGoalValue(index, { status: GOAL_STATUS_IN_PROGRESS })}
                        />
                        <GoalStatusButton
                          palette={palette}
                          label={formatGoalStatusLabel(GOAL_STATUS_SUCCESS)}
                          active={goal.status === GOAL_STATUS_SUCCESS}
                          onPress={() => updateGoalValue(index, { status: GOAL_STATUS_SUCCESS })}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {goalFormError ? (
                <StatusBanner palette={palette} type="error" title="목표 날짜 확인" description={goalFormError} />
              ) : null}

              <Text style={styles.settingNote}>
                성공 목표는 추천에서 제외하고, 진행중 목표만 목표 날짜와 함께 고려해 오늘 할 일을 계산합니다.
              </Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.fieldHeading}>실행 난이도</Text>
              <View style={styles.difficultyGrid}>
                <DifficultyButton
                  palette={palette}
                  title="가볍게"
                  description="부담을 줄이고 꾸준히 이어가는 방식"
                  active={difficultyValue === "easy"}
                  onPress={() => setDifficultyValue("easy")}
                />
                <DifficultyButton
                  palette={palette}
                  title="균형 있게"
                  description="지속성과 성과를 함께 챙기는 방식"
                  active={difficultyValue === "balanced"}
                  onPress={() => setDifficultyValue("balanced")}
                />
                <DifficultyButton
                  palette={palette}
                  title="강하게"
                  description="속도를 높여 성과를 끌어올리는 방식"
                  active={difficultyValue === "hard"}
                  onPress={() => setDifficultyValue("hard")}
                />
              </View>
            </View>
          </SectionCard>
        </View>

        <View onLayout={(event) => updateSectionOffset("schedule", event.nativeEvent.layout.y)}>
          <SectionCard palette={palette}>
            <SectionHeader palette={palette} label="Schedule" title="할 일 업데이트 시간" />

            <View style={styles.formCard}>
              <TimePickerField
                palette={palette}
                label="자동 업데이트 시간"
                note="이 시간이 지나면 이전 기록을 반영해 새 계획을 만듭니다."
                value={state.preferences.dailyUpdateTime}
                modalTitle="할 일 업데이트 시간 설정"
                modalDescription="하루 기록을 언제 기준으로 정리하고 새 추천을 계산할지 선택하세요."
                quickTimes={["06:00", "08:00", "09:00", "18:00", "21:00", "23:00"]}
                onChange={(value) => onSetPlanningSettings({ dailyUpdateTime: value })}
              />
            </View>

            <View style={styles.formCard}>
              <Text style={styles.fieldHeading}>업데이트 방식</Text>
              <Text style={styles.settingNote}>
                설정한 시간 전까지는 기존 할 일 목록을 유지하고, 시간이 지나면 완료와 미완료 기록을 바탕으로 다음 할 일을 다시 추천합니다.
              </Text>
            </View>

            <ToggleRow
              palette={palette}
              title="전날 실패건 반영"
              description="체크하지 못한 AI 할 일을 다음 추천에 실패로 고려합니다."
              active={state.preferences.considerMissedTasks}
              onPress={() => onSetPlanningSettings({ considerMissedTasks: !state.preferences.considerMissedTasks })}
            />

            <ToggleRow
              palette={palette}
              title="완료 개수 포함"
              description="완료한 AI 할 일을 새 추천 개수 계산에서 차감합니다."
              active={state.preferences.countCompletedTasksInPlan}
              onPress={() => onSetPlanningSettings({ countCompletedTasksInPlan: !state.preferences.countCompletedTasksInPlan })}
            />
          </SectionCard>
        </View>

        <View onLayout={(event) => updateSectionOffset("display", event.nativeEvent.layout.y)}>
          <SectionCard palette={palette}>
            <SectionHeader palette={palette} label="Display" title="화면 모드" />

            <View style={styles.formCard}>
              <Text style={styles.fieldHeading}>테마 선택</Text>
              <View style={styles.themeRow}>
                <Pressable
                  style={[
                    styles.themeButton,
                    state.preferences.theme === "light" && {
                      borderColor: palette.accent,
                      backgroundColor: palette.accentSoft,
                    },
                  ]}
                  onPress={() => onSetTheme("light")}
                >
                  <Text style={[
                    styles.themeButtonText,
                    state.preferences.theme === "light" && { color: palette.accentStrong },
                  ]}
                  >
                    화이트 모드
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.themeButton,
                    state.preferences.theme === "dark" && {
                      borderColor: palette.accent,
                      backgroundColor: palette.accentSoft,
                    },
                  ]}
                  onPress={() => onSetTheme("dark")}
                >
                  <Text style={[
                    styles.themeButtonText,
                    state.preferences.theme === "dark" && { color: palette.accentStrong },
                  ]}
                  >
                    다크 모드
                  </Text>
                </Pressable>
              </View>
            </View>
          </SectionCard>
        </View>

        <View onLayout={(event) => updateSectionOffset("notifications", event.nativeEvent.layout.y)}>
          <SectionCard palette={palette}>
            <SectionHeader palette={palette} label="Notifications" title="알림 설정" />

            <ToggleRow
              palette={palette}
              title="앱 알림 사용"
              description="선택한 시간에 오늘 할 일을 확인하라는 알림을 보냅니다."
              active={state.preferences.notificationsEnabled}
              onPress={handleNotificationToggle}
            />

            <View style={styles.formCard}>
              <TimePickerField
                palette={palette}
                label="알림 시간"
                note={`현재 권한 상태: ${permissionLabel(notificationPermission)}`}
                value={state.preferences.reminderTime}
                modalTitle="알림 시간 설정"
                modalDescription="오늘 할 일을 확인하라는 알림을 받을 시간을 선택하세요."
                onChange={(value) => onSetNotificationSettings({ reminderTime: value })}
              />
            </View>
          </SectionCard>
        </View>

        <View onLayout={(event) => updateSectionOffset("data", event.nativeEvent.layout.y)}>
          <SectionCard palette={palette}>
            <SectionHeader palette={palette} label="Data" title="기타 관리" />

            <View style={styles.formCard}>
              <Text style={styles.fieldHeading}>데이터 초기화</Text>
              <Text style={styles.settingNote}>
                현재 목표, 할 일, 기록, 설정을 모두 초기화하고 처음 상태로 되돌립니다.
              </Text>
              <OutlineButton palette={palette} label="모든 데이터 초기화" onPress={confirmReset} />
            </View>
          </SectionCard>
        </View>

        <SectionCard palette={palette}>
          <View style={styles.legalLinks}>
            <OutlineButton
              palette={palette}
              compact
              label="개인정보처리방침"
              onPress={() => setLegalView((current) => (current === "privacy" ? "" : "privacy"))}
            />
            <OutlineButton
              palette={palette}
              compact
              label="이용약관"
              onPress={() => setLegalView((current) => (current === "terms" ? "" : "terms"))}
            />
          </View>

          {legalView === "privacy" ? (
            <View style={styles.formCard}>
              <Text style={styles.fieldHeading}>개인정보처리방침</Text>
              <Text style={styles.settingNote}>앱은 목표, 할 일, 완료 기록, 설정 값을 기기 로컬 저장소에 보관합니다.</Text>
              <Text style={styles.settingNote}>AI 추천 생성 시 필요한 목표와 작업 기록 일부가 백엔드를 통해 AI 제공자에게 전달될 수 있습니다.</Text>
              <Text style={styles.settingNote}>사용자는 데이터 초기화로 로컬 데이터를 모두 삭제할 수 있습니다.</Text>
            </View>
          ) : null}

          {legalView === "terms" ? (
            <View style={styles.formCard}>
              <Text style={styles.fieldHeading}>이용약관</Text>
              <Text style={styles.settingNote}>AI 추천은 실행을 돕는 참고 정보이며, 실제 수행과 결과의 책임은 사용자에게 있습니다.</Text>
              <Text style={styles.settingNote}>네트워크 상태와 AI 서비스 상태에 따라 일부 기능이 제한될 수 있습니다.</Text>
              <Text style={styles.settingNote}>서비스를 불법적이거나 타인의 권리를 침해하는 용도로 사용할 수 없습니다.</Text>
            </View>
          ) : null}

          {!legalView ? (
            <EmptyStateCard
              palette={palette}
              title="정책 보기"
              description="위 버튼을 눌러 개인정보처리방침과 이용약관을 확인할 수 있습니다."
            />
          ) : null}
        </SectionCard>
      </ScrollView>

      {goalDetailEditor.index >= 0 ? (
        <Modal transparent animationType="fade" visible onRequestClose={closeGoalDetailEditor}>
          <View style={styles.goalDetailModalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeGoalDetailEditor} />
            <View style={styles.goalDetailModalCard}>
              <Text style={styles.goalDetailModalEyebrow}>Goal Detail</Text>
              <Text style={styles.goalDetailModalTitle}>목표 상세 내용</Text>
              <Text style={styles.goalDetailModalBody}>
                교재, 강의, 운동 방식, 장소처럼 AI 추천이 같이 고려해야 할 내용을 적어두세요.
              </Text>
              <TextInput
                value={goalDetailEditor.value}
                onChangeText={(value) => setGoalDetailEditor((previous) => ({ ...previous, value }))}
                placeholder={"예: 시나공 책으로 필기/실기 공부, 평일 저녁엔 인강 1강씩 진행\n예: 평일엔 헬스장, 주말엔 한강 러닝 5km"}
                placeholderTextColor={palette.muted}
                style={styles.goalDetailTextarea}
                multiline
                textAlignVertical="top"
                maxLength={400}
              />
              <View style={styles.goalDetailModalActions}>
                <OutlineButton palette={palette} compact label="취소" onPress={closeGoalDetailEditor} />
                <PrimaryButton palette={palette} compact label="저장" onPress={applyGoalDetailEditor} />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {showResetConfirm ? (
        <Modal transparent animationType="fade" visible onRequestClose={closeResetConfirm}>
          <View style={styles.resetConfirmBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeResetConfirm} />
            <View style={styles.resetConfirmCard}>
              <View style={styles.resetConfirmHead}>
                <View style={styles.resetConfirmIconWrap}>
                  <Ionicons name="trash-outline" size={18} color={palette.fail} />
                </View>
                <View style={styles.resetConfirmCopyWrap}>
                  <Text style={styles.resetConfirmTitle}>모든 데이터를 초기화할까요?</Text>
                  <Text style={styles.resetConfirmBody}>
                    현재 목표, 오늘 할 일, 기록, 설정이 모두 지워지고 처음 상태로 돌아갑니다.
                  </Text>
                </View>
              </View>

              <View style={styles.resetConfirmActions}>
                <Pressable
                  style={[styles.resetConfirmButton, styles.cancelResetButton]}
                  onPress={closeResetConfirm}
                >
                  <Text style={[styles.resetConfirmButtonText, styles.cancelResetButtonText]}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.resetConfirmButton, styles.acceptResetButton]}
                  onPress={handleResetConfirm}
                >
                  <Text style={[styles.resetConfirmButtonText, styles.acceptResetButtonText]}>초기화</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {goalDatePicker.index >= 0 && Platform.OS === "android" ? (
        <DateTimePicker
          value={parseDateKey(goalDatePicker.draftValue)}
          mode="date"
          display="default"
          onChange={handleGoalDatePickerChange}
        />
      ) : null}

      {goalDatePicker.index >= 0 && Platform.OS === "ios" ? (
        <Modal transparent animationType="fade" visible onRequestClose={closeGoalDatePicker}>
          <View style={styles.goalDateModalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeGoalDatePicker} />
            <View style={styles.goalDateModalCard}>
              <Text style={styles.goalDateModalEyebrow}>Goal Date</Text>
              <Text style={styles.goalDateModalTitle}>목표 날짜 선택</Text>
              <Text style={styles.goalDateModalValue}>{formatDisplayDate(goalDatePicker.draftValue)}</Text>
              <View style={styles.goalDatePickerWrap}>
                <DateTimePicker
                  value={parseDateKey(goalDatePicker.draftValue)}
                  mode="date"
                  display="inline"
                  onChange={handleGoalDatePickerChange}
                />
              </View>
              <View style={styles.goalDateModalActions}>
                <OutlineButton palette={palette} compact label="취소" onPress={closeGoalDatePicker} />
                <PrimaryButton
                  palette={palette}
                  compact
                  label="적용"
                  onPress={() => applyGoalDate(goalDatePicker.draftValue)}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

        {showScrollTop ? (
          <Pressable
            style={styles.scrollTopButton}
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          >
            <View style={styles.scrollTopChevron}>
              <View style={[styles.scrollTopChevronStroke, styles.scrollTopChevronLeft]} />
              <View style={[styles.scrollTopChevronStroke, styles.scrollTopChevronRight]} />
            </View>
          </Pressable>
        ) : null}
    </View>
  );
}

function createStyles(palette) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: 12,
      gap: 12,
      paddingBottom: 84,
    },
    summaryStack: {
      gap: 8,
    },
    summaryInfoCard: {
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 12,
      backgroundColor: palette.card,
      padding: 12,
      gap: 4,
    },
    summaryInfoTitle: {
      fontSize: 15,
      color: palette.text,
      fontWeight: "500",
    },
    summaryInfoBody: {
      fontSize: 12,
      lineHeight: 18,
      color: palette.muted,
    },
    formCard: {
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 12,
      backgroundColor: palette.card,
      padding: 12,
      gap: 10,
    },
    goalHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    goalHeadActions: {
      flexDirection: "row",
      gap: 6,
    },
    fieldHeading: {
      fontSize: 15,
      color: palette.text,
      fontWeight: "500",
    },
    goalList: {
      gap: 7,
    },
    goalCard: {
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 12,
      backgroundColor: palette.surface,
      padding: 9,
      gap: 8,
    },
    goalRowHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    goalRowLabel: {
      fontSize: 12,
      color: palette.muted,
      fontWeight: "500",
    },
    goalTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    goalInput: {
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.cardMuted,
      color: palette.text,
      fontSize: 14,
    },
    goalTitleInput: {
      flex: 1,
    },
    goalDetailButton: {
      width: 44,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
    },
    goalMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    goalDateButton: {
      flex: 1,
      minHeight: 40,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
    },
    goalDateButtonText: {
      fontSize: 13,
      color: palette.text,
      fontWeight: "500",
    },
    goalDateButtonPlaceholder: {
      color: palette.muted,
      fontWeight: "400",
    },
    goalStatusRow: {
      flex: 1.2,
      flexDirection: "row",
      gap: 6,
    },
    goalStatusButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.cardMuted,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    goalStatusButtonText: {
      fontSize: 12,
      color: palette.muted,
      fontWeight: "500",
    },
    settingNote: {
      fontSize: 12,
      lineHeight: 18,
      color: palette.muted,
    },
    difficultyGrid: {
      gap: 8,
    },
    difficultyCard: {
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 12,
      backgroundColor: palette.card,
      padding: 14,
      gap: 6,
    },
    difficultyTitle: {
      fontSize: 16,
      color: palette.text,
      fontWeight: "500",
      textAlign: "center",
    },
    difficultyDescription: {
      fontSize: 12,
      lineHeight: 18,
      color: palette.muted,
      textAlign: "center",
    },
    themeRow: {
      flexDirection: "row",
      gap: 8,
    },
    themeButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
    },
    themeButtonText: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: "500",
    },
    legalLinks: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
    },
    goalDateModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(20, 16, 12, 0.34)",
      paddingHorizontal: 18,
      justifyContent: "center",
    },
    goalDateModalCard: {
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 22,
      backgroundColor: palette.surface,
      padding: 16,
      gap: 12,
    },
    goalDateModalEyebrow: {
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      color: palette.accentStrong,
      fontWeight: "500",
    },
    goalDateModalTitle: {
      fontSize: 22,
      lineHeight: 28,
      color: palette.text,
      fontWeight: "600",
    },
    goalDateModalValue: {
      fontSize: 13,
      lineHeight: 18,
      color: palette.muted,
    },
    goalDatePickerWrap: {
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.line,
      paddingVertical: 8,
    },
    goalDateModalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
    },
    goalDetailModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(20, 16, 12, 0.42)",
      paddingHorizontal: 18,
      justifyContent: "center",
    },
    goalDetailModalCard: {
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 22,
      backgroundColor: palette.surface,
      padding: 16,
      gap: 12,
    },
    goalDetailModalEyebrow: {
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      color: palette.accentStrong,
      fontWeight: "500",
    },
    goalDetailModalTitle: {
      fontSize: 22,
      lineHeight: 28,
      color: palette.text,
      fontWeight: "600",
    },
    goalDetailModalBody: {
      fontSize: 12,
      lineHeight: 18,
      color: palette.muted,
    },
    goalDetailTextarea: {
      minHeight: 156,
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 16,
      backgroundColor: palette.card,
      color: palette.text,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
      lineHeight: 20,
    },
    goalDetailModalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
    },
    resetConfirmBackdrop: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      backgroundColor: "rgba(15, 23, 42, 0.36)",
    },
    resetConfirmCard: {
      width: "100%",
      maxWidth: 320,
      borderWidth: 1,
      borderColor: palette.fail,
      borderRadius: 20,
      backgroundColor: palette.surface,
      padding: 16,
      gap: 12,
      shadowColor: "#000000",
      shadowOpacity: 0.16,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    resetConfirmHead: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    resetConfirmIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.card,
    },
    resetConfirmCopyWrap: {
      flex: 1,
      gap: 4,
    },
    resetConfirmTitle: {
      fontSize: 14,
      lineHeight: 19,
      color: palette.text,
      fontWeight: "600",
    },
    resetConfirmBody: {
      fontSize: 12,
      lineHeight: 17,
      color: palette.muted,
    },
    resetConfirmActions: {
      flexDirection: "row",
      gap: 8,
    },
    resetConfirmButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    resetConfirmButtonText: {
      fontSize: 13,
      fontWeight: "600",
    },
    cancelResetButton: {
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.card,
    },
    cancelResetButtonText: {
      color: palette.text,
    },
    acceptResetButton: {
      backgroundColor: palette.fail,
    },
    acceptResetButtonText: {
      color: palette.onAccent,
    },
    scrollTopButton: {
      position: "absolute",
      right: 16,
      bottom: 16,
      width: 38,
      height: 38,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.accent,
      borderWidth: 1,
      borderColor: palette.accent,
    },
    scrollTopChevron: {
      width: 14,
      height: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: -1,
    },
    scrollTopChevronStroke: {
      width: 8,
      height: 2.25,
      borderRadius: 999,
      backgroundColor: palette.onAccent,
    },
    scrollTopChevronLeft: {
      transform: [{ rotate: "-45deg" }],
      marginRight: -1.5,
    },
    scrollTopChevronRight: {
      transform: [{ rotate: "45deg" }],
      marginLeft: -1.5,
    },
  });
}
