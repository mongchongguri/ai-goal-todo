export const STORAGE_KEY = "ai-goal-planner-v1";
export const DEFAULT_DAILY_UPDATE_TIME = "09:00";

export const DIFFICULTY_CONFIG = {
  easy: {
    label: "가볍게",
    baseTasks: 3,
    focusMinutes: 25,
    guidance: "부담을 줄이고 매일 이어가는 방식",
  },
  balanced: {
    label: "균형 있게",
    baseTasks: 4,
    focusMinutes: 45,
    guidance: "지속성과 성과를 함께 챙기는 방식",
  },
  hard: {
    label: "강하게",
    baseTasks: 5,
    focusMinutes: 70,
    guidance: "성과를 더 빠르게 끌어올리는 방식",
  },
};

export const PLAN_REASON_LABELS = {
  startup: "앱을 열어 오늘 계획을 확인하는 중",
  goalUpdate: "목표 또는 난이도가 바뀌어 계획을 다시 계산하는 중",
  rollover: "업데이트 시간이 지나 이전 기록을 반영하는 중",
  scheduleUpdate: "업데이트 시간이 변경되어 계획을 다시 계산하는 중",
  manualRefresh: "사용자가 AI 추천을 다시 요청한 상태",
};
