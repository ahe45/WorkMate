# WorkMate

`AdmitCard` 프로젝트의 운영 방식과 폴더 구조를 참고해 시작한 WorkSync 기반 근무관리 시스템 초기 구현입니다.

## 현재 포함 범위

- Node.js + vanilla admin web 기반 초기 부트스트랩
- MariaDB 스키마 적용 스크립트
- JWT access/refresh 인증
- 조직 / 유닛 / 사업장 / 사용자 / 스케줄 템플릿 기본 조회/생성
- 근태 사전 검증(`/v1/clock/validate`) 및 이벤트 생성(`/v1/clock/events`)
- 근태 세션 조회와 라이브 대시보드 요약
- 파일 업로드 presign/complete 골격
- 감사 로그 기록
- 기본 관리자 웹 화면
- API 스모크 테스트

## 프로젝트 구조

```text
client/           관리자 웹 스크립트
db/               원본 WorkSync 스키마
docs/specs/       첨부 명세 원본
scripts/          DB 초기화, 스모크 테스트
server/http/      AdmitCard에서 가져온 경량 HTTP 유틸
server/modules/   도메인 서비스
```

## 실행

1. `.env.example`을 `.env`로 복사해 DB/JWT 값을 설정합니다.
2. 의존성을 설치합니다.
3. DB를 초기화합니다.
4. 서버를 실행합니다.

```bash
npm install
npm run db:setup
npm start
```

기본 URL은 `http://localhost:3001`입니다.

기본 개발 DB 이름은 `WorkMate`입니다.

## 기본 계정

- 관리자: `admin@workmate.local`
- 비밀번호: `Passw0rd!`

- 직원: `employee@workmate.local`
- 비밀번호: `Passw0rd!`

## 참고

- 원본 스키마: [db/schema.sql](./db/schema.sql)
- 원본 API 계약: [docs/specs/WorkSync_openapi_v1.yaml](./docs/specs/WorkSync_openapi_v1.yaml)
- 원본 개발 명세: [docs/specs/WorkSync_개발명세서_v1.md](./docs/specs/WorkSync_%EA%B0%9C%EB%B0%9C%EB%AA%85%EC%84%B8%EC%84%9C_v1.md)
