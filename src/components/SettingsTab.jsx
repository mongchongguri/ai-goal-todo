import { useEffect, useState } from "react";
import { DEFAULT_DAILY_UPDATE_TIME } from "../core/config.js";

function permissionLabel(permission) {
  if (permission === "granted") {
    return "허용됨";
  }
  if (permission === "denied") {
    return "차단됨";
  }
  if (permission === "unsupported") {
    return "브라우저 미지원";
  }
  return "아직 확인 전";
}

function DifficultyOption({ active, title, description, onClick }) {
  return (
    <button className={`difficulty-card ${active ? "is-active" : ""}`} type="button" onClick={onClick}>
      <span className="difficulty-title">{title}</span>
      <span className="difficulty-desc">{description}</span>
    </button>
  );
}

function difficultyLabel(value) {
  if (value === "easy") {
    return "가볍게";
  }
  if (value === "hard") {
    return "강하게";
  }
  return "균형 있게";
}

function toGoalInputs(state) {
  const goals = Array.isArray(state.goals) && state.goals.length > 0
    ? state.goals
    : String(state.goal || "").trim()
      ? [state.goal]
      : [""];
  return goals.map((goal) => String(goal || ""));
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

function scrollToSettingsSection(sectionId) {
  const target = document.querySelector(`[data-settings-section="${sectionId}"]`);
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SummaryNavCard({ title, description, target, children }) {
  return (
    <button className="summary-card summary-nav-card" type="button" onClick={() => scrollToSettingsSection(target)}>
      <span className="summary-nav-head">
        <strong>{title}</strong>
        <span className="summary-nav-cue">이동 ›</span>
      </span>
      <p>{description}</p>
      {children}
    </button>
  );
}

export function SettingsTab({
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
  const [goalValues, setGoalValues] = useState(() => toGoalInputs(state));
  const [difficultyValue, setDifficultyValue] = useState(state.difficulty);
  const [legalView, setLegalView] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    setGoalValues(toGoalInputs(state));
  }, [state.goal, state.goals]);

  useEffect(() => {
    setDifficultyValue(state.difficulty);
  }, [state.difficulty]);

  useEffect(() => {
    const updateScrollButton = () => {
      setShowScrollTop(window.scrollY > 360);
    };

    updateScrollButton();
    window.addEventListener("scroll", updateScrollButton, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateScrollButton);
    };
  }, []);

  const handleGoalSubmit = (event) => {
    event.preventDefault();
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

  const updateGoalValue = (index, value) => {
    setGoalValues((previous) => previous.map((goal, goalIndex) => (goalIndex === index ? value : goal)));
  };

  const addGoalInput = () => {
    setGoalValues((previous) => (previous.length >= 8 ? previous : [...previous, ""]));
  };

  const removeGoalInput = (index) => {
    setGoalValues((previous) => {
      const next = previous.filter((_, goalIndex) => goalIndex !== index);
      return next.length > 0 ? next : [""];
    });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="tab-stack">
      <section className="section-shell" data-settings-section="ai">
        <div className="section-head">
          <div>
            <p className="section-label">Settings</p>
            <h2>앱 설정</h2>
          </div>
          <div className="section-actions">
            <button className="secondary-button" type="button" onClick={onRetry} disabled={isGenerating || health.disabled}>
              {health.disabled ? "AI 비활성" : "AI 연결 확인"}
            </button>
          </div>
        </div>

        <div className="summary-grid">
          <article className="summary-card">
            <strong>AI 추천 상태</strong>
            <p>
              {health.disabled
                ? "현재 서버에 접근할 수 없어 AI 상태 확인 및 추천 기능을 사용할 수 없습니다."
                : health.ready
                  ? "AI 연결 상태가 정상입니다."
                  : health.error || "현재 서버에 접근할 수 없어 AI 상태 확인 및 추천 기능을 사용할 수 없습니다."}
            </p>
          </article>
          <SummaryNavCard
            title="목표 설정"
            description={state.goals.length > 0 ? `${state.goals.length}개 목표와 ${difficultyLabel(state.difficulty)} 난이도를 사용 중입니다.` : "올해 목표와 실행 난이도를 설정합니다."}
            target="goal"
          />
          <SummaryNavCard
            title="현재 모드"
            description={state.preferences.theme === "dark" ? "다크 모드" : "화이트 모드"}
            target="display"
          />
          <SummaryNavCard
            title="알림 시간"
            description={state.preferences.notificationsEnabled ? `${state.preferences.reminderTime}에 푸시 알림` : "푸시 알림이 꺼져 있습니다."}
            target="notifications"
          />
          <SummaryNavCard
            title="할 일 업데이트"
            description={`${state.preferences.dailyUpdateTime} 기준으로 새 할 일을 준비합니다.`}
            target="schedule"
          />
          <SummaryNavCard
            title="실패 반영"
            description={state.preferences.considerMissedTasks ? "미완료 항목을 다음 추천에 반영합니다." : "미완료 항목을 다음 추천에서 제외합니다."}
            target="schedule"
          />
          <SummaryNavCard
            title="완료 개수 반영"
            description={state.preferences.countCompletedTasksInPlan ? "완료한 AI 할 일을 새 추천 개수에서 차감합니다." : "완료한 할 일과 별도로 새 추천 개수를 유지합니다."}
            target="schedule"
          />
        </div>

        {errorMessage && (
          <div className="status-banner is-error">
            <strong>알림</strong>
            <p>{errorMessage}</p>
          </div>
        )}
      </section>

      <section className="section-shell" data-settings-section="goal">
        <div className="section-head">
          <div>
            <p className="section-label">Goal</p>
            <h2>목표 및 난이도 설정</h2>
          </div>
        </div>

        <form className="settings-grid" onSubmit={handleGoalSubmit}>
          <article className="setting-card form-span">
            <div className="goal-input-head">
              <label className="field-label" htmlFor="goalValue-0">
                올해 목표
              </label>
              <div className="goal-head-actions">
                <button className="ghost-button compact-button" type="button" onClick={addGoalInput} disabled={goalValues.length >= 8}>
                  목표 추가
                </button>
                <button className="primary-button compact-button" type="submit">
                  목표 저장
                </button>
              </div>
            </div>
            <div className="goal-input-list">
              {goalValues.map((goal, index) => (
                <div className="goal-input-row" key={`goal-input-${index}`}>
                  <input
                    id={`goalValue-${index}`}
                    className="goal-input"
                    type="text"
                    maxLength="80"
                    placeholder={index === 0 ? "예: 올해 안에 영어로 자연스럽게 대화하기" : "추가 목표 입력"}
                    value={goal}
                    onChange={(event) => updateGoalValue(index, event.target.value)}
                  />
                  <button
                    className="ghost-button compact-button"
                    type="button"
                    onClick={() => removeGoalInput(index)}
                    disabled={goalValues.length === 1}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
            <p className="setting-note">
              저장된 목표들을 함께 고려해 오늘 처리할 적정 개수의 할 일을 만듭니다.
            </p>
          </article>

          <article className="setting-card form-span">
            <h3>실행 난이도</h3>
            <div className="difficulty-grid">
              <DifficultyOption
                active={difficultyValue === "easy"}
                title="가볍게"
                description="부담을 줄이고 꾸준히 이어가는 방식"
                onClick={() => setDifficultyValue("easy")}
              />
              <DifficultyOption
                active={difficultyValue === "balanced"}
                title="균형 있게"
                description="지속성과 성과를 함께 챙기는 방식"
                onClick={() => setDifficultyValue("balanced")}
              />
              <DifficultyOption
                active={difficultyValue === "hard"}
                title="강하게"
                description="속도를 높여 성과를 끌어올리는 방식"
                onClick={() => setDifficultyValue("hard")}
              />
            </div>
          </article>
        </form>
      </section>

      <section className="section-shell" data-settings-section="schedule">
        <div className="section-head">
          <div>
            <p className="section-label">Schedule</p>
            <h2>할 일 업데이트 시간</h2>
          </div>
        </div>

        <div className="settings-grid">
          <article className="setting-card">
            <h3>자동 업데이트 시간</h3>
            <input
              className="time-input"
              type="time"
              value={state.preferences.dailyUpdateTime}
              onChange={(event) => onSetPlanningSettings({ dailyUpdateTime: event.target.value })}
            />
            <p className="setting-note">
              기본값은 {DEFAULT_DAILY_UPDATE_TIME}입니다. 이 시간이 지나면 이전 할 일 기록을 반영해 새 계획을 만듭니다.
            </p>
          </article>

          <article className="setting-card">
            <h3>업데이트 방식</h3>
            <p>
              설정한 시간 전까지는 기존 할 일 목록을 유지하고, 시간이 지나면 완료/실패/미완료 기록을 바탕으로 다음 할 일을 다시 추천합니다.
            </p>
          </article>

          <button
            className="setting-card setting-switch-card"
            type="button"
            onClick={() => onSetPlanningSettings({ considerMissedTasks: !state.preferences.considerMissedTasks })}
            aria-pressed={state.preferences.considerMissedTasks}
          >
            <div className="setting-switch">
              <div>
                <h3>전날 실패건 반영</h3>
                <p className="setting-note">켜면 체크하지 못한 할 일을 다음 AI 추천에서 실패로 고려합니다.</p>
              </div>
              <span className={`toggle-pill ${state.preferences.considerMissedTasks ? "is-active" : ""}`} aria-hidden="true" />
            </div>
          </button>

          <button
            className="setting-card setting-switch-card"
            type="button"
            onClick={() => onSetPlanningSettings({ countCompletedTasksInPlan: !state.preferences.countCompletedTasksInPlan })}
            aria-pressed={state.preferences.countCompletedTasksInPlan}
          >
            <div className="setting-switch">
              <div>
                <h3>완료 개수 포함</h3>
                <p className="setting-note">켜면 이미 완료한 AI 할 일 수를 고려해 새 추천 개수를 줄입니다.</p>
              </div>
              <span className={`toggle-pill ${state.preferences.countCompletedTasksInPlan ? "is-active" : ""}`} aria-hidden="true" />
            </div>
          </button>
        </div>
      </section>

      <section className="section-shell" data-settings-section="display">
        <div className="section-head">
          <div>
            <p className="section-label">Display</p>
            <h2>화면 모드</h2>
          </div>
        </div>

        <div className="settings-grid">
          <article className="setting-card">
            <h3>테마 선택</h3>
            <div className="theme-button-group">
              <button
                className={`theme-button ${state.preferences.theme === "light" ? "is-active" : ""}`}
                type="button"
                onClick={() => onSetTheme("light")}
              >
                화이트 모드
              </button>
              <button
                className={`theme-button ${state.preferences.theme === "dark" ? "is-active" : ""}`}
                type="button"
                onClick={() => onSetTheme("dark")}
              >
                다크 모드
              </button>
            </div>
            <p className="setting-note">카드 구조는 유지하면서 색상과 대비만 바뀝니다.</p>
          </article>
        </div>
      </section>

      <section className="section-shell" data-settings-section="notifications">
        <div className="section-head">
          <div>
            <p className="section-label">Notifications</p>
            <h2>알림 설정</h2>
          </div>
        </div>

        <div className="settings-grid">
          <button
            className="setting-card setting-switch-card"
            type="button"
            onClick={handleNotificationToggle}
            aria-pressed={state.preferences.notificationsEnabled}
          >
            <div className="setting-switch">
              <div>
                <h3>푸시 알림 사용</h3>
                <p className="setting-note">정해진 시간에 오늘 할 일 점검 알림을 보냅니다.</p>
              </div>
              <span className={`toggle-pill ${state.preferences.notificationsEnabled ? "is-active" : ""}`} aria-hidden="true" />
            </div>
          </button>

          <article className="setting-card">
            <h3>알림 시간</h3>
            <input
              className="time-input"
              type="time"
              value={state.preferences.reminderTime}
              onChange={(event) => onSetNotificationSettings({ reminderTime: event.target.value })}
            />
            <p className="setting-note">{`푸시 권한 상태: ${permissionLabel(notificationPermission)}`}</p>
          </article>
        </div>
      </section>

      <section className="section-shell" data-settings-section="data">
        <div className="section-head">
          <div>
            <p className="section-label">Data</p>
            <h2>기타 관리</h2>
          </div>
        </div>

        <div className="settings-grid">
          <article className="setting-card">
            <h3>데이터 초기화</h3>
            <p>현재 목표, 오늘 목록, 기록, 설정을 모두 초기화하고 처음 상태로 되돌립니다.</p>
            <button className="ghost-button" type="button" onClick={onReset}>
              앱 데이터 초기화
            </button>
          </article>
        </div>
      </section>

      <section className="section-shell legal-section">
        <div className="legal-links">
          <button type="button" onClick={() => setLegalView((current) => (current === "privacy" ? "" : "privacy"))}>
            개인정보처리방침
          </button>
          <button type="button" onClick={() => setLegalView((current) => (current === "terms" ? "" : "terms"))}>
            이용약관
          </button>
        </div>

        {legalView === "privacy" && (
          <article className="legal-panel">
            <h3>개인정보처리방침</h3>
            <p>이 앱은 목표, 할 일, 완료 기록, 설정값을 사용자의 브라우저 로컬 저장소에 저장합니다.</p>
            <p>AI 추천 생성을 위해 목표와 할 일 기록 일부가 서버를 통해 AI 제공자에게 전송될 수 있습니다.</p>
            <p>앱 운영에 불필요한 개인정보는 요구하지 않으며, 사용자는 앱 데이터 초기화로 로컬 데이터를 삭제할 수 있습니다.</p>
          </article>
        )}

        {legalView === "terms" && (
          <article className="legal-panel">
            <h3>이용약관</h3>
            <p>AI 추천은 목표 달성을 돕기 위한 참고용이며, 실제 실행 여부와 결과에 대한 책임은 사용자에게 있습니다.</p>
            <p>서비스는 네트워크, AI 제공자 한도, 브라우저 환경에 따라 일시적으로 제한될 수 있습니다.</p>
            <p>사용자는 불법적이거나 타인의 권리를 침해하는 목적으로 앱을 사용할 수 없습니다.</p>
          </article>
        )}
      </section>

      {showScrollTop && (
        <button className="settings-scroll-top" type="button" onClick={scrollToTop} aria-label="설정 맨 위로 이동">
          <span className="settings-scroll-top-icon" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
