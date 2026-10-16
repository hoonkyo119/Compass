# Compass v0.1

오늘의 기록, 내일의 방향. 개인 수입·지출과 자산을 관리하는 한국어 재무 대시보드입니다.

## 프로젝트 구조

앱은 `compass/`에 있는 Next.js 16 App Router + React 19 + TypeScript 프로젝트입니다. 기존 `/news`, `/api/news` 경로는 유지했습니다.

- `compass/app/page.tsx`: 대시보드 진입점
- `compass/components/dashboard.tsx`: 현재·미래 화면, 입력 및 백업 UI
- `compass/lib/finance.ts`: 데이터 모델, 월별 집계, 순자산 계산, 백업 검증
- `compass/app/globals.css`: 데스크톱·태블릿·모바일 스타일
- `compass/tests/finance.test.mjs`: 계산 및 백업 검증 테스트

## 시작

검증 환경: Node.js 24.19.0, npm 11.9.0.

```sh
cd compass
npm ci
npm run dev
```

## 기능

- **현재**: 월별 가계부, 수입·지출 추가/수정/삭제, 유형 필터, 수입·지출·잔액 집계, 분류별 지출 비중
- **미래**: 부동산·주식·저축·대출 추가/수정/삭제, 총 자산·남은 대출·순자산 집계
- 금액은 원 단위 정수로 입력합니다. 주식은 총 평가액, 대출은 남은 원금을 기록합니다.
- JSON 백업 내보내기/가져오기. 가져오기는 기존 데이터를 교체하며 확인이 필요합니다. 잘못된 파일은 적용하지 않습니다.
- 데이터가 없으면 빈 화면부터 시작하며 샘플 금융 내역을 생성하지 않습니다.

## 저장과 한계

데이터는 현재 사이트의 브라우저 `localStorage` (`compass-v0.1`)에만 저장됩니다. 서버 DB·로그인·기기 간 동기화는 없습니다. 브라우저 데이터 삭제, 다른 브라우저·기기·도메인으로의 이동 시 내역이 이어지지 않습니다. 중요한 기록은 JSON 백업을 내려받아 보관하세요. 백업 파일은 암호화되지 않으므로 개인정보처럼 관리하세요.

실시간 시세, 이자 계산, 은행 연동, 자동 거래 반영은 없습니다. 자산 평가액과 대출 잔액은 직접 갱신합니다. 자산 수정은 가계부에 거래를 자동 생성하지 않습니다. 잔액은 선택 월의 수입에서 지출을 뺀 금액이며 전월 이월금은 포함하지 않습니다.

## 검증

```sh
cd compass
npm run lint
node --experimental-strip-types --test tests/finance.test.mjs
npm run build
npx --no-install tsc --noEmit
npm run start
```

테스트 명령은 Node.js 22.18 이상을 사용하세요. 프로덕션 서버에서 `/`의 대시보드와 기존 `/news`, `/api/news`를 확인할 수 있습니다.

## Vercel

기존 `compass/next.config.ts`, 의존성·잠금 파일, npm 빌드/시작 스크립트를 유지합니다. Vercel의 기존 프로젝트 연결 및 Root Directory 설정(`compass`)을 그대로 사용하세요. 환경 변수나 별도 서버가 필요하지 않습니다. 폰트는 시스템 글꼴을 사용해 빌드 중 Google Fonts 다운로드가 필요하지 않습니다.

GitHub에 반영하면 연결된 Vercel 프로젝트의 기존 자동 배포 정책이 적용됩니다. 이 변경 자체는 GitHub push 또는 Vercel 배포를 수행하지 않습니다.

### 브라우저 회귀 검사 (선택 개발 도구)

Playwright가 설치된 환경에서 프로덕션 서버를 실행한 뒤 검사합니다. 테스트는 격리된 브라우저 컨텍스트만 사용하며 실제 사용자 데이터는 수정하지 않습니다.

```sh
cd compass
# Playwright가 없는 개발 환경에서만 설치 (manifest/lockfile 변경 없음)
npm install --no-save --package-lock=false playwright
npx playwright install chromium
# 별도 터미널: npm run start -- --port 3101
COMPASS_BASE_URL=http://127.0.0.1:3101 node tests/browser.mjs
```

이미 설치된 Chromium을 사용할 때는 `CHROMIUM_PATH=/usr/bin/chromium`을 지정합니다. 검사는 거래 추가/수정, 월 필터, 자산 4종, 저장 복원, 삭제와 백업 복원, 잘못된 백업·저장소 보호, 모바일·태블릿 가로 넘침과 브라우저 오류를 확인합니다. 스크린샷과 임시 백업은 `/tmp/compass-*`에 저장합니다.
