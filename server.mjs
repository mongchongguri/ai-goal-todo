import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.argv.includes("--prod") || process.env.NODE_ENV === "production";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const HOLIDAY_API_BASE = "https://date.nager.at/api/v3/PublicHolidays";
const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_HOLIDAY_COUNTRY = "KR";
const DEFAULT_CORS_ORIGINS = ["capacitor://localhost", "ionic://localhost"];

const PLAN_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["insight", "tasks"],
  properties: {
    insight: { type: "string" },
    tasks: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "category", "reason"],
        properties: {
          title: { type: "string" },
          category: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
};

loadEnvFile(path.join(__dirname, ".env"));

const app = express();
const httpServer = http.createServer(app);
app.use(express.json({ limit: "256kb" }));
app.use(applyApiCors);

app.get("/healthz", (_request, response) => {
  const status = resolveGeminiStatus();
  response.status(200).json({
    ok: true,
    service: "ai-goal-todo-backend",
    aiReady: status.ready,
    cacheEnabled: status.cacheEnabled,
  });
});

app.get("/api/health", (_request, response) => {
  const status = resolveGeminiStatus();
  response.status(status.ready ? 200 : 503).json(status);
});

app.get("/api/holidays", async (request, response) => {
  const year = normalizeHolidayYear(request.query.year);
  const countryCode = normalizeHolidayCountry(request.query.country);

  if (!year) {
    response.status(400).json({ error: "year 값이 올바르지 않습니다." });
    return;
  }

  try {
    const holidays = await requestPublicHolidays(year, countryCode);

    response.json({
      countryCode,
      year,
      cacheHit: false,
      holidays,
    });
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : "공휴일 데이터를 가져오지 못했습니다.",
    });
  }
});

app.post("/api/plan", async (request, response) => {
  const validationError = validatePlanningPayload(request.body);
  if (validationError) {
    response.status(400).json({ error: validationError });
    return;
  }

  const status = resolveGeminiStatus();
  if (!status.ready) {
    response.status(503).json({
      error: status.error || "Gemini API key가 설정되지 않았습니다.",
    });
    return;
  }

  const promptInput = createPromptInput(request.body);

  try {
    const result = await requestGeminiPlan(promptInput, status);
    const plan = sanitizePlan(result.plan, request.body);

    response.json({
      provider: status.provider,
      model: status.model,
      cacheHit: false,
      usage: result.usage,
      plan,
    });
  } catch (error) {
    const statusCode = error instanceof GeminiRequestError
      ? mapGeminiStatus(error.statusCode)
      : 502;
    response.status(statusCode).json({
      error: formatPlanError(error),
    });
  }
});

if (isProduction) {
  const distPath = path.join(__dirname, "dist");
  const indexPath = path.join(distPath, "index.html");
  const hasDist = fs.existsSync(indexPath);

  if (hasDist) {
    app.use(express.static(distPath));
    app.use((_request, response) => {
      response.sendFile(indexPath);
    });
  } else {
    app.get("/", (_request, response) => {
      response.status(200).json({
        ok: true,
        service: "ai-goal-todo-backend",
      });
    });
  }
} else {
  const { default: react } = await import("@vitejs/plugin-react");
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    configFile: false,
    root: __dirname,
    cacheDir: path.join(__dirname, ".vite", `dev-${process.pid}`),
    plugins: [react()],
    optimizeDeps: {
      include: [],
      noDiscovery: true,
    },
    server: {
      middlewareMode: true,
      hmr: {
        server: httpServer,
      },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

const port = Number.parseInt(process.env.PORT || "3000", 10);
const host = compactText(process.env.HOST) || (isProduction ? "0.0.0.0" : "127.0.0.1");
httpServer.listen(port, host, () => {
  console.log(`AI Goal Planner server running at http://${host}:${port}`);
});

class GeminiRequestError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "GeminiRequestError";
    this.statusCode = statusCode;
  }
}

function resolveGeminiStatus() {
  const apiKey = compactText(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const model = compactText(process.env.GEMINI_MODEL) || DEFAULT_MODEL;

  return {
    provider: "gemini",
    reachable: Boolean(apiKey),
    ready: Boolean(apiKey && model),
    baseURL: GEMINI_API_BASE,
    configuredModel: compactText(process.env.GEMINI_MODEL),
    model,
    cacheEnabled: false,
    error: apiKey ? "" : "GEMINI_API_KEY가 없어 AI 계획을 만들 수 없습니다.",
  };
}

function applyApiCors(request, response, next) {
  if (!request.path.startsWith("/api/")) {
    next();
    return;
  }

  const origin = request.headers.origin;
  if (origin && isAllowedCorsOrigin(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
}

function isAllowedCorsOrigin(origin) {
  const configured = compactText(process.env.CORS_ORIGIN);
  if (configured) {
    const allowedOrigins = configured
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return allowedOrigins.includes("*") || allowedOrigins.includes(origin);
  }

  return isDefaultAllowedCorsOrigin(origin);
}

function isDefaultAllowedCorsOrigin(origin) {
  if (DEFAULT_CORS_ORIGINS.includes(origin)) {
    return true;
  }

  try {
    const parsed = new URL(origin);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

async function requestGeminiPlan(promptInput, status) {
  const endpoint = `${GEMINI_API_BASE}/models/${encodeURIComponent(status.model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": status.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: [
              "너는 연간 목표 달성을 돕는 한국어 플래너다.",
              "항상 JSON만 반환한다.",
              "오늘 하루 안에 가능한 할 일만 제안한다.",
              "수동 추가 항목, 이미 완료한 항목, 같은 의미의 중복 작업은 다시 만들지 않는다.",
              "여러 목표가 있어도 목표별로 하나씩 만들지 않는다.",
              "목표가 많으면 가장 중요한 2~3개 목표만 골라 daily_target 안에서 압축한다.",
              "consider_missed=true이고 실패나 미완료가 있으면 실행 강도를 한 단계 높여 더 적극적인 계획을 만든다.",
              "consider_missed=false이면 실패나 미완료 이력을 판단에 사용하지 않는다.",
              "count_completed=true이면 이미 완료한 AI 할 일이 daily_target 계산에 반영된 상태이므로 daily_target만큼만 추가 제안한다.",
              "count_completed=false이면 완료 이력은 중복 방지에만 사용한다.",
              "task title은 짧고 바로 실행 가능한 한국어 문장으로 작성한다.",
              "reason은 24자 이내의 짧은 한국어로 작성한다.",
              "insight는 2문장 이하로 작성한다.",
            ].join(" "),
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildPlanningPrompt(promptInput),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: "application/json",
        responseJsonSchema: PLAN_RESPONSE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const message = await extractGeminiError(response);
    throw new GeminiRequestError(response.status, message);
  }

  const data = await response.json();
  const content = extractGeminiText(data);

  return {
    plan: parseJsonFromContent(content),
    usage: normalizeUsage(data?.usageMetadata),
  };
}

async function requestPublicHolidays(year, countryCode) {
  const endpoint = `${HOLIDAY_API_BASE}/${year}/${countryCode}`;
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`공휴일 API 요청이 실패했습니다. (${response.status})`);
  }

  const payload = await response.json();
  return sanitizeHolidayResponse(payload, countryCode);
}

function buildPlanningPrompt(input) {
  const lines = [
    `goal=${input.goal}`,
    `goal_count=${input.goals.length}`,
    renderListLine("goals", input.goals.map((goal, index) => `${index + 1}. ${goal}`)),
    `difficulty=${input.difficultyLabel} (${input.difficulty})`,
    `date=${input.currentDate}`,
    `phase=${input.phaseLabel}`,
    `reason=${input.planReason}`,
    `daily_target=${input.taskTarget}`,
    `focus_minutes=${input.focusMinutes}`,
    `consider_missed=${input.considerMissedTasks ? "true" : "false"}`,
    `count_completed=${input.countCompletedTasksInPlan ? "true" : "false"},completed_ai_today=${input.completedAiTodayCount}`,
    `recent=done:${input.recent.done},failed:${input.recent.failed},missed:${input.recent.missed},completion:${input.recent.completionRate},failure:${input.recent.failureRate}`,
    renderListLine("manual_tasks", input.manualTasks),
    renderListLine("done_today", input.completedTodayTasks),
    renderListLine("unfinished_ai", input.unfinishedAiTasks),
    renderListLine("unfinished_manual", input.unfinishedManualTasks),
    renderListLine("history", input.recentHistory),
    "rules=중복 금지, 목표별 1개씩 생성 금지, daily_target 초과 금지, 오늘 바로 실행 가능한 작업만 생성",
  ];

  return lines.join("\n");
}

function renderListLine(label, items) {
  return `${label}=${items.length ? items.join(" || ") : "-"}`;
}

function createPromptInput(payload) {
  const goals = normalizeGoals(payload.goals, payload.goal);
  return {
    goal: goals.join(" / "),
    goals,
    difficulty: compactText(payload.difficulty),
    difficultyLabel: compactText(payload.difficultyLabel) || compactText(payload.difficulty),
    currentDate: compactText(payload.currentDate),
    phaseLabel: compactText(payload.phaseLabel) || compactText(payload.phase),
    planReason: compactText(payload.planReason) || "startup",
    taskTarget: clampInteger(payload.taskTarget, 2, 6, 4),
    focusMinutes: clampInteger(payload.focusMinutes, 15, 180, 45),
    considerMissedTasks: payload.considerMissedTasks !== false,
    countCompletedTasksInPlan: payload.countCompletedTasksInPlan !== false,
    completedAiTodayCount: clampInteger(payload.completedAiTodayCount, 0, 99, 0),
    recent: {
      done: clampInteger(payload.recentSummary?.done, 0, 999, 0),
      failed: clampInteger(payload.recentSummary?.failed, 0, 999, 0),
      missed: clampInteger(payload.recentSummary?.missed, 0, 999, 0),
      completionRate: `${toPercent(payload.recentSummary?.completionRate)}%`,
      failureRate: `${toPercent(payload.recentSummary?.failureRate)}%`,
    },
    manualTasks: normalizeManualTasks(payload.manualTasks),
    completedTodayTasks: toTitleList(payload.completedTodayTasks).slice(0, 8),
    unfinishedAiTasks: normalizeCarryoverTasks(payload.unfinishedAiTasks),
    unfinishedManualTasks: normalizeCarryoverTasks(payload.unfinishedManualTasks),
    recentHistory: normalizeRecentHistory(payload.recentHistory),
  };
}

function normalizeManualTasks(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const title = compactText(item?.title);
      if (!title) {
        return "";
      }

      const status = ["pending", "done", "failed"].includes(item?.status) ? item.status : "pending";
      const carryoverCount = clampInteger(item?.carryoverCount, 0, 99, 0);
      return carryoverCount > 0
        ? `${title} [${status}, carry:${carryoverCount}]`
        : `${title} [${status}]`;
    })
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeGoals(value, fallback = "") {
  const rawItems = Array.isArray(value) && value.length > 0
    ? value
    : String(value || fallback || "").split(/\n|\/|,|;/u);
  const seen = new Set();
  const goals = [];

  rawItems.forEach((item) => {
    const goal = compactText(item);
    const key = goal.toLowerCase();
    if (!goal || seen.has(key)) {
      return;
    }

    seen.add(key);
    goals.push(goal);
  });

  return goals.slice(0, 8);
}

function normalizeCarryoverTasks(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const title = compactText(item?.title || item?.originalTitle);
      if (!title) {
        return "";
      }

      const status = ["failed", "missed", "pending"].includes(item?.lastStatus) ? item.lastStatus : "missed";
      const carryoverCount = clampInteger(item?.carryoverCount, 1, 99, 1);
      return `${title} [${status}, carry:${carryoverCount}]`;
    })
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeRecentHistory(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(-5)
    .map((entry) => {
      const date = compactText(entry?.date);
      if (!date) {
        return "";
      }

      const summary = entry?.summary || {};
      const tasks = Array.isArray(entry?.tasks)
        ? entry.tasks
          .filter((task) => task?.status === "failed" || task?.status === "missed")
          .slice(0, 3)
          .map((task) => `${compactText(task.title)}:${task.status}`)
          .filter(Boolean)
        : [];

      const head = `${date} [d:${clampInteger(summary.done, 0, 99, 0)},f:${clampInteger(summary.failed, 0, 99, 0)},m:${clampInteger(summary.missed, 0, 99, 0)}]`;
      return tasks.length ? `${head} ${tasks.join(", ")}` : head;
    })
    .filter(Boolean);
}

function normalizeHolidayYear(value) {
  const year = Number.parseInt(String(value || new Date().getFullYear()), 10);
  if (!Number.isFinite(year) || year < 1970 || year > 2100) {
    return null;
  }

  return year;
}

function normalizeHolidayCountry(value) {
  const countryCode = compactText(value || DEFAULT_HOLIDAY_COUNTRY).toUpperCase();
  return /^[A-Z]{2}$/u.test(countryCode) ? countryCode : DEFAULT_HOLIDAY_COUNTRY;
}

function sanitizeHolidayResponse(payload, countryCode) {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      const date = compactText(item?.date);
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
        return null;
      }

      return {
        date,
        localName: compactText(item?.localName || item?.name),
        name: compactText(item?.name || item?.localName),
        countryCode: compactText(item?.countryCode || countryCode).toUpperCase(),
        global: item?.global !== false,
        types: Array.isArray(item?.types) ? item.types.map(compactText).filter(Boolean) : [],
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.date.localeCompare(right.date));
}

async function extractGeminiError(response) {
  try {
    const payload = await response.json();
    return compactText(payload?.error?.message)
      || `Gemini 요청이 실패했습니다. (${response.status})`;
  } catch {
    return `Gemini 요청이 실패했습니다. (${response.status})`;
  }
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((part) => compactText(part?.text)).filter(Boolean).join("")
    : "";

  if (!text) {
    throw new Error("Gemini 응답이 비어 있습니다.");
  }

  return text;
}

function normalizeUsage(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    promptTokenCount: clampInteger(value.promptTokenCount, 0, 1_000_000, 0),
    candidatesTokenCount: clampInteger(value.candidatesTokenCount, 0, 1_000_000, 0),
    totalTokenCount: clampInteger(value.totalTokenCount, 0, 1_000_000, 0),
  };
}

function mapGeminiStatus(statusCode) {
  if ([400, 401, 403, 404, 429].includes(statusCode)) {
    return statusCode;
  }

  return 502;
}

function formatPlanError(error) {
  if (error instanceof GeminiRequestError && error.statusCode === 429) {
    return "오늘 사용할 수 있는 AI 추천 한도에 도달했거나 잠시 요청이 몰렸습니다. 나중에 다시 시도해 주세요.";
  }

  return error instanceof Error ? error.message : "Gemini 응답을 처리하지 못했습니다.";
}

function sanitizePlan(plan, payload) {
  if (!plan || typeof plan !== "object") {
    throw new Error("Gemini가 JSON 계획을 반환하지 않았습니다.");
  }

  const blocked = new Set([
    ...toTitleList(payload.manualTasks),
    ...toTitleList(payload.completedTodayTasks),
  ].map((title) => normalizeKey(title)));
  const targetCount = clampInteger(payload.taskTarget, 2, 6, 4);
  const tasks = [];

  for (const item of Array.isArray(plan.tasks) ? plan.tasks : []) {
    const title = compactText(item?.title);
    const key = normalizeKey(title);
    if (!title || blocked.has(key)) {
      continue;
    }

    blocked.add(key);
    tasks.push({
      title,
      category: ["focus", "support", "review"].includes(item?.category) ? item.category : "focus",
      reason: compactText(item?.reason) || "오늘 목표 달성에 중요한 작업입니다.",
    });

    if (tasks.length >= targetCount) {
      break;
    }
  }

  if (tasks.length === 0) {
    throw new Error("Gemini 응답에서 사용할 수 있는 할 일을 만들지 못했습니다.");
  }

  return {
    insight: compactText(plan.insight) || "오늘 목표 달성을 위해 우선순위를 다시 정리했습니다.",
    tasks,
  };
}

function parseJsonFromContent(content) {
  const text = String(content || "").trim();
  if (!text) {
    throw new Error("Gemini 응답이 비어 있습니다.");
  }

  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const jsonText = firstBrace >= 0 && lastBrace > firstBrace
    ? cleaned.slice(firstBrace, lastBrace + 1)
    : cleaned;

  return JSON.parse(jsonText);
}

function validatePlanningPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "요청 본문이 비어 있습니다.";
  }

  if (normalizeGoals(payload.goals, payload.goal).length === 0) {
    return "goal 값이 필요합니다.";
  }

  if (!["easy", "balanced", "hard"].includes(payload.difficulty)) {
    return "difficulty 값이 올바르지 않습니다.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(payload.currentDate || ""))) {
    return "currentDate 값이 올바르지 않습니다.";
  }

  return "";
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/u);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separator = trimmed.indexOf("=");
    if (separator < 0) {
      return;
    }

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.startsWith("\"") && rawValue.endsWith("\"")
      ? rawValue.slice(1, -1)
      : rawValue.startsWith("'") && rawValue.endsWith("'")
        ? rawValue.slice(1, -1)
        : rawValue;

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function clampInteger(value, min, max, fallback) {
  const number = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(Math.max(number, min), max);
}

function toPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.round(Math.min(Math.max(number, 0), 1) * 100);
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return compactText(value).toLowerCase();
}

function toTitleList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item : item?.title))
    .map((item) => compactText(item))
    .filter(Boolean);
}
