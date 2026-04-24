# AI Goal Todo Planner

연간 목표를 입력하면 Gemini 기반 AI가 오늘 해야 할 일을 추천해주는 React + Node 웹앱입니다.

## 실행

1. `npm install`
2. `.env`에 `GEMINI_API_KEY`를 넣습니다.
3. `npm run dev`
4. 브라우저에서 `http://localhost:3000`을 엽니다.

`npm run dev`는 먼저 프론트를 빌드한 뒤 Node 서버를 띄웁니다. 현재 환경에서는 Vite 개발 서버보다 이 방식이 더 안정적입니다.

## 환경 변수

- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-2.5-flash-lite`
- `PORT=3000`

## 토큰 절감 방식

- 같은 입력 조건으로 다시 생성하면 서버가 `.cache/gemini-plan-cache.json`의 결과를 재사용합니다.
- 프론트는 이미 생성된 오늘 계획을 `localStorage`에 보관해서 불필요한 재요청을 막습니다.
- Gemini로 보내는 컨텍스트는 최근 기록과 이월 정보만 압축해서 전달합니다.

## 빌드

1. `npm run build`
2. `npm run preview`
