
# WorkSync 개발 백로그 v1.0

본 문서는 `WorkSync 차세대 통합 근무관리 시스템 개발 명세서 v1.0`을 구현 작업 단위로 분해한 백로그이다.  
권장 방식은 **모듈별 수직 슬라이스 개발**이며, 각 Epic은 API, DB, 도메인 로직, 화면, QA 항목을 함께 닫는 방식으로 진행한다.

---

## Epic 0. 프로젝트 부트스트랩

### 목표
- 공통 개발환경, 모노레포, CI/CD, 로깅/모니터링 기반 마련

### 작업
- [ ] monorepo 초기화 (`apps/api`, `apps/worker`, `apps/admin-web`, `apps/mobile`)
- [ ] TypeScript/NestJS/ESLint/Prettier 설정
- [ ] env schema validation 구성
- [ ] Docker Compose (api, worker, mariadb, redis, minio) 구성
- [ ] OpenTelemetry / request_id middleware 추가
- [ ] 공통 예외 필터, 공통 응답 포맷 정의
- [ ] migration 실행 파이프라인 구성
- [ ] Github Actions 또는 CI 파이프라인 구성
- [ ] staging/prod 환경 변수 전략 수립

### 완료 기준
- [ ] 로컬 1-command 부팅 가능
- [ ] health check API 동작
- [ ] migration 적용 가능
- [ ] logger / trace id 출력 확인

---

## Epic 1. 인증 / 권한 / 테넌시

### 목표
- JWT 인증과 scope 기반 권한 제어 구현

### 작업
- [ ] users, roles, user_roles 스키마/엔티티 구현
- [ ] password hash / refresh token rotation 구현
- [ ] login / refresh / logout API 구현
- [ ] role + scope guard 구현
- [ ] organization scope / unit scope / site scope filter 유틸 구현
- [ ] current user decorator / auth principal 구현
- [ ] 관리자 권한 테스트 케이스 작성
- [ ] 감사 로그 연결

### API
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/me`

### 완료 기준
- [ ] 타 조직 데이터 조회 불가
- [ ] self scope로 타인 데이터 수정 불가
- [ ] refresh token 회전 정상 동작

---

## Epic 2. 조직 / 유닛 / 사업장 / 사용자 마스터

### 목표
- 기본 운영 마스터 데이터 관리

### 작업
- [ ] 접근 가능한 워크스페이스 목록 / 생성 / 수정 API 구현
- [ ] organizations CRUD
- [ ] units 트리 구조 CRUD
- [ ] sites CRUD
- [ ] site_auth_policies CRUD
- [ ] users CRUD
- [ ] user_unit_assignments / user_site_assignments 구현
- [ ] user_devices 등록/신뢰 관리
- [ ] 목록 검색/필터/페이지네이션 구현

### 화면
- [ ] 관리자 > 조직 설정
- [ ] 관리자 > 유닛 트리 관리
- [ ] 관리자 > 사업장 설정
- [ ] 관리자 > 사용자 목록/상세

### API
- `GET /v1/account/organizations`
- `POST /v1/account/organizations`
- `PATCH /v1/account/organizations/{organizationId}`
- `GET /v1/orgs/{orgId}/units`
- `POST /v1/orgs/{orgId}/units`
- `GET /v1/orgs/{orgId}/sites`
- `POST /v1/orgs/{orgId}/sites`
- `PUT /v1/orgs/{orgId}/sites/{siteId}/auth-policy`
- `GET /v1/orgs/{orgId}/users`
- `POST /v1/orgs/{orgId}/users`
- `PATCH /v1/orgs/{orgId}/users/{userId}`

### 완료 기준
- [ ] 유닛 트리 탐색 가능
- [ ] 사업장별 인증 정책 저장 가능
- [ ] 사용자별 기본 site/work_policy 지정 가능

---

## Epic 3. 정책 엔진 (Work Policy / Site Auth Policy)

### 목표
- 근무/인증 정책을 하드코딩 없이 설정값 기반으로 처리

### 작업
- [ ] work_policies CRUD
- [ ] auto break rules JSON schema 정의
- [ ] overtime / lock / grace / cutoff 정책 파서 구현
- [ ] site auth mode (ANY_OF / ALL_OF / PRIMARY_PLUS_SECONDARY) 구현
- [ ] 정책 캐시 로딩 전략 구현
- [ ] 정책 변경 시 영향 범위 식별 기능 구현

### 완료 기준
- [ ] 정책 변경 후 신규 이벤트에 반영
- [ ] 정책 미존재 시 default fallback 동작
- [ ] unit test 20개 이상 확보

---

## Epic 4. 스케줄 템플릿 / 배포 / Shift Materializer

### 목표
- 일정의 원천 데이터와 실제 근무일 인스턴스 생성

### 작업
- [ ] schedule_templates CRUD
- [ ] schedule_template_days CRUD
- [ ] schedule_assignments 생성/수정/비활성
- [ ] assignment 우선순위 규칙 구현
- [ ] shift_instances materializer worker 구현
- [ ] holiday calendar 연동
- [ ] cross-midnight shift 지원
- [ ] shift 조회 API 구현

### API
- `GET /v1/orgs/{orgId}/schedule-templates`
- `POST /v1/orgs/{orgId}/schedule-templates`
- `POST /v1/orgs/{orgId}/schedule-assignments`
- `GET /v1/users/{userId}/shift-instances`

### 완료 기준
- [ ] template 배포 후 shift instance 생성
- [ ] 휴일/예외 반영
- [ ] 동일 사용자/동일 일자 shift 충돌 방지

---

## Epic 5. Clock Validation / Clock Event Ingestion

### 목표
- WorkSync 핵심 기능인 출퇴근 이벤트 흐름 구현

### 작업
- [ ] attendance_sessions / attendance_events / evidence / anomalies 스키마 구현
- [ ] 상태 전이 state machine 구현
- [ ] GPS geofence 검증 구현
- [ ] Wi-Fi BSSID 검증 구현
- [ ] Beacon 검증 구현
- [ ] trusted device 검증 구현
- [ ] duplicate/idempotency 처리 구현
- [ ] `POST /clock/validate` 구현
- [ ] `POST /clock/events` 구현
- [ ] source_type (MOBILE/WEB/ADMIN/OFFLINE_SYNC) 처리
- [ ] evidence file 연결
- [ ] audit log 기록

### 예외 케이스
- [ ] shift 미존재 출근
- [ ] cutoff 전 자정 넘김
- [ ] OFFSITE 상태에서 CLOCK_OUT
- [ ] WFH_START 조건 미충족
- [ ] offline delayed sync

### 완료 기준
- [ ] 정상 출근/퇴근/외근/복귀 흐름 성공
- [ ] 정책 위반 시 차단/증빙 요구 정확히 분기
- [ ] 중복 clientEventId 재전송 시 동일 결과 반환

---

## Epic 6. Session Recalculation Engine

### 목표
- 이벤트 원본을 기반으로 인정 근무시간과 anomaly를 계산

### 작업
- [ ] intervals builder 구현
- [ ] break calculator 구현 (자동/수동)
- [ ] late / early leave calculator 구현
- [ ] overtime calculator 구현
- [ ] weekly threshold calculator 구현
- [ ] session summary JSON 저장
- [ ] 정책 변경/승인 반영 후 재계산 job 구현
- [ ] recalculation idempotency 구현
- [ ] anomaly count/snapshot 갱신

### 완료 기준
- [ ] 자정 넘김 교대근무 계산 정확
- [ ] 승인 전후 초과근무 수치 변경 반영
- [ ] 정정 반영 후 summary 갱신

---

## Epic 7. 요청 / 승인 워크플로우 엔진

### 목표
- 연장근로/휴가/정정/스케줄변경 공통 승인 엔진 구현

### 작업
- [ ] approval_requests / approval_steps 구현
- [ ] single-step / multi-step / parallel 승인 모델 구현
- [ ] approver inbox 조회 구현
- [ ] approve / reject API 구현
- [ ] approval side-effect processor 구현
- [ ] 대결재(delegate) 필드 처리
- [ ] SLA due / escalation hook 설계
- [ ] 요청 유형별 상세 테이블 구현
  - [ ] overtime_requests
  - [ ] schedule_change_requests
  - [ ] leave_requests
- [ ] 근태 정정 요청 API 구현

### API
- `GET /v1/approvals/inbox`
- `POST /v1/approvals/{id}/approve`
- `POST /v1/approvals/{id}/reject`
- `POST /v1/overtime-requests`
- `POST /v1/schedule-change-requests`
- `POST /v1/leave-requests`
- `POST /v1/attendance-corrections`

### 완료 기준
- [ ] 승인 완료 시 원본 도메인 반영
- [ ] 반려 시 사유 저장
- [ ] 세션/shift 재계산 트리거 정상 동작

---

## Epic 8. 휴가 / 결근 / 정정 처리

### 목표
- 휴가와 결근 마감 처리로 근태 데이터의 업무적 완결성 확보

### 작업
- [ ] leave_types / leave_balances CRUD
- [ ] leave approval 후 balance 차감 처리
- [ ] absence finalizer 배치 구현
- [ ] 휴가 승인 시 결근 anomaly 제거
- [ ] 관리자 수동 정정 API 구현
- [ ] 원본 이벤트 보존 + adjustment overlay 방식 구현

### 완료 기준
- [ ] 승인 휴가가 있는 날은 결근 처리되지 않음
- [ ] 누락 출근/퇴근 정정 가능
- [ ] 이력 추적 가능

---

## Epic 9. 관리자 대시보드 / 관제

### 목표
- 실시간 운영 화면 제공

### 작업
- [ ] dashboard summary read model 설계
- [ ] site별 present/late/offsite/wfh/absentEstimated 집계 쿼리 구현
- [ ] anomaly feed API 구현
- [ ] approval inbox summary API 구현
- [ ] SSE 또는 polling API 구현
- [ ] 지도 표시용 site marker payload 구성
- [ ] 관리자 웹 대시보드 페이지 구현

### 완료 기준
- [ ] 이벤트 발생 후 10초 내 지표 반영
- [ ] scope별 필터 동작
- [ ] 피크 시간에도 1.5초 이하 응답

---

## Epic 10. 파일 업로드 / 증빙 미디어

### 목표
- 사진/첨부 증빙 안정적으로 저장

### 작업
- [ ] presigned upload 발급 API 구현
- [ ] upload complete API 구현
- [ ] file metadata 저장
- [ ] 썸네일 worker 구현
- [ ] EXIF strip 처리
- [ ] 보존기간/삭제 예약 필드 설계
- [ ] evidence와 file 연결

### 완료 기준
- [ ] 모바일 직접 업로드 가능
- [ ] 업로드 실패 시 재시도 가능
- [ ] 민감 bucket private 유지

---

## Epic 11. 리포트 / Export Job

### 목표
- 운영/정산/감사에 사용할 다운로드 리포트 제공

### 작업
- [ ] export_jobs 구현
- [ ] request hash 기반 dedupe 처리
- [ ] CSV/XLSX/PDF 생성 worker 구현
- [ ] 다운로드 URL 만료 처리
- [ ] export 감사 로그 기록
- [ ] 기본 리포트 4종 구현
  - [ ] Attendance Summary
  - [ ] Late Report
  - [ ] Overtime Report
  - [ ] Site Presence Report

### 완료 기준
- [ ] 대량 export 비동기 생성
- [ ] 완료 후 다운로드 가능
- [ ] 실패 사유 확인 가능

---

## Epic 12. 알림 시스템

### 목표
- 운영 이슈를 사용자/관리자에게 적시에 전달

### 작업
- [ ] notifications 테이블 구현
- [ ] in-app notification API 구현
- [ ] push dispatch worker 구현
- [ ] 템플릿 시스템 구현
- [ ] dedupe / rate limit 구현
- [ ] 주요 이벤트 연동
  - [ ] 승인 요청 도착
  - [ ] 승인 결과
  - [ ] 지각 / anomaly
  - [ ] 주간 시간 임계치
  - [ ] export 완료

### 완료 기준
- [ ] 채널별 재시도 가능
- [ ] 중복 알림 방지
- [ ] 읽음 처리 가능

---

## Epic 13. 감사 로그 / 보안 / 운영성

### 목표
- 운영과 보안 관점에서 시스템 완결성 확보

### 작업
- [ ] audit_logs 구현
- [ ] 주요 액션 AOP/interceptor 방식 기록
- [ ] 민감 필드 masking 전략 구현
- [ ] IP / user-agent / request_id 저장
- [ ] admin critical action 재인증 전략 설계
- [ ] rate limit / brute-force protection 구현
- [ ] presigned URL 만료 관리
- [ ] 보존기간 아카이빙 정책 수립

### 완료 기준
- [ ] 정책 변경, 승인, 다운로드 로그 누락 없음
- [ ] 보안 이벤트 추적 가능
- [ ] PII 접근 통제 정책 문서화

---

## Epic 14. 외부 연동 / API First

### 목표
- ERP 및 외부 시스템 연동 가능 구조 확보

### 작업
- [ ] API key 또는 service account 설계
- [ ] org별 integration setting 저장
- [ ] outbound webhook 이벤트 정의
- [ ] inbound sync batch endpoint 설계
- [ ] user / unit / leave balance import 인터페이스 정의
- [ ] export 기반 정산용 raw dataset API 설계

### 완료 기준
- [ ] 외부 마스터 동기화 가능한 수준의 contract 확보
- [ ] webhook retry / dead-letter 기본 구조 확보

---

## Epic 15. 테스트 / 품질 / 성능

### 목표
- 프로덕션 투입 가능한 신뢰성 확보

### 작업
- [ ] module unit test
- [ ] clock event E2E test
- [ ] approval side-effect test
- [ ] cross-midnight calculation test
- [ ] RBAC/scope security test
- [ ] load test script 작성
- [ ] chaos/failure scenario 점검
- [ ] migration rollback 시나리오 점검

### 필수 테스트 시나리오
- [ ] 정상 출근
- [ ] 중복 출근 요청
- [ ] 지각
- [ ] 사업장 밖 출근
- [ ] 외근 후 퇴근
- [ ] 재택 시작
- [ ] 휴가 승인 후 결근 해제
- [ ] 사후 연장 승인
- [ ] 오프라인 동기화
- [ ] export 대량 생성
- [ ] scope 위반 접근 차단

### 완료 기준
- [ ] 주요 핵심 흐름 자동화 테스트 커버
- [ ] p95 성능 기준 충족
- [ ] 심각도 높은 보안 취약점 0건

---

## 추천 개발 순서

1. Epic 0 ~ 2
2. Epic 3 ~ 6
3. Epic 7 ~ 8
4. Epic 9 ~ 12
5. Epic 13 ~ 15

---

## MVP 종료 조건

아래를 모두 만족하면 MVP 종료로 본다.

- [ ] 조직/사업장/사용자 운영 가능
- [ ] GPS/Wi-Fi 기반 출근/퇴근/외근/복귀 가능
- [ ] 기본 스케줄 배포 가능
- [ ] 근태 세션 계산 가능
- [ ] 관리자 대시보드 운영 가능
- [ ] 연장/휴가/정정 승인 가능
- [ ] CSV/XLSX export 가능
- [ ] 감사 로그/권한 통제 확보
