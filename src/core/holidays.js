import { apiUrl } from "./api.js";

export async function fetchPublicHolidays(year, countryCode = "KR") {
  const params = new URLSearchParams({
    year: String(year),
    country: countryCode,
  });
  const response = await fetch(apiUrl(`/api/holidays?${params.toString()}`));
  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(payload?.error || "공휴일 데이터를 가져오지 못했습니다.");
  }

  return payload;
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
