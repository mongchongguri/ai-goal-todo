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

## 데이터 저장 방식

- 목표, 할 일, 기록, 설정은 사용자 기기 로컬 저장소에만 보관합니다.
- 서버는 AI 요청과 공휴일 조회를 중계하며, 사용자 계획 결과를 파일로 캐시하지 않습니다.
- 프론트는 이미 생성된 오늘 계획을 기기 로컬에 보관해서 불필요한 재요청을 줄입니다.

## 빌드

1. `npm run build`
2. `npm run preview`
