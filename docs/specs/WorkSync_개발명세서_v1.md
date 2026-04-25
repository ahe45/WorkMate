
# WorkSync 차세대 통합 근무관리 시스템 개발 명세서 v1.0

문서 상태: Draft for Implementation  
작성 목적: 본 문서는 WorkSync의 제품 요구사항, 도메인 모델, API 방향, 데이터 스키마, UI/UX 동작, 비기능 요구사항까지 포함한 **실개발 기준 문서**이다.  
활용 대상: PO, PM, 백엔드/프론트엔드/모바일 개발자, QA, DevOps, UX, 데이터팀, ERP 연동 담당자, Codex 기반 구현 에이전트

---

## 1. 문서 목적

본 문서는 다음 3가지를 동시에 만족하도록 작성한다.

1. 기획서 수준의 추상 요구사항을 실제 구현 가능한 수준의 기능 명세로 변환한다.
2. Codex 또는 개발자가 바로 코드 구조를 잡을 수 있도록 API, DB, 상태 전이, 예외 처리 규칙을 구체화한다.
3. 추후 ERP/급여/회계 연동이 가능한 API-First 구조를 기준 아키텍처로 확정한다.

---

## 2. 제품 비전

WorkSync는 재택근무, 현장근무, 외근, 교대근무, 탄력근무, 시차출퇴근 등 복합적인 근무 형태를 하나의 플랫폼에서 관리하는 통합 근무관리 시스템이다.

핵심 방향은 다음과 같다.

- **현장 친화적 출퇴근 UX**: 출근, 퇴근, 외근, 복귀, 재택 시작/종료를 한 번의 행동으로 처리
- **관리자 통제 가능성**: 조직, 부서, 유닛, 사업장 단위의 실시간 관제 및 승인 통제
- **정책 기반 계산 엔진**: 근로시간, 지각, 조퇴, 외근, 초과근무, 예외 증빙을 규칙 엔진으로 처리
- **대규모 운영 안정성**: 피크 시간 동시 출퇴근 이벤트를 안정적으로 처리
- **API 우선 구조**: 향후 급여, ERP, 회계, BI 도구와 쉽게 연동

---

## 3. 제품 범위

### 3.1 In Scope

1. 조직/유닛/사업장 관리
2. 사용자/권한/디바이스 관리
3. 다중 인증 기반 출퇴근 체크
4. 4단계 상태 전환 + 재택 모드
5. 근무 스케줄 템플릿/배포/개별 스케줄
6. 연장근로/스케줄 변경/휴가/근태정정 요청 및 승인
7. 실시간 다중 사업장 관제 대시보드
8. 리포트/엑셀/PDF 추출
9. 알림/이상 징후/감사 로그
10. 외부 연동용 REST API

### 3.2 Out of Scope (v1 기준)

1. 급여 계산 및 급여명세 생성
2. 4대보험/세무 신고
3. 전사 HRM 전체 기능(채용, 평가, 보상, 인사발령 전체)
4. 얼굴인식 기반 생체인증
5. 완전한 오프라인 단독 운영 모드
6. 외부 메신저/그룹웨어 전체 대체

단, v1에서도 다음은 반드시 고려한다.

- 급여 시스템이 요구하는 시간 데이터 추출 가능 구조
- ERP 마스터 데이터(사번, 부서, 직책, 휴가 잔액) 동기화 가능 구조
- 대시보드/리포트 확장을 위한 이벤트 로그 보존 구조

---

## 4. 기준 아키텍처 제안

본 문서는 구현 기준 아키텍처를 아래와 같이 권고한다.

### 4.1 권장 기술 스택

- Backend: Node.js 20 + TypeScript + NestJS
- Admin Web: Next.js + React + TypeScript
- Mobile App: React Native + TypeScript
- DB: MariaDB 11.x
- Cache / Queue: Redis + BullMQ
- Realtime: SSE 우선, 필요 시 WebSocket 보강
- Object Storage: S3 Compatible Storage (AWS S3, MinIO 등)
- Auth: JWT Access/Refresh + RBAC
- Infra: Docker + Kubernetes 또는 ECS 계열
- Monitoring: Prometheus + Grafana + Loki + OpenTelemetry

### 4.2 아키텍처 원칙

1. **모듈형 모놀리스**로 시작한다.
   - attendance
   - scheduling
   - approvals
   - dashboard
   - reporting
   - admin
   - auth
   - notification
   - integration

2. 대규모 트래픽이 확인되면 다음 순서로 분리한다.
   - Clock Event Ingestion
   - Reporting Worker
   - Notification Worker
   - Approval Workflow
   - ERP Sync Adapter

3. 동기 API와 비동기 처리를 분리한다.
   - 출퇴근 체크 요청: 동기 응답 400ms 이내
   - 리포트 생성 / 대량 재계산 / 외부 동기화: 큐 기반 비동기

4. 모든 비즈니스 이벤트는 감사/추적을 위해 이벤트 로그를 남긴다.
   - `attendance.event.created`
   - `attendance.session.recalculated`
   - `approval.request.submitted`
   - `approval.request.resolved`
   - `report.export.completed`

---

## 5. 핵심 사용자와 권한 모델

### 5.1 사용자 유형

#### A. System Admin
- SaaS 전체 또는 고객사 전체 설정 관리
- 조직 생성, 플랜/기능 토글 관리
- 법정/정책 프리셋 배포
- 보안 감사 조회

#### B. Organization Admin
- 조직 전체 사용자, 사업장, 정책, 템플릿, 승인 라인 관리
- 전체 리포트 다운로드
- ERP/API 키 발급

#### C. Unit Manager
- 특정 유닛(본부/지점/매장/팀) 소속 인원 관리
- 해당 범위 스케줄 배포, 근태 검토, 승인
- 실시간 출근 현황 관제

#### D. Site Manager
- 특정 사업장 현장 관리자
- 당일 출근/결근/외근/복귀 현황 확인
- 현장 예외 사유 검토 및 1차 승인

#### E. Employee
- 출근/퇴근/외근/복귀/재택 상태 변경
- 본인 일정 조회
- 본인 요청(휴가, 연장근로, 정정) 생성
- 본인 근태 이력 조회

#### F. Approver
- 승인 Inbox 확인
- 승인/반려/보류
- 결재 의견 기록

#### G. Auditor / Readonly
- 수정 없이 로그/리포트만 열람

### 5.2 권한 모델 원칙

- 권한은 `role + scope` 조합으로 부여한다.
- scope는 다음 중 하나를 가진다.
  - organization
  - unit
  - site
  - self
- 하나의 사용자는 여러 role/scope를 동시에 가질 수 있다.
- 모든 조회 API는 scope filter를 강제한다.
- 변경 API는 정책과 scope를 동시에 검사한다.

예시:
- `UNIT_MANAGER@unit:U100`
- `SITE_MANAGER@site:S201`
- `APPROVER@unit:U100`
- `EMPLOYEE@self`

---

## 6. 도메인 용어 정의 및 Naming Convention

### 6.1 핵심 용어

- **Organization**: 고객사 또는 법인
- **Unit**: 조직 내부의 계층형 관리 단위(본부/부서/지점/팀/매장)
- **Site**: 실제 근무 장소
- **Work Policy**: 근무시간/지각/초과근무/휴게/인증 정책 세트
- **Schedule Template**: 반복 가능한 근무 패턴
- **Schedule Assignment**: 사용자 또는 팀에 배포된 스케줄
- **Shift Instance**: 특정 날짜에 확정된 실제 근무 일정
- **Attendance Session**: 한 근무일에 대한 근태 세션
- **Attendance Event**: 출근/퇴근/외근/복귀 등 개별 이벤트
- **Approval Request**: 승인 프로세스를 타는 요청 단위
- **Anomaly**: 지각/위치 불일치/미퇴근 등 이상 징후
- **Evidence**: 사진, 위치, Wi-Fi, Beacon, 사유 텍스트 등 증빙
- **Track**: 근무제 유형 분류(고정, 시차, 탄력, 선택, 교대 등)

### 6.2 UI/DB/API 명명 규칙

#### UI 표기
- 출근: 근무 시작 (Clock-In)
- 퇴근: 근무 종료 (Clock-Out)
- 외근: 외근 시작 (Go Out / Field Work Start)
- 복귀: 외근 복귀 (Return)
- 재택근무 시작: Work From Home Start
- 재택근무 종료: Work From Home End
- 승인 대기: Pending
- 승인 완료: Approved
- 반려: Rejected
- 취소: Cancelled

#### API / DB 권장 표기
- snake_case for DB
- kebab-case for REST path
- camelCase for JSON field
- enum 문자열은 UPPER_SNAKE_CASE

예시:
- `attendance_sessions`
- `/v1/attendance/sessions`
- `clockEventType`
- `OUTSIDE_GEOFENCE`

---

## 7. 주요 사용자 시나리오

### 7.1 현장 직원 출근

1. 직원이 앱 실행
2. 오늘의 예정 근무와 허용된 인증 수단 확인
3. 출근 버튼 터치
4. 앱이 GPS / Wi-Fi / Beacon / 디바이스 정보를 수집
5. 서버가 인증 정책 검증
6. 정상 시 `CLOCK_IN` 이벤트 생성
7. 세션이 `OPEN` 상태로 시작
8. 관리자 대시보드에 실시간 반영

### 7.2 외근 처리

1. 사용자가 업무 중 외근 버튼 클릭
2. 현재 세션이 `WORKING` 상태인지 확인
3. `GO_OUT` 이벤트 생성
4. 세션 상태가 `OFFSITE`로 전환
5. 복귀 시 `RETURN` 이벤트 생성 후 `WORKING` 복귀
6. 외근 중 바로 퇴근하는 경우 `CLOCK_OUT` 허용 여부는 정책으로 제어

### 7.3 재택근무 처리

1. 사용자가 당일 재택 스케줄 또는 승인된 재택 상태인지 확인
2. `WFH_START` 이벤트 생성
3. 세션 상태 `WFH_WORKING`
4. 종료 시 `WFH_END` 또는 `CLOCK_OUT`
5. 위치 인증은 완화 가능하나 디바이스 신뢰도, VPN/SSO, 사유 첨부 정책 사용 가능

### 7.4 연장근로 승인

1. 직원이 예정 종료시간 이후 근무가 필요하다고 판단
2. 앱/웹에서 연장근로 요청 생성
3. 승인 라인에 따라 단계별 승인
4. 승인 전에는 경고 또는 hard lock
5. 승인 완료 시 허용 범위 내 초과근무 인식
6. 세션 재계산 및 주간 누적시간 갱신

### 7.5 관리자 실시간 관제

1. 관리자 대시보드 접속
2. scope에 해당하는 유닛/사업장 요약 카드 확인
3. 지도/리스트에서 출근, 결근, 외근, 복귀, 재택, 지각 인원 확인
4. 이상 징후 클릭 시 증빙과 사유 확인
5. 필요 시 정정 요청 회신 또는 직접 조정

---

## 8. 상세 기능 명세

## 8.1 조직 / 유닛 / 사업장 관리

### 기능
- 조직 생성 및 기본 정책 초기화
- 유닛 계층 생성/수정/비활성화
- 사업장 생성 및 좌표/반경/주소 등록
- 사업장별 인증정책 연결
- 관리자 scope 부여

### 요구사항
- 유닛은 트리 구조를 지원한다.
- 사용자는 여러 유닛에 동시에 소속될 수 있다.
- 기본 조회 단위는 `primary_unit_id`이며, 추가 겸직은 assignment로 관리한다.
- 사업장은 최소 하나의 인증정책을 가진다.
- 사업장은 "운영 중/비활성/폐쇄 예정" 상태를 가진다.

### 검증 규칙
- 위도/경도 미입력 사업장은 GPS 인증 불가
- 사업장 비활성 시 신규 출근 불가, 기존 이력은 유지
- 사업장 삭제는 소프트 삭제만 허용

---

## 8.2 사용자 / 디바이스 관리

### 기능
- 사용자 등록/수정/휴면/퇴사 처리
- 사번, 이름, 연락처, 입사일, 소속, 직책 관리
- 디바이스 등록 및 신뢰 디바이스 관리
- 모바일 푸시 토큰 관리

### 요구사항
- 퇴사자는 로그인 차단하되 과거 이력은 보존
- 하나의 사용자는 여러 디바이스를 가질 수 있음
- 출퇴근 체크는 신뢰 디바이스 정책을 선택적으로 요구 가능
- 디바이스 변경 시 관리자 승인 또는 2차 인증 가능

### 필수 사용자 필드
- id
- organization_id
- employee_no
- name
- employment_status
- join_date
- timezone
- primary_unit_id
- default_site_id (nullable)
- track_type
- work_policy_id

---

## 8.3 다중 인증 기반 Smart Clock-in

### 지원 인증 수단
1. GPS Geofence
2. Wi-Fi BSSID 매칭
3. Beacon UUID/Major/Minor 매칭
4. 신뢰 디바이스 여부
5. 사진 증빙
6. 사유 텍스트
7. 재택 예외 승인 여부

### 정책 조합 방식
- `ANY_OF`: 하나만 충족해도 통과
- `ALL_OF`: 모두 충족해야 통과
- `PRIMARY_PLUS_SECONDARY`: 주 인증 1개 + 보조 인증 1개
- `SOFT_FAIL_ALLOWED`: 실패하더라도 증빙 후 통과
- `BLOCK_ON_FAIL`: 실패 시 이벤트 차단

### 필수 처리 순서
1. 사용자/조직/세션 상태 확인
2. 예정 스케줄 확인
3. 이벤트 전이 가능 여부 확인
4. 인증정책 로드
5. GPS / Wi-Fi / Beacon / Device 검증
6. 차단 여부 결정
7. 사유/사진 요구 여부 결정
8. 이벤트 생성
9. 세션 갱신
10. 이상 징후 생성
11. 관리자 알림 발송

### 이벤트 종류
- `CLOCK_IN`
- `CLOCK_OUT`
- `GO_OUT`
- `RETURN`
- `WFH_START`
- `WFH_END`
- `BREAK_START`
- `BREAK_END`
- `MANUAL_ADJUST`
- `AUTO_CLOSE`

### 상태 전이 규칙

| 현재 상태 | 허용 이벤트 | 다음 상태 |
|---|---|---|
| OFF_DUTY | CLOCK_IN, WFH_START | WORKING, WFH_WORKING |
| WORKING | GO_OUT, BREAK_START, CLOCK_OUT | OFFSITE, BREAK, OFF_DUTY |
| OFFSITE | RETURN, CLOCK_OUT | WORKING, OFF_DUTY |
| BREAK | BREAK_END, CLOCK_OUT | WORKING, OFF_DUTY |
| WFH_WORKING | BREAK_START, WFH_END, CLOCK_OUT | BREAK, OFF_DUTY, OFF_DUTY |

추가 규칙:
- `OFF_DUTY -> GO_OUT` 금지
- `OFFSITE -> GO_OUT` 금지
- `CLOCK_OUT` 후 동일 세션 재오픈 금지. 정정은 `MANUAL_ADJUST` 또는 관리자 조정으로 처리
- `WFH_START`는 당일 재택 허용 정책이 있을 때만 허용
- `CLOCK_OUT`은 `WORKING`, `OFFSITE`, `BREAK`, `WFH_WORKING`에서 허용 가능하되, `OFFSITE` 종료는 anomaly 생성 가능

### 검증 결과 타입
- `PASS`
- `PASS_WITH_EVIDENCE_REQUIRED`
- `BLOCKED`
- `SOFT_FAIL_REVIEW_REQUIRED`

### 필수 응답 항목
- eventAccepted
- nextState
- anomalyCodes[]
- evidenceRequired[]
- approvalRequired
- warnings[]

---

## 8.4 예외 상황 증빙

### 증빙 요구 조건 예시
- 지각
- 허용 반경 밖 위치
- 허용 Wi-Fi 불일치
- Beacon 미검출
- 외근 종료 없이 퇴근
- 네트워크 불안정으로 이벤트 지연 전송
- 승인 없는 연장근로
- 디바이스 신뢰도 낮음

### 증빙 구성
- 텍스트 사유(필수/선택)
- 현장 사진
- 원본 캡처 시각
- GPS 좌표
- 수집된 Wi-Fi BSSID 목록
- Beacon 식별자 목록
- 앱 버전 / OS 버전 / 기기 식별자 해시

### 사진 요구사항
- 최대 10MB
- JPEG/PNG 허용
- 업로드 직후 서버에서 EXIF 제거
- 이미지 원본은 object storage 저장
- 썸네일 별도 생성
- 보관기간 정책화 (예: 90일, 180일, 1년)

### UI 동작
- 차단이 아닌 경우 팝업으로 증빙 입력 후 계속 진행
- 차단인 경우 원인 메시지 + 문의/정정 요청 CTA 제공
- 제출 전 필수 항목 누락 시 저장 불가

---

## 8.5 스케줄 및 근무제 관리 (Dynamic Scheduling)

### 근무제(Track) 유형
- FIXED
- STAGGERED
- FLEXIBLE_2W
- FLEXIBLE_3M
- SELECTIVE
- SHIFT
- WFH
- MIXED

### Schedule Template
반복 가능한 근무 패턴을 의미한다.

필수 속성:
- template_code
- name
- work_policy_id
- track_type
- default_start_time
- default_end_time
- break_rule_set
- core_time_start / core_time_end
- effective_from / effective_to
- cross_midnight
- next_day_cutoff_time

### Template Day Rule 예시
- 월~금 09:00~18:00
- 토/일 휴무
- 휴게 12:00~13:00
- 코어타임 10:00~16:00
- 지각 기준 09:10
- 조퇴 기준 17:50

### 스케줄 배포
- 사용자 개별 배포
- 유닛 단위 배포
- 사이트 단위 배포
- 드래그 앤 드롭 일괄 배포
- 특정 기간만 한시 적용 가능

### 실제 shift 확정 방식
1. template assignment 배포
2. worker가 날짜 범위별 shift instance를 materialize
3. 휴일/예외/교대 교환/승인 결과 반영
4. 출퇴근 시점에는 shift instance를 우선 참조

### 우선순위
1. 개별 확정 shift instance
2. 승인된 schedule change
3. 개별 schedule assignment
4. 팀/unit schedule assignment
5. 기본 work policy

---

## 8.6 근로시간 계산 엔진

### 핵심 개념
- **scheduled_minutes**: 예정 근무시간
- **gross_work_minutes**: 이벤트 간 실제 근무시간 합
- **break_minutes**: 차감 대상 휴게시간
- **recognized_work_minutes**: 인정 근무시간
- **overtime_minutes**: 정책상 초과근무로 인정된 시간
- **night_minutes**: 야간 시간대 근무시간
- **holiday_minutes**: 휴일 근무시간
- **late_minutes**: 지각 분
- **early_leave_minutes**: 조퇴 분

### 기본 계산식
```text
recognized_work_minutes =
  gross_work_minutes
  - unpaid_break_minutes
  - invalidated_minutes
```

### 세션 앵커(work_date_local) 규칙
- 야간 교대 등 자정 넘김을 지원하기 위해 세션은 `work_date_local`을 가진다.
- `work_date_local`은 우선 `shift_instance.shift_date`를 따른다.
- shift가 없으면 최초 `CLOCK_IN`의 site timezone 기준 날짜를 사용한다.
- 단, `next_day_cutoff_time` 이전 이벤트는 전일 세션에 귀속 가능하다.

예:
- 22:00 출근, 06:00 퇴근, cutoff 08:00 -> 하나의 전일 세션으로 처리

### 지각 판정
- 기준 = `scheduled_start_at + grace_minutes`
- `actual_first_work_start > 기준`이면 late
- 승인된 예외/정정/교통이슈 규칙이 있으면 late 무효화 가능

### 조퇴 판정
- 기준 = `scheduled_end_at - early_leave_grace_minutes`
- `actual_last_work_end < 기준`이면 early leave

### 휴게 계산
- 자동 차감 / 수동 이벤트 기반 차감 / 혼합형 지원
- auto deduction 예:
  - 4시간 이상 근무 시 30분
  - 8시간 이상 근무 시 60분
- break event가 있을 경우 실제 휴게 우선, 정책에 따라 최소/최대 차감 보정

### 주간 누적시간 추적
- 세션 저장/수정/승인 시 주간 누적치를 재계산
- 임계치 예시:
  - 80% 도달: warning
  - 90% 도달: high warning
  - 100% 도달: lock or approval required

### 초과근무 처리
- `recognized_work_minutes > scheduled_minutes`인 시간 중
- 승인 정책과 cap 정책을 반영하여 `overtime_minutes`를 산정

### 권고 구현 방식
- 세션 저장 시 요약 컬럼 업데이트
- 원본 계산 로그는 JSON으로 별도 보관
- 정책 변경 시 재계산 작업은 비동기 큐로 수행

---

## 8.7 근로시간 초과 방지 Lock 및 알림

### 기능
- 근로자별 주간 누적시간 임계치 추적
- 경고/잠금/승인요청 자동화
- 관리자/직원 Push/이메일/인앱 알림

### 동작 모드
1. **Monitor Only**
   - 경고만 발송
2. **Soft Lock**
   - 계속 진행 가능하나 승인 요청 유도
3. **Hard Lock**
   - 출근/퇴근/연장근로 이벤트 차단 또는 제한
4. **Hybrid**
   - 특정 역할/사업장/근무제에 따라 다르게 적용

### 필수 정책 파라미터
- weekly_warning_threshold_minutes
- weekly_hard_lock_threshold_minutes
- daily_max_minutes
- require_pre_approval_for_overtime
- allow_post_approval
- notify_manager_before_lock

### 시스템 반응
- 임계치 근접 시 `WEEKLY_LIMIT_NEAR`
- 초과 예상 시 `OVERTIME_PRE_APPROVAL_REQUIRED`
- 한도 초과 시 `WEEKLY_LIMIT_EXCEEDED`
- 승인 없이 종료시간 초과 근무 중이면 `UNAPPROVED_OVERTIME`

---

## 8.8 승인 워크플로우

### 지원 요청 타입
- 휴가 신청
- 연장근로 신청
- 스케줄 변경 신청
- 근태 정정 신청
- 재택근무 신청/전환 요청
- 디바이스 변경 승인(선택)

### 공통 Approval Request 구조
- request_type
- requester_id
- target_user_id
- requested_period
- reason
- status
- current_step_order
- final_decision_at
- final_decision_by
- source_entity_type
- source_entity_id

### 상태
- DRAFT
- SUBMITTED
- PENDING
- APPROVED
- REJECTED
- CANCELLED
- EXPIRED

### 단계
- 단일 승인
- 다단계 순차 승인
- 병렬 승인(전원/과반)
- 대결재자(delegate) 지원
- SLA 시간 초과 escalation 지원

### 공통 요구사항
- 각 요청은 템플릿 기반으로 승인 라인을 결정
- 승인/반려 시 코멘트 필수 여부 정책화
- 승인 완료 시 원본 엔터티(shift, session, overtime, leave)에 반영
- 반영 후 관련 세션/주간 집계를 재계산

### 사전 승인과 사후 승인
- 연장근로: 사전 승인 우선, 정책상 사후 승인 허용 가능
- 스케줄 변경: 시작 전 승인 권장, 불가피한 경우 사후 승인 허용
- 근태 정정: 원칙적으로 사후 승인
- 휴가: 최소한 팀장 이상 승인 필요하도록 정책화

---

## 8.9 휴가/결근/정정 처리

### 휴가 유형 예시
- 연차
- 반차(오전/오후)
- 병가
- 공가
- 무급휴가
- 대체휴무
- 재택전환

### 휴가 잔액 처리
v1에서는 두 가지 모드를 지원한다.
1. WorkSync 내부 관리
2. 외부 HR/ERP 원장 동기화

### 결근 처리
다음 조건을 모두 만족하면 결근 anomaly 생성 가능
- 예정 shift 존재
- 승인된 휴가 없음
- 실제 출근 이벤트 없음
- 관리자 수동 정정 없음

### 근태 정정
- 누락 출근/퇴근 보정
- 잘못된 외근/복귀 시각 수정
- 사진/위치 증빙 재첨부
- 관리자 직접 수정 또는 승인 기반 수정

### 정정 원칙
- 원본 이벤트는 삭제하지 않는다.
- 정정은 `MANUAL_ADJUST` 이벤트 또는 adjustment record로 남긴다.
- “원본”과 “최종 인정값”을 모두 추적 가능해야 한다.

---

## 8.10 실시간 다중 사업장 관제 대시보드

### 핵심 목표
- 본사 또는 광역 관리자가 여러 사업장/매장의 현재 근태 상태를 한 화면에서 확인
- 이슈 사업장을 빠르게 식별
- 관리자 조치가 필요한 항목 우선 노출

### 필수 위젯
1. 전체 요약 카드
   - 예정 인원
   - 출근 인원
   - 재택 인원
   - 외근 인원
   - 결근 추정 인원
   - 지각 인원
   - 미퇴근 인원
2. 사업장 리스트
3. 지도 뷰
4. 이상 징후 피드
5. 승인 Inbox 요약
6. 주간 근로시간 위험 인원

### 필터
- organization
- unit subtree
- site
- date
- shift type
- employment type
- anomaly type
- approval status

### 실시간 갱신
- 기본 10초 polling 또는 SSE
- 출퇴근/외근/복귀 이벤트 발생 시 관련 위젯 즉시 갱신
- 피크 타임에는 집계 캐시 사용

### 지도 표시 정책
- 사용자 단위 실시간 위치를 지속 추적하지 않는다.
- 근태 이벤트 시점의 위치만 기록/표시한다.
- 지도에는 기본적으로 site marker와 site-level 집계만 표출하고, 개별 직원의 마지막 체크 위치는 권한 보유자에게만 제한적으로 제공

---

## 8.11 커스텀 리포트 및 다운로드

### 필수 리포트
1. 개인별 일별 근태 리포트
2. 부서별 주간 근로시간 리포트
3. 사업장별 출근율 리포트
4. 지각/조퇴/결근 집계 리포트
5. 초과근무 리포트
6. 외근/재택 비율 리포트
7. 승인 처리 리드타임 리포트

### 출력 형식
- XLSX
- PDF
- CSV (대량 연동용)

### 리포트 생성 방식
- 10,000행 이하: 동기 또는 준동기
- 대량: 비동기 export job 생성
- 완료 시 다운로드 URL 발급
- 다운로드 만료시간 설정

### 컬럼 사용자 정의
- 개인별 누적 근무시간
- 인정 근무시간
- 예정시간 대비 편차
- 지각 횟수
- 결근 횟수
- 초과근무 시간
- 휴가 사용량
- 승인 여부
- 증빙 여부
- 사업장 / 유닛 / 트랙 / 스케줄 명

### 감사 요건
- 어떤 사용자가 어떤 리포트를 언제 추출했는지 로그 저장
- 민감 리포트는 watermark 또는 사내식별 정보 포함 가능

---

## 8.12 알림 시스템

### 채널
- 인앱
- Push
- 이메일
- 향후 외부 메신저(Webhook) 확장

### 주요 트리거
- 출근 임박 미체크
- 지각 발생
- 이상 위치 인증
- 승인 요청 도착
- 승인 완료 / 반려
- 주간시간 임계치 도달
- 리포트 완료
- 스케줄 변경 반영

### 알림 템플릿 변수 예시
- employeeName
- siteName
- shiftDate
- scheduledStartAt
- currentWeeklyMinutes
- thresholdMinutes
- requestType
- decisionComment

### 우선순위
- INFO
- WARNING
- CRITICAL

### 중복 방지
- 동일 유형/동일 사용자/동일 세션에 대해 rate limit 적용
- 예: 5분 내 중복 푸시 금지

---

## 8.13 감사 로그 / 이력 관리

### 반드시 로그를 남겨야 하는 행위
- 로그인 / 토큰 재발급 / 실패 로그인
- 출퇴근 이벤트 생성/수정
- 정책 변경
- 승인/반려
- 스케줄 배포
- 사용자 권한 변경
- 리포트 다운로드
- 수동 정정
- 외부 API 호출(민감 엔드포인트)

### 저장 필드
- actor_id
- actor_type
- action
- entity_type
- entity_id
- before_json
- after_json
- ip_address
- user_agent
- request_id
- created_at

### 원칙
- 감사 로그는 일반 운영 테이블과 분리 보관 권장
- 변경 전/후 diff 저장
- 개인정보 최소화 및 masking 정책 적용

---

## 9. 핵심 비즈니스 규칙

## 9.1 근무일 매핑 규칙

1. shift_instance가 있으면 해당 shift의 local date를 우선 사용
2. 없으면 첫 출근 이벤트 기준 local date 사용
3. 자정 넘김 세션은 `next_day_cutoff_time` 전까지 같은 세션으로 합침
4. cutoff 이후 최초 이벤트는 다음 세션으로 분리

## 9.2 출근 가능 시간 창

정책 예시:
- `clock_in_early_window_minutes = 120`
- `clock_in_late_window_minutes = 360`

규칙:
- 예정 시작 2시간 전부터 출근 가능
- 시작 후 6시간을 넘기면 일반 출근 차단 또는 정정 요청 유도

## 9.3 중복 이벤트 처리

- client에서 `clientEventId`를 UUID로 생성
- 동일 `clientEventId`는 idempotent 처리
- 동일 user, 동일 eventType, 동일 분단위 시각, 동일 source가 짧은 시간 내 반복되면 duplicate anomaly 생성

## 9.4 오프라인 이벤트 동기화

- 모바일은 네트워크 불안정 시 이벤트를 로컬 큐에 저장 가능
- 서버에는 `capturedAt`, `submittedAt`, `deviceSequence`를 함께 전송
- 허용 지연시간을 초과하면 `LATE_SYNC` anomaly 생성
- 정책상 중요 사업장은 오프라인 동기화 이벤트를 자동 승인하지 않고 검토 대상으로 전환 가능

## 9.5 수동 정정 우선순위

최종 인정값 계산 우선순위:
1. 승인된 관리자 정정
2. 승인된 요청(휴가/연장/스케줄 변경)
3. 시스템 계산 결과
4. 원본 이벤트

## 9.6 결근 확정 시점

- 당일 마감 시각(`absence_finalize_at`) 도달 후 배치 수행
- 예정 근무 존재 + 출근 없음 + 승인 휴가 없음 -> ABSENT
- 이후 정정/휴가 승인 시 상태 해제 가능

## 9.7 재택근무 규칙

- 재택 가능 track 또는 승인된 요청이 있어야 함
- 재택 시작 시 GPS는 optional, 디바이스 신뢰도와 사유를 강화할 수 있음
- 재택 중 외근 상태 전이는 기본 금지, 필요 시 정책으로 허용

## 9.8 외근 규칙

- 외근은 기본적으로 근무 세션이 열린 상태에서만 시작 가능
- 외근 시작 시 목적/방문지 입력을 요구할 수 있음
- 외근 중 GPS 완전 차단 시 anomaly 생성 가능
- 외근 후 복귀 없이 퇴근 가능 여부는 정책화

## 9.9 휴일/야간/교대

- 휴일 캘린더는 조직/사이트별 연결 가능
- 교대근무는 shift instance 기반으로 처리
- 야간시간 계산 범위는 정책으로 설정(예: 22:00~06:00)
- 휴일/야간/교대는 리포트에서 별도 구분 저장

---

## 10. UI/UX 상세 요구사항

## 10.1 공통 UX 원칙

1. **행동 우선**
   - 직원 앱의 1차 화면은 근태 행동 버튼이 중심이어야 한다.
2. **상태 명확성**
   - 현재 상태, 예정 종료시간, 누적시간, 남은 승인 요청을 항상 노출한다.
3. **예외 가시성**
   - 차단 사유와 진행 가능 사유를 구분해 보여준다.
4. **관리자 우선순위 정렬**
   - 대시보드는 이슈 우선으로 정렬한다.
5. **모바일 최소 탭**
   - 출근/퇴근/외근/복귀는 1~2탭으로 끝나야 한다.

## 10.2 직원 앱 화면 목록

1. 로그인
2. 오늘의 근무 홈
3. 출근/퇴근/외근/복귀/재택 액션 시트
4. 예외 증빙 팝업
5. 내 스케줄 캘린더
6. 내 근태 이력
7. 요청 생성(휴가/연장/정정/스케줄변경)
8. 알림 센터
9. 프로필/디바이스 관리

### 오늘의 근무 홈 필수 요소
- 현재 상태 배지
- 오늘 예정 근무시간
- 오늘 사업장/근무 유형
- 다음 가능 액션 버튼
- 주간 누적시간 바
- 최신 anomaly 또는 안내 메시지
- 미처리 승인/요청 상태

## 10.3 관리자 웹 화면 목록

1. 대시보드
2. 실시간 사업장 모니터
3. 직원 목록/상세
4. 스케줄 템플릿 관리
5. 스케줄 배포 캘린더
6. 승인 Inbox
7. 근태 상세 및 정정
8. 리포트 생성/다운로드
9. 사업장/정책 설정
10. 권한/승인 라인 설정
11. 감사 로그 뷰어
12. 연동 설정(API 키, Webhook, ERP Sync)

### 대시보드 UX
- 상단: 날짜/범위 필터
- 좌측: 조직 트리 필터
- 중앙: KPI 카드 + 지도
- 우측: 이상 징후/승인 Inbox
- 하단: 사업장 리스트와 상태 분포

---

## 11. API 설계 원칙

## 11.1 공통 규칙

- Base Path: `/v1`
- 인증: Bearer JWT
- 시간값: ISO 8601 UTC 저장, 응답은 UTC + local display info 병행 가능
- 페이지네이션: cursor 기반 우선, 일부 관리 화면은 page/size 허용
- 정렬: `sort=field:asc|desc`
- 필터: query param 기반
- 멱등성: 출퇴근 이벤트/리포트 생성/요청 생성은 `Idempotency-Key` 지원
- request id: `X-Request-Id`
- 에러 응답 표준화

## 11.2 표준 에러 형식
```json
{
  "code": "OUTSIDE_GEOFENCE",
  "message": "허용된 출근 반경 밖입니다.",
  "details": {
    "distanceMeters": 182,
    "allowedMeters": 100
  },
  "traceId": "req_01HR..."
}
```

## 11.3 주요 엔드포인트 그룹

### 인증
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/me`

### 조직/사업장
- `GET /v1/account/organizations`
- `POST /v1/account/organizations`
- `PATCH /v1/account/organizations/{organizationId}`
- `GET /v1/orgs/{orgId}/units`
- `POST /v1/orgs/{orgId}/units`
- `GET /v1/orgs/{orgId}/sites`
- `POST /v1/orgs/{orgId}/sites`
- `PUT /v1/orgs/{orgId}/sites/{siteId}/auth-policy`

### 사용자
- `GET /v1/orgs/{orgId}/users`
- `POST /v1/orgs/{orgId}/users`
- `PATCH /v1/orgs/{orgId}/users/{userId}`
- `POST /v1/me/devices/register`

### 스케줄
- `GET /v1/orgs/{orgId}/schedule-templates`
- `POST /v1/orgs/{orgId}/schedule-templates`
- `POST /v1/orgs/{orgId}/schedule-assignments`
- `GET /v1/users/{userId}/shift-instances`

### 근태
- `POST /v1/clock/validate`
- `POST /v1/clock/events`
- `GET /v1/attendance/sessions`
- `GET /v1/attendance/sessions/{sessionId}`
- `PATCH /v1/attendance/sessions/{sessionId}/adjust`

### 승인
- `GET /v1/approvals/inbox`
- `POST /v1/approvals/{approvalRequestId}/approve`
- `POST /v1/approvals/{approvalRequestId}/reject`

### 요청
- `POST /v1/overtime-requests`
- `POST /v1/schedule-change-requests`
- `POST /v1/leave-requests`
- `POST /v1/attendance-corrections`

### 대시보드/리포트
- `GET /v1/dashboard/live-summary`
- `POST /v1/reports/attendance-summary/export`
- `GET /v1/reports/export-jobs/{jobId}`

### 파일
- `POST /v1/files/presign-upload`
- `POST /v1/files/complete-upload`

---

## 12. 이벤트/비동기 처리 설계

## 12.1 이벤트 발행 원칙
도메인 상태 변경 시 내부 이벤트를 발행한다.

### 핵심 이벤트
- `attendance.event.created`
- `attendance.session.updated`
- `attendance.anomaly.created`
- `approval.request.submitted`
- `approval.request.approved`
- `approval.request.rejected`
- `schedule.assignment.published`
- `report.export.requested`
- `report.export.completed`
- `notification.dispatch.requested`

## 12.2 큐 처리 대상
- shift instance materialization
- 대량 세션 재계산
- export 생성
- 알림 발송
- 썸네일 생성
- ERP 동기화
- 결근 마감 배치

## 12.3 권장 큐 분리
- `clock-low-latency`
- `attendance-recalc`
- `approval-side-effects`
- `report-export`
- `notification`
- `integration-sync`
- `media-processing`

---

## 13. 데이터 모델 설계 원칙

## 13.1 모델링 원칙

1. 원본 이벤트와 계산 결과를 분리한다.
2. 계산에 자주 쓰이는 값은 세션 테이블에 요약 저장한다.
3. 승인 워크플로우는 공통 엔진으로 설계하고 source entity를 참조한다.
4. 조직/유닛/사업장/사용자 관계는 scope 기반으로 확장 가능해야 한다.
5. 삭제 대신 soft delete를 우선 사용한다.
6. 모든 주요 테이블은 `organization_id`를 포함하여 멀티테넌시를 단순화한다.

## 13.2 핵심 엔터티

### Organization
- 고객사 단위

### Unit
- 계층형 조직 단위

### Site
- 물리적 근무지

### User
- 직원/관리자 공통 사용자

### WorkPolicy
- 근무, 휴게, 지각, 초과근무, 인증 정책

### ScheduleTemplate / Assignment / ShiftInstance
- 예정 근무 정의

### AttendanceSession
- 하루 근태 세션 요약

### AttendanceEvent
- 개별 상태 전환 원본 이벤트

### AttendanceAnomaly
- 이상 징후

### ApprovalRequest / ApprovalStep
- 요청과 승인 흐름

### OvertimeRequest / ScheduleChangeRequest / LeaveRequest
- 도메인별 상세 요청

### File
- 사진/첨부 파일 메타데이터

### AuditLog
- 감시용 이력

---

## 14. 성능 / 확장성 / 가용성 요구사항

## 14.1 목표 지표 (Reference Target)

- 조직 수: 100+
- 총 직원 수: 100,000명
- 피크 동시 출퇴근 요청: 분당 30,000건
- `POST /v1/clock/events` p95: 400ms 이하
- 대시보드 요약 응답 p95: 1.5초 이하
- export 100,000행 생성: 5분 이내
- 월 가용성: 99.9% 이상

## 14.2 확장 전략
- clock path는 stateless API로 수평 확장
- Redis cache로 dashboard 요약 캐싱
- report/export는 worker pool 분리
- 이미지 업로드는 API 서버를 거치지 않고 pre-signed URL 사용
- 장기적으로 audit log / event log를 cold storage로 이전

## 14.3 트랜잭션 원칙
- 출퇴근 이벤트 생성 + 세션 갱신은 같은 트랜잭션
- 알림/후속 재계산은 outbox/event queue 사용
- 외부 연동 실패가 본 거래를 롤백시키지 않도록 분리

---

## 15. 보안 / 개인정보 / 준수 요구사항

## 15.1 인증/인가
- Access Token 짧게, Refresh Token 회전
- 관리자 계정은 MFA 권장
- 중요 정책 변경은 재인증 요구 가능
- RBAC + scope filter 필수

## 15.2 개인정보 최소수집
- 이벤트 시점 위치만 저장
- 지속 위치 추적 금지
- 사진은 증빙 필요 시에만 저장
- Wi-Fi/BSSID/Beacon은 해시/정규화 저장 가능

## 15.3 데이터 보안
- at-rest encryption 지원
- object storage bucket private
- presigned URL 만료 5~15분
- 감사 로그 위변조 방지 고려

## 15.4 보존/파기
- 증빙 사진, 위치, 디바이스 로그는 보존기간 정책화
- 퇴사자 개인정보 일부 마스킹/비활성 처리
- 리포트 다운로드 이력 보존

## 15.5 법/정책 주의사항
- 국가/업종/사업장별 규정이 다를 수 있으므로 근로시간, 야간, 휴일, 연장 제한은 **정책 엔진의 설정값**으로 관리한다.
- v1 기본 프리셋은 국내 일반적인 근무제 운영을 가정하되, 운영 반영 전 노무/법무 검토를 필수로 한다.

---

## 16. 권장 백엔드 모듈 구조

```text
apps/
  api/
    src/
      modules/
        auth/
        organizations/
        users/
        sites/
        work-policies/
        schedules/
        attendance/
        approvals/
        requests/
        dashboard/
        reporting/
        files/
        notifications/
        integrations/
      common/
      config/
      main.ts
  worker/
    src/
      jobs/
        schedule-materializer.job.ts
        attendance-recalc.job.ts
        export-report.job.ts
        notification-dispatch.job.ts
        absence-finalizer.job.ts
packages/
  shared-types/
  shared-utils/
infra/
  docker/
  k8s/
docs/
```

### attendance 모듈 내부 구조 예시
```text
attendance/
  controller/
  service/
  repository/
  domain/
    entities/
    enums/
    policies/
    calculators/
    state-machine/
  dto/
  events/
```

---

## 17. 계산/검증 알고리즘 구현 가이드

## 17.1 Clock Validation 의사코드
```ts
function validateClockEvent(input) {
  const user = loadActiveUser(input.userId);
  const shift = resolveShift(user, input.occurredAt, input.siteId);
  const session = resolveOrCreateSession(user, shift, input.occurredAt);
  assertTransitionAllowed(session.currentState, input.eventType);

  const authPolicy = loadAuthPolicy(user, shift, input.siteId, input.eventType);
  const authResult = verifyAuthSignals(input.signals, authPolicy);

  if (authResult.blocked) {
    throw new BusinessError(authResult.code, authResult.message);
  }

  const evidenceRequirements = deriveEvidenceRequirements(authResult, shift, session);
  const anomalies = detectAnomalies(input, shift, session, authResult);

  return {
    eventAccepted: true,
    nextState: nextState(session.currentState, input.eventType),
    evidenceRequired: evidenceRequirements,
    anomalyCodes: anomalies.map(a => a.code),
    approvalRequired: deriveApprovalRequirement(input, shift, session),
  };
}
```

## 17.2 Session Recalculation 의사코드
```ts
function recalculateSession(sessionId) {
  const session = getSession(sessionId);
  const events = getOrderedEvents(sessionId);
  const policy = loadWorkPolicy(session.workPolicyId);
  const shift = getShift(session.shiftInstanceId);
  const approvals = getAppliedApprovals(session.userId, session.workDateLocal);

  const intervals = buildWorkingIntervals(events);
  const gross = sum(intervals.minutes);
  const breakMinutes = calculateBreakMinutes(events, policy, intervals);
  const lateMinutes = calculateLateMinutes(shift, intervals, approvals, policy);
  const earlyLeaveMinutes = calculateEarlyLeaveMinutes(shift, intervals, approvals, policy);

  const recognized = gross - breakMinutes;
  const overtime = calculateOvertimeMinutes(recognized, shift, approvals, policy);

  persistSummary(sessionId, {
    grossWorkMinutes: gross,
    breakMinutes,
    recognizedWorkMinutes: recognized,
    overtimeMinutes: overtime,
    lateMinutes,
    earlyLeaveMinutes,
    summaryStatus: deriveSummaryStatus(...),
  });
}
```

---

## 18. QA 및 인수 기준

## 18.1 기능 인수 기준 샘플

### 출근 체크
- 정상 위치/정상 Wi-Fi/정상 디바이스에서 출근 시 1초 이내 성공 표시
- 동일 clientEventId 재전송 시 중복 이벤트가 생성되지 않음
- 허용 반경 밖 출근 시 정책에 따라 차단 또는 증빙 요구가 정확히 동작
- 지각 판단이 예정 시작 + grace 기준으로 계산됨

### 외근/복귀
- 근무 중 외근 전환 가능
- 외근 상태에서 복귀 없이 퇴근 시 정책대로 anomaly 생성
- 외근 이벤트가 대시보드에 10초 이내 반영

### 재택
- 재택 허용 없는 사용자는 WFH_START 불가
- 재택 승인 후 같은 날짜에만 시작 가능
- 재택 세션도 주간 누적시간 계산에 포함

### 승인
- 연장근로 요청 승인 시 관련 세션 초과근무 시간이 재계산
- 반려 시 승인 이력과 코멘트가 남음
- 병렬 승인 시 요구 조건을 만족해야 최종 승인 처리됨

### 리포트
- 동일 조건 export 요청 중복 제출 시 idempotent 또는 dedupe 처리
- 100,000행 export를 비동기로 생성
- 다운로드 완료 후 이력이 감사 로그에 남음

## 18.2 비기능 인수 기준
- p95 응답시간 기준 충족
- 주요 API에 대한 감사 로그 누락 없음
- RBAC 우회 불가
- 잘못된 scope로 다른 유닛 데이터 조회 불가
- 장애 발생 시 clock event가 유실되지 않음(outbox/queue/retry)

---

## 19. 운영 / 배포 / 장애 대응

## 19.1 배포 전략
- blue/green 또는 rolling deployment
- DB migration은 backward-compatible 우선
- feature flag로 신규 인증정책/승인플로우 단계적 배포

## 19.2 장애 대응
- clock event path 장애 시 임시 degrade 모드 제공 가능
- queue 적체 모니터링
- export worker 분리 배포
- object storage 장애 시 사진 업로드 기능 degrade 처리 및 재시도 안내

## 19.3 관측성
필수 메트릭:
- clock event success rate
- clock validation latency
- anomaly creation count by type
- approval SLA breach count
- export queue lag
- notification failure rate
- DB slow query count

필수 로그:
- request_id 기준 추적
- user_id / org_id / session_id 상관관계 로깅
- worker job lifecycle 로그

---

## 20. 단계별 개발 로드맵 제안

## Phase 1 - Core MVP
- 조직/유닛/사업장
- 사용자/권한
- 출근/퇴근/외근/복귀
- GPS/Wi-Fi 인증
- 기본 스케줄
- 세션 계산
- 관리자 대시보드 요약
- 기본 리포트
- 감사 로그

## Phase 2 - 운영 고도화
- Beacon 인증
- 재택 모드
- 연장근로/정정/스케줄변경 승인
- 알림 고도화
- 대량 export
- 다단계 승인

## Phase 3 - 엔터프라이즈 확장
- ERP 연동
- 커스텀 리포트 빌더
- 고급 정책 프리셋
- 대행 승인 / SLA
- 외부 Webhook / API Key
- BI 적재 파이프라인

---

## 21. 구현 시 반드시 지켜야 할 결정사항

1. **원본 이벤트는 절대 삭제하지 않는다.**
2. **최종 인정값은 재계산 가능해야 한다.**
3. **정책값은 코드 상수로 박지 말고 DB/설정화한다.**
4. **위치 인증 실패 여부와 차단 여부를 분리한다.**
5. **출퇴근 이벤트 API는 멱등성을 지원한다.**
6. **리포트 생성은 비동기 job을 전제로 설계한다.**
7. **승인 워크플로우는 공통 엔진으로 만들고 도메인별 상세만 분리한다.**
8. **모든 조회는 scope 기반 필터링을 강제한다.**
9. **DB에는 UTC를 저장하고, work_date_local은 별도 컬럼으로 유지한다.**
10. **모바일 오프라인 큐를 고려한 이벤트 순서 필드를 둔다.**

---

## 22. 오픈 이슈 및 가정

아래 항목은 실제 착수 전 확정이 필요하지만, 본 문서에서는 구현이 가능하도록 기본 가정을 둔다.

1. 급여 계산은 v1 범위 밖이므로 인정 근무시간만 제공한다.
2. 휴가 잔액은 내부 관리 또는 외부 원장 연동 중 하나로 운영한다.
3. 법정 근로시간 제한, 야간/휴일 판단 기준은 조직별 정책 프리셋으로 제공한다.
4. 지도 SDK는 사업 환경에 따라 교체 가능해야 하므로 provider abstraction을 둔다.
5. 얼굴인식/생체인증은 추후 확장으로 미포함한다.
6. iPad/키오스크 체크인 모드는 v1 제외, 추후 별도 앱 또는 웹키오스크로 확장한다.

---

## 23. Codex 작업 지시용 요약

Codex 또는 개발 에이전트는 아래 순서로 구현하는 것이 가장 안전하다.

### Step 1
- MariaDB schema 생성
- NestJS 모듈 골격 생성
- JWT 인증 / RBAC / scope guard 구현
- organization, unit, site, user CRUD 구현

### Step 2
- work_policy, schedule_template, schedule_assignment, shift_instance 구현
- shift materializer worker 구현

### Step 3
- `/clock/validate`, `/clock/events` 구현
- attendance_session / attendance_event / anomaly / evidence 처리
- 세션 재계산 로직 구현
- idempotency 처리 구현

### Step 4
- approval_request / approval_step 공통 엔진 구현
- overtime / leave / schedule_change 요청 API 연결

### Step 5
- dashboard summary query 및 cache 구현
- export job / file storage / presigned upload 구현
- notification worker 구현

### Step 6
- audit log / observability / integration endpoints 보강
- E2E 테스트 및 부하 테스트 추가

---

## 부록 A. 대표 API Request/Response 예시

### A-1. 출근 사전 검증
```http
POST /v1/clock/validate
Authorization: Bearer <token>
Idempotency-Key: 2a0f...

{
  "eventType": "CLOCK_IN",
  "occurredAt": "2026-04-15T08:58:12+09:00",
  "siteId": "site_seoul_hq",
  "clientEventId": "af18d5a9-5d4a-4c9f-b353-b627dbd9d5de",
  "device": {
    "deviceId": "device_123",
    "platform": "ios",
    "appVersion": "1.0.0"
  },
  "signals": {
    "gps": {
      "lat": 37.5001,
      "lng": 127.0372,
      "accuracyMeters": 22
    },
    "wifi": {
      "bssids": ["AA:BB:CC:11:22:33"]
    },
    "beacons": [
      {"uuid": "fda50693-a4e2-4fb1-afcf-c6eb07647825", "major": 1, "minor": 100}
    ]
  }
}
```

```json
{
  "eventAccepted": true,
  "nextState": "WORKING",
  "evidenceRequired": [],
  "anomalyCodes": [],
  "approvalRequired": false,
  "resolvedSiteId": "site_seoul_hq",
  "resolvedShiftInstanceId": "shift_2026_04_15_user_001"
}
```

### A-2. 출근 이벤트 생성
```http
POST /v1/clock/events
Authorization: Bearer <token>
Idempotency-Key: 2a0f...

{
  "eventType": "CLOCK_IN",
  "occurredAt": "2026-04-15T08:58:12+09:00",
  "resolvedSiteId": "site_seoul_hq",
  "resolvedShiftInstanceId": "shift_2026_04_15_user_001",
  "clientEventId": "af18d5a9-5d4a-4c9f-b353-b627dbd9d5de",
  "device": {
    "deviceId": "device_123",
    "platform": "ios",
    "appVersion": "1.0.0"
  },
  "signals": {
    "gps": {
      "lat": 37.5001,
      "lng": 127.0372,
      "accuracyMeters": 22
    },
    "wifi": {
      "bssids": ["AA:BB:CC:11:22:33"]
    }
  },
  "evidence": {
    "reasonText": null,
    "fileIds": []
  }
}
```

```json
{
  "sessionId": "sess_001",
  "eventId": "evt_001",
  "currentState": "WORKING",
  "sessionSummary": {
    "scheduledMinutes": 480,
    "grossWorkMinutes": 0,
    "recognizedWorkMinutes": 0,
    "lateMinutes": 0,
    "overtimeMinutes": 0
  }
}
```

### A-3. 승인 요청 생성
```http
POST /v1/overtime-requests
Authorization: Bearer <token>

{
  "targetDate": "2026-04-15",
  "startAt": "2026-04-15T18:00:00+09:00",
  "endAt": "2026-04-15T20:00:00+09:00",
  "reason": "월간 마감 대응",
  "siteId": "site_seoul_hq"
}
```

---

## 부록 B. 권장 ER 관계 요약

```text
Organization 1---N Unit
Organization 1---N Site
Organization 1---N User
Site 1---1 SiteAuthPolicy
User N---N Unit (via UserUnitAssignment)
User 1---N UserDevice
WorkPolicy 1---N User
WorkPolicy 1---N ScheduleTemplate
ScheduleTemplate 1---N ScheduleTemplateDay
ScheduleTemplate 1---N ScheduleAssignment
ScheduleAssignment 1---N ShiftInstance
User 1---N AttendanceSession
AttendanceSession 1---N AttendanceEvent
AttendanceEvent 1---N AttendanceEvidence
AttendanceSession 1---N AttendanceAnomaly
ApprovalRequest 1---N ApprovalStep
ApprovalRequest 1---1 OvertimeRequest | ScheduleChangeRequest | LeaveRequest
File N---1 User
AuditLog N---1 User(actor)
```

---

## 부록 C. 추천 테스트 케이스 묶음

1. 정상 출근/퇴근
2. 지각 출근
3. 위치 불일치 + 증빙 후 허용
4. 위치 불일치 + hard block
5. 외근 후 복귀
6. 외근 후 바로 퇴근
7. 재택 시작/종료
8. 자정 넘김 교대근무
9. 휴가 승인으로 결근 해제
10. 승인 없는 연장근로 경고
11. 사후 승인으로 세션 재계산
12. 중복 clientEventId
13. 오프라인 큐 동기화
14. 관리자 수동 정정
15. scope 밖 데이터 조회 차단
16. 대량 export 생성
17. 사업장 비활성 상태에서 출근 차단
18. 디바이스 변경 승인
19. 다단계 승인
20. 결근 마감 배치 후 정정

---

이 문서는 `WorkSync_openapi_v1.yaml`, `WorkSync_개발백로그_v1.md`와 함께 사용해야 한다.
