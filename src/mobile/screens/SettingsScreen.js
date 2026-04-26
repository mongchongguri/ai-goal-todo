import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
import { TimePickerField } from "../components/TimePickerField.js";

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
  if (Array.isArray(state.goals) && state.goals.length > 0) {
    return state.goals;
  }

  return state.goal.trim() ? [state.goal] : [""];
}

function cleanGoalInputs(values) {
  const seen = new Set();

  return values
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function serializeGoalInputs(values) {
  return values.map((value) => String(value || "")).join("\u0001");
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
  const [legalView, setLegalView] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const sectionOffsetsRef = useRef({});
  const scrollRef = useRef(null);

  useEffect(() => {
    setGoalValues(externalGoalValues);
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
    onSubmitGoal(cleanGoalInputs(goalValues), difficultyValue);
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
    Alert.alert("데이터 초기화", "목표, 할 일, 기록, 설정을 모두 초기화하시겠습니까?", [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: "초기화",
        style: "destructive",
        onPress: () => {
          void onReset();
        },
      },
    ]);
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
                description={state.goals.length > 0
                  ? `${state.goals.length}개 목표와 ${difficultyLabel(state.difficulty)} 난이도를 사용 중입니다.`
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
            <SectionHeader palette={palette} label="Goal" title="목표 및 난이도 설정" />

            <View style={styles.formCard}>
              <View style={styles.goalHead}>
                <Text style={styles.fieldHeading}>올해 목표</Text>
                <View style={styles.goalHeadActions}>
                  <OutlineButton
                    palette={palette}
                    compact
                    label="목표 추가"
                    onPress={() => setGoalValues((previous) => (
                      previous.length >= 8 ? previous : [...previous, ""]
                    ))}
                  />
                  <PrimaryButton palette={palette} compact label="목표 저장" onPress={handleGoalSubmit} />
                </View>
              </View>

              <View style={styles.goalList}>
                {goalValues.map((goal, index) => (
                  <View key={`goal-${index}`} style={styles.goalRow}>
                    <TextInput
                      value={goal}
                      onChangeText={(value) => setGoalValues((previous) => previous.map((item, itemIndex) => (
                        itemIndex === index ? value : item
                      )))}
                      placeholder={index === 0 ? "예: 정보처리기사 자격증 공부" : "추가 목표 입력"}
                      placeholderTextColor={palette.muted}
                      style={styles.goalInput}
                      maxLength={80}
                    />
                    <OutlineButton
                      palette={palette}
                      compact
                      label="삭제"
                      disabled={goalValues.length === 1}
                      onPress={() => setGoalValues((previous) => {
                        const next = previous.filter((_, itemIndex) => itemIndex !== index);
                        return next.length > 0 ? next : [""];
                      })}
                    />
                  </View>
                ))}
              </View>

              <Text style={styles.settingNote}>
                저장된 목표들을 함께 고려해 오늘 처리할 적정 개수의 할 일을 만듭니다.
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

      {showScrollTop ? (
        <Pressable
          style={styles.scrollTopButton}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        >
          <Text style={styles.scrollTopText}>^</Text>
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
      gap: 8,
    },
    goalRow: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
    },
    goalInput: {
      flex: 1,
      minHeight: 46,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.cardMuted,
      color: palette.text,
      fontSize: 14,
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
    scrollTopText: {
      color: palette.onAccent,
      fontSize: 16,
      lineHeight: 16,
      fontWeight: "500",
      marginTop: -2,
    },
  });
}
