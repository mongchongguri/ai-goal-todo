import { useRef, useState } from "react";

function isInteractiveTaskTarget(target) {
  return target.closest("button, input, textarea, label");
}

function EditIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M5 18.4V21h2.6l9.9-9.9-2.6-2.6L5 18.4Zm14.7-10c.4-.4.4-1 0-1.4L18 5.3c-.4-.4-1-.4-1.4 0l-1 1 2.6 2.6 1.5-1.5Z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M7 21c-1.1 0-2-.9-2-2V8h14v11c0 1.1-.9 2-2 2H7ZM9 4h6l1 2h4v2H4V6h4l1-2Zm0 7v7h2v-7H9Zm4 0v7h2v-7h-2Z" />
    </svg>
  );
}

function buildTaskBadges(task) {
  const badges = [];

  if (task.source === "carryover") {
    badges.push({ className: "badge badge-carry", label: "이월 반영" });
  } else if (task.manual) {
    badges.push({ className: "badge badge-manual", label: "직접 추가" });
  } else {
    badges.push({ className: "badge badge-ai", label: "AI 추천" });
  }

  if (task.carryoverCount > 0) {
    badges.push({ className: "badge badge-carry", label: `${task.carryoverCount}회 누적` });
  }

  return badges;
}

export function TaskItem({ task, onToggleDone, onDelete, onUpdateTitle }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const pointerRef = useRef({ x: 0, y: 0, preventToggle: false });

  const toggleTaskDone = () => {
    setOpen(false);
    onToggleDone(task.id, task.status === "done" ? "pending" : "done");
  };

  const handlePointerDown = (event) => {
    if (isInteractiveTaskTarget(event.target)) {
      return;
    }

    pointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      preventToggle: false,
    };
  };

  const handlePointerUp = (event) => {
    if (isInteractiveTaskTarget(event.target)) {
      return;
    }

    const deltaX = event.clientX - pointerRef.current.x;
    const deltaY = Math.abs(event.clientY - pointerRef.current.y);
    pointerRef.current.preventToggle = Math.abs(deltaX) > 8 || deltaY > 8;

    if (deltaY > 32) {
      return;
    }

    if (deltaX < -34) {
      setOpen(true);
    } else if (deltaX > 28) {
      setOpen(false);
    }
  };

  const handleCardClick = (event) => {
    if (editing || isInteractiveTaskTarget(event.target)) {
      return;
    }

    if (pointerRef.current.preventToggle) {
      pointerRef.current.preventToggle = false;
      return;
    }

    toggleTaskDone();
  };

  const handleCardKeyDown = (event) => {
    if (editing || isInteractiveTaskTarget(event.target)) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleTaskDone();
    }
  };

  const startEdit = () => {
    if (!task.manual) {
      return;
    }

    setDraftTitle(task.title);
    setEditing(true);
    setOpen(false);
  };

  const handleDelete = () => {
    setOpen(false);

    if (window.confirm("정말로 삭제하시겠습니까?")) {
      onDelete(task.id);
    }
  };

  const submitEdit = (event) => {
    event.preventDefault();
    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      return;
    }

    onUpdateTitle(task.id, nextTitle);
    setEditing(false);
  };

  return (
    <div className={`task-swipe-shell ${open ? "is-open" : ""} ${task.manual ? "has-edit" : "delete-only"}`}>
      <div className="task-swipe-actions" aria-hidden={!open}>
        {task.manual && (
          <button className="task-swipe-button edit" type="button" onClick={startEdit} aria-label="할일 수정">
            <EditIcon />
          </button>
        )}
        <button className="task-swipe-button delete" type="button" onClick={handleDelete} aria-label="할일 삭제">
          <DeleteIcon />
        </button>
      </div>

      <article
        className={`task-card status-${task.status}`}
        role={editing ? undefined : "button"}
        tabIndex={editing ? undefined : 0}
        aria-pressed={editing ? undefined : task.status === "done"}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <label className="task-check-wrapper" aria-label={`${task.title} 완료 처리`}>
          <input
            type="checkbox"
            checked={task.status === "done"}
            onChange={(event) => {
              setOpen(false);
              onToggleDone(task.id, event.target.checked ? "done" : "pending");
            }}
          />
          <span className="task-checkbox" aria-hidden="true" />
        </label>

        <div className="task-content">
          <div className="task-meta-row">
            {buildTaskBadges(task).map((badge) => (
              <span key={`${task.id}-${badge.label}`} className={badge.className}>
                {badge.label}
              </span>
            ))}
            <span className="task-note-inline">{task.note || "오늘 계획 반영"}</span>
          </div>

          {editing ? (
            <form className="task-edit-form" onSubmit={submitEdit}>
              <input
                autoFocus
                maxLength="120"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
              />
              <div className="task-edit-actions">
                <button className="primary-button" type="submit">
                  저장
                </button>
                <button className="ghost-button" type="button" onClick={() => setEditing(false)}>
                  취소
                </button>
              </div>
            </form>
          ) : (
            <p className="task-title">{task.title}</p>
          )}
        </div>
      </article>
    </div>
  );
}

export function MainTab({
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
  const { goal, tasks, insight } = state;
  const goals = Array.isArray(state.goals) && state.goals.length > 0 ? state.goals : goal ? [goal] : [];
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const pendingCount = tasks.filter((task) => task.status !== "done").length;
  const carryoverCount = tasks.filter((task) => task.source === "carryover").length;
  const showGoalNotice = !goal;
  const showEmptyTasks = tasks.length === 0 && !isGenerating;
  const aiStatusLabel = health.disabled
    ? "AI 추천 비활성"
    : health.ready
      ? "AI 추천 준비 완료"
      : "AI 연결 확인 필요";

  const handleManualSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("manualTask") || "").trim();
    if (!title) {
      return;
    }
    onAddTask(title);
    event.currentTarget.reset();
  };

  return (
    <div className="tab-stack">
      <section className="section-shell">
        <div className="section-head">
          <div>
            <p className="section-label">Main</p>
            <h2>현재 집중 영역</h2>
          </div>
          <div className="section-actions">
            <button className="ghost-button" type="button" onClick={onOpenSettings}>
              목표 설정
            </button>
          </div>
        </div>

        <div className="summary-grid">
          <article className="summary-card">
            <strong>올해 목표</strong>
            {goals.length > 0 ? (
              <ul className="goal-summary-list">
                {goals.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p>아직 목표가 없습니다. 설정 탭에서 목표와 난이도를 저장해 주세요.</p>
            )}
            {goals.length > 0 && <span className="summary-highlight">오늘 기준으로 자동 재계산 중</span>}
          </article>

          <article className="summary-card">
            <strong>오늘 집중 방향</strong>
            <p>{goal ? insight : "목표가 정해지면 오늘의 우선순위와 실행 방향을 여기에 정리합니다."}</p>
          </article>

          <article className="summary-card">
            <strong>진행 현황</strong>
            <p>{`완료 ${doneCount}개, 남은 일 ${pendingCount}개, 이월 ${carryoverCount}개`}</p>
            <span className="summary-highlight">{aiStatusLabel}</span>
          </article>
        </div>
      </section>

      <section className="section-shell">
        <div className="section-head">
          <div>
            <p className="section-label">Today</p>
            <h2>오늘 할 일 목록</h2>
          </div>
          <div className="today-head-actions">
            <span className="panel-chip">{`${doneCount} / ${tasks.length} 완료`}</span>
            {goal && (
              <button className="secondary-button compact-button" type="button" onClick={onRegenerate} disabled={isGenerating || health.disabled}>
                {health.disabled ? "AI 비활성" : "AI 새로고침"}
              </button>
            )}
          </div>
        </div>

        {isGenerating && (
          <div className="status-banner is-loading">
            <strong>오늘 계획 생성 중</strong>
            <p>최근 기록과 미완료 작업을 바탕으로 오늘 해야 할 일을 다시 계산하고 있습니다.</p>
          </div>
        )}

        {!isGenerating && errorMessage && (
          <div className="status-banner is-error">
            <strong>{health.disabled ? "AI 추천 비활성" : "AI 요청 실패"}</strong>
            <p>{errorMessage}</p>
          </div>
        )}

        {showGoalNotice && (
          <div className="status-banner is-warning">
            <strong>목표가 아직 없습니다</strong>
            <p>목표가 없어도 직접 할 일을 추가할 수 있습니다. AI 추천은 목표를 저장한 뒤 사용할 수 있습니다.</p>
          </div>
        )}

        {showEmptyTasks && (
          <div className="empty-state-card">
            <strong>{goal ? (health.disabled ? "AI 추천 비활성 상태" : "오늘 할 일 없음") : "추가된 할 일 없음"}</strong>
            <p>
              {goal
                ? (health.disabled
                ? "백엔드 서버가 연결되지 않아 AI 추천을 만들 수 없습니다. 직접 할 일을 추가해서 사용해 주세요."
                : "현재는 표시할 작업이 없습니다. 잠시 후 다시 계산하거나 설정을 조정해 주세요.")
                : "아래 입력창에서 오늘 할 일을 직접 추가해 사용해 주세요."}
            </p>
          </div>
        )}

        <div className="task-board">
          {tasks.length > 0 && (
            <div className="task-list">
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggleDone={onUpdateTaskStatus}
                  onDelete={onDeleteTask}
                  onUpdateTitle={onUpdateTaskTitle}
                />
              ))}
            </div>
          )}

          <form className="task-form" onSubmit={handleManualSubmit}>
            <label className="field-label" htmlFor="manualTask">
              직접 할 일 추가
            </label>
            <div className="task-input-row">
              <input
                id="manualTask"
                name="manualTask"
                maxLength="120"
                placeholder="예: 영어 뉴스 15분 듣기"
                type="text"
              />
              <button className="primary-button" type="submit">
                추가
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
