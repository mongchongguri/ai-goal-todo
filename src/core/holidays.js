const BASE_YUME_API_URL = "https://yume-network.vercel.app";
const HOLIDAYS_URL = "/api/open/holidays";
const NAGER_HOLIDAYS_API_URL = "https://date.nager.at/api/v3/PublicHolidays";

export async function fetchHolidayYear(year) {
  try {
    return await fetchYumeHolidayYear(year);
  } catch {
    return fetchNagerHolidayYear(year);
  }
}

async function fetchYumeHolidayYear(year) {
  const response = await fetch(`${BASE_YUME_API_URL}${HOLIDAYS_URL}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ year: Number(year) }),
  });
  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(payload?.message || "공휴일 데이터를 가져오지 못했습니다.");
  }

  const holidaySource = resolveHolidayPayload(payload);
  if (!holidaySource) {
    throw new Error(payload?.message || "공휴일 데이터 조회에 실패했습니다.");
  }

  return normalizeHolidayMap(holidaySource);
}

async function fetchNagerHolidayYear(year) {
  const response = await fetch(`${NAGER_HOLIDAYS_API_URL}/${year}/KR`);
  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error("공휴일 데이터를 가져오지 못했습니다.");
  }

  if (!Array.isArray(payload)) {
    throw new Error("공휴일 데이터 형식이 올바르지 않습니다.");
  }

  return normalizeHolidayArray(payload);
}

export async function fetchPublicHolidays(year) {
  const holidays = await fetchHolidayYear(year);
  return {
    holidays,
    source: "yume-network",
    year,
  };
}

function normalizeHolidayMap(data) {
  return Object.entries(data || {})
    .map(([rawDate, name]) => ({
      date: formatDateKey(rawDate),
      localName: String(name || "공휴일"),
      name: String(name || "Holiday"),
      types: ["Public"],
    }))
    .filter((holiday) => /^\d{4}-\d{2}-\d{2}$/u.test(holiday.date));
}

function normalizeHolidayArray(data) {
  return data
    .map((holiday) => ({
      date: String(holiday?.date || ""),
      localName: String(holiday?.localName || holiday?.name || "공휴일"),
      name: String(holiday?.name || holiday?.localName || "Holiday"),
      types: Array.isArray(holiday?.types) ? holiday.types : ["Public"],
    }))
    .filter((holiday) => /^\d{4}-\d{2}-\d{2}$/u.test(holiday.date));
}

function resolveHolidayPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (payload.status === 200 && payload.data && typeof payload.data === "object") {
    return payload.data;
  }

  if (hasHolidayDateKeys(payload)) {
    return payload;
  }

  return null;
}

function hasHolidayDateKeys(payload) {
  return Object.keys(payload).some((key) => /^\d{8}$/u.test(key));
}

function formatDateKey(rawDate) {
  const digits = String(rawDate).replace(/\D/g, "");
  if (digits.length !== 8) {
    return "";
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
