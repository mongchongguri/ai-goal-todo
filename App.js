import { useEffect, useMemo, useState } from "react";
import { Keyboard, StyleSheet, View, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { usePlannerStore } from "./src/mobile/usePlannerStore.js";
import { getThemePalette } from "./src/mobile/theme.js";
import { BottomNavigation } from "./src/mobile/components/BottomNavigation.js";
import { HomeScreen } from "./src/mobile/screens/HomeScreen.js";
import { CalendarScreen } from "./src/mobile/screens/CalendarScreen.js";
import { SettingsScreen } from "./src/mobile/screens/SettingsScreen.js";

const TABS = [
  { id: "home", label: "홈" },
  { id: "calendar", label: "캘린더" },
  { id: "settings", label: "설정" },
];

export default function App() {
  const planner = usePlannerStore();
  const [activeTab, setActiveTab] = useState("home");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const palette = getThemePalette(planner.state.preferences.theme);
  const styles = useMemo(() => createStyles(palette), [palette]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (!planner.ready) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
          <StatusBar style={planner.state.preferences.theme === "dark" ? "light" : "dark"} />
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingTitle}>앱 데이터를 불러오는 중</Text>
            <Text style={styles.loadingBody}>저장된 목표와 오늘 할 일을 동기화하고 있습니다.</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar style={planner.state.preferences.theme === "dark" ? "light" : "dark"} />
        <View style={styles.appShell}>
          <View style={styles.screenWrap}>
            {activeTab === "home" ? (
              <HomeScreen
                palette={palette}
                state={planner.state}
                health={planner.health}
                isGenerating={planner.isGenerating}
                errorMessage={planner.errorMessage}
                onAddTask={planner.addManualTask}
                onUpdateTaskStatus={planner.updateTaskStatus}
                onUpdateTaskTitle={planner.updateManualTaskTitle}
                onDeleteTask={planner.deleteTask}
                onRegenerate={planner.regenerate}
                onOpenSettings={() => setActiveTab("settings")}
              />
            ) : null}

            {activeTab === "calendar" ? (
              <CalendarScreen
                palette={palette}
                currentDate={planner.state.currentDate}
                currentTasks={planner.state.tasks}
                history={planner.state.history}
                preferences={planner.state.preferences}
                onUpdateTaskStatus={planner.updateCalendarTaskStatus}
                onUpdateTaskTitle={planner.updateCalendarTaskTitle}
                onDeleteTask={planner.deleteCalendarTask}
              />
            ) : null}

            {activeTab === "settings" ? (
              <SettingsScreen
                palette={palette}
                state={planner.state}
                health={planner.health}
                isGenerating={planner.isGenerating}
                errorMessage={planner.errorMessage}
                notificationPermission={planner.notificationPermission}
                onSubmitGoal={planner.setGoal}
                onSetTheme={planner.setTheme}
                onSetNotificationSettings={planner.setNotificationSettings}
                onSetPlanningSettings={planner.setPlanningSettings}
                onRequestNotificationPermission={planner.requestNotificationPermission}
                onRetry={planner.retryPlan}
                onReset={planner.reset}
              />
            ) : null}
          </View>

          {!keyboardVisible ? (
            <BottomNavigation
              palette={palette}
              tabs={TABS}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
          ) : null}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function createStyles(palette) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: palette.background,
    },
    appShell: {
      flex: 1,
      width: "100%",
      maxWidth: 430,
      alignSelf: "center",
      backgroundColor: palette.background,
    },
    screenWrap: {
      flex: 1,
    },
    loadingWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
      gap: 8,
    },
    loadingTitle: {
      fontSize: 20,
      lineHeight: 24,
      color: palette.text,
      fontWeight: "500",
    },
    loadingBody: {
      fontSize: 14,
      lineHeight: 20,
      color: palette.muted,
      textAlign: "center",
    },
  });
}
