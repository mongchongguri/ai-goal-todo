import { useState } from "react";
import { usePlannerStore } from "./hooks/usePlannerStore.js";
import { BottomNavigation } from "./components/BottomNavigation.jsx";
import { MainTab } from "./components/MainTab.jsx";
import { CalendarTab } from "./components/CalendarTab.jsx";
import { SettingsTab } from "./components/SettingsTab.jsx";

const TABS = [
  { id: "main", label: "홈" },
  { id: "calendar", label: "캘린더" },
  { id: "settings", label: "설정" },
];

export default function App() {
  const planner = usePlannerStore();
  const { state } = planner;
  const [activeTab, setActiveTab] = useState("main");

  return (
    <div className="app-shell">
      <div className="workspace-shell">
        <main className="tab-content-shell">
          {activeTab === "main" && (
            <MainTab
              state={state}
              health={planner.health}
              isGenerating={planner.isGenerating}
              errorMessage={planner.errorMessage}
              onAddTask={planner.addManualTask}
              onUpdateTaskStatus={planner.updateTaskStatus}
              onUpdateTaskTitle={planner.updateManualTaskTitle}
              onDeleteTask={planner.deleteTask}
              onAddAiTasks={planner.addAiTasks}
              onOpenSettings={() => setActiveTab("settings")}
            />
          )}

          {activeTab === "calendar" && (
            <CalendarTab
              currentDate={state.currentDate}
              currentTasks={state.tasks}
              history={state.history}
              preferences={state.preferences}
              onUpdateTaskStatus={planner.updateCalendarTaskStatus}
              onUpdateTaskTitle={planner.updateCalendarTaskTitle}
              onDeleteTask={planner.deleteCalendarTask}
            />
          )}

          {activeTab === "settings" && (
            <SettingsTab
              state={state}
              health={planner.health}
              isGenerating={planner.isGenerating}
              errorMessage={planner.errorMessage}
              notificationPermission={planner.notificationPermission}
              onSubmitGoal={planner.setGoal}
              onSetTheme={planner.setTheme}
              onSetNotificationSettings={planner.setNotificationSettings}
              onSetPlanningSettings={planner.setPlanningSettings}
              onSetCalendarSettings={planner.setCalendarSettings}
              onRequestNotificationPermission={planner.requestNotificationPermission}
              onRetry={planner.retryPlan}
              onReset={planner.reset}
            />
          )}
        </main>
      </div>

      <BottomNavigation tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
}
