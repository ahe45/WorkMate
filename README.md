# WorkMate

`AdmitCard` 프로젝트의 운영 방식과 폴더 구조를 참고해 시작한 WorkSync 기반 근무관리 시스템입니다.

## 현재 포함 범위

- Node.js + vanilla admin web 기반 워크스페이스 UI
- MariaDB 스키마 적용 및 보정 스크립트
- JWT access/refresh 인증
- 조직 / 유닛 / 직급 / 사업장 / 사용자 관리
- 근로정책, 근무일정, 출퇴근기록, 휴가현황, 리포트 화면
- 근태 사전 검증(`/v1/clock/validate`) 및 이벤트 생성(`/v1/clock/events`)
- 근태 세션 조회와 라이브 대시보드 요약
- 직원 인사카드 파일 업로드 골격
- 감사 로그 기록
- API 스모크 테스트와 Playwright 기반 UI 검증

## 프로젝트 구조

```text
client/           브라우저 앱, 컨트롤러, 렌더러
db/               스키마와 테이블/컬럼 설명
docs/specs/       원본 명세와 백로그
scripts/          DB 초기화, seed, smoke/UI 검증
server/http/      경량 HTTP 라우팅
server/modules/   도메인 서비스
styles/           페이지/기능별 CSS
```

## 실행

1. `.env.example`을 `.env`로 복사해 DB/JWT 값을 설정합니다.
2. 의존성을 설치합니다.
3. DB를 초기화합니다. 기본 실행은 최소 계정만 생성합니다.
4. 서버를 실행합니다.

```bash
npm install
npm run db:setup
npm start
```

기본 URL은 `http://localhost:3001`입니다.

기본 개발 DB 이름은 `WorkMate`입니다.

## 계정

기본 seed 계정:

- 마스터관리자: `admin@uplusys.com` / `control1@`
- 직원: `user@uplusys.com` / `control1@`

데모 조직과 검증용 데이터를 함께 만들려면 `SEED_DEMO_DATA=true npm run db:setup`을 사용합니다. 이때 검증 스크립트 기본 로그인 계정은 다음과 같습니다.

- 조직 관리자: `admin@workmate.local` / `Passw0rd!`
- 직원: `employee@workmate.local` / `Passw0rd!`

## 검증

```bash
npm run check
npm test
npm run verify:ui
```

`npm run verify:ui`는 격리된 `WorkMate_ui` DB를 만들고 데모 인력 데이터를 seed한 뒤 주요 화면을 Playwright로 검증합니다.

## 참고

- 원본 스키마: [db/schema.sql](./db/schema.sql)
- 원본 API 계약: [docs/specs/WorkSync_openapi_v1.yaml](./docs/specs/WorkSync_openapi_v1.yaml)
- 원본 개발 명세: [docs/specs/WorkSync_개발명세서_v1.md](./docs/specs/WorkSync_%EA%B0%9C%EB%B0%9C%EB%AA%85%EC%84%B8%EC%84%9C_v1.md)
