const mysql = require("mysql2");

const { quoteIdentifier } = require("../db");

const TABLE_COMMENTS = Object.freeze({
  organizations: "서비스에서 관리하는 회사/워크스페이스 마스터. 회사 코드, 표시명, 기본 타임존, 시스템 플래그 등 회사 단위 기준 정보를 보관한다.",
  units: "회사 내부 조직 트리. 본부, 부서, 팀 같은 계층 구조와 정렬 순서를 저장하며 사용자/근무지의 소속 기준으로 사용한다.",
  job_titles: "회사별 직책/직무 마스터. 사용자를 역할군으로 분류하거나 정책 대상 범위를 지정할 때 사용하는 직책 정의를 보관한다.",
  job_title_units: "직책과 조직의 연결 매핑. 특정 직책이 어느 조직에서 사용 가능한지 제한하거나 표시 범위를 정할 때 사용한다.",
  work_policies: "근로정책 마스터. 표준 근로시간, 최대 근로시간, 지각/조퇴 유예와 상세 정책 JSON 등 근태 계산 기준을 저장한다.",
  sites: "근무지/사업장 마스터. 주소, 좌표, 지오펜스 반경, 연결 조직 등 출퇴근 위치 판정에 필요한 기준 정보를 저장한다.",
  accounts: "로그인 계정 마스터. 하나의 이메일과 비밀번호로 여러 워크스페이스 멤버십(users)을 묶는 상위 인증 계층이다.",
  users: "워크스페이스별 멤버십 및 인사 기본 정보. 로그인 계정(accounts)과 분리되어 조직별 사번, 소속, 근무정책, 재직 상태를 저장한다.",
  roles: "권한 역할 마스터. 시스템 공통 역할 또는 조직별 역할 코드를 정의한다.",
  user_roles: "사용자에게 부여된 역할 이력. 어떤 사용자가 어떤 범위(scope)에서 어떤 역할을 갖는지 기록한다.",
  user_join_invitations: "직원 합류 요청 링크 저장소. 로그인용 초대 토큰 해시, 만료 시각, 사용/폐기 여부와 메일 발송 결과를 추적한다.",
  holiday_dates: "사용자 지정 공휴일 저장소. 법정 공휴일은 코드에서 계산하고, 이 테이블에는 CUSTOM 지정 공휴일의 날짜, 휴일명, 반복 규칙만 저장한다.",
  schedule_templates: "반복 근무패턴 템플릿. 근무일정 배포 전에 재사용할 수 있는 주간/교대 패턴의 상위 정의를 보관한다.",
  schedule_template_days: "스케줄 템플릿의 요일별 상세 규칙. 각 요일의 근무 여부, 시작/종료 시각, 휴게시간, 유예시간을 정의한다.",
  schedule_assignments: "스케줄 템플릿 배정 이력. 특정 사용자/조직/근무지에 템플릿을 언제부터 언제까지 적용했는지 저장한다.",
  shift_instances: "사용자별 실제 근무 계획 인스턴스. 특정 날짜에 확정된 근무 일정 한 건을 저장하며 근태 계산의 기준이 된다.",
  leave_groups: "회사별 휴가정책 마스터. 연차, 보상휴가 등 휴가 잔액을 묶어 관리하는 정책 계층과 초과 사용 제한을 저장한다.",
  leave_types: "회사별 휴가 유형 마스터. 연차, 보상휴가, 기타휴가 같은 휴가 분류와 표시명을 관리한다.",
  leave_balances: "사용자별 연도 휴가 잔액 원장. 기초, 발생, 사용, 잔여 수량을 휴가 유형별로 저장한다.",
  leave_accrual_rules: "규칙 기반 휴가 자동 발생 설정. 대상 휴가정책, 입사 즉시/근속월수/근속연수별 발생 주기, 발생 수량과 소멸 기준을 저장한다.",
  leave_accrual_entries: "휴가 발생 원장. 수동 부여 또는 규칙 실행으로 사용자별 발생한 휴가 수량과 근거를 기록한다.",
  attendance_sessions: "사용자 1일 근태 세션 집계 테이블. 하루 동안의 이벤트를 묶어 인정 근무시간, 지각, 연장근무를 계산한 결과를 저장한다.",
  attendance_events: "근태 이벤트 원장. 출근/퇴근/재택 시작 같은 상태 변경 이벤트와 당시 인증 근거를 시계열로 기록한다.",
  attendance_anomalies: "근태 이상징후 기록. 지오펜스 이탈, 인증 누락 등 세션 또는 이벤트에서 감지된 경고 항목을 저장한다.",
  leave_requests: "휴가 신청 내역. 신청 대상자, 휴가 유형, 기간, 사유와 현재 승인 상태를 한 레코드에 저장한다.",
  audit_logs: "주요 변경 작업 감사 로그. 누가 어떤 엔터티를 어떤 요청으로 바꿨는지 추적하기 위한 before/after 기록을 보관한다.",
  admin_account_organizations: "관리자 계정과 관리 가능한 회사의 연결 테이블. 한 관리자가 여러 회사를 전환 관리할 수 있도록 매핑을 저장한다.",
  auth_refresh_tokens: "로그인 리프레시 토큰 저장소. 토큰 JTI, 만료 시각, 폐기 여부, 교체 관계를 추적한다.",
});

const COLUMN_COMMENTS = Object.freeze({
  account_id: "이 멤버십이 연결된 로그인 계정(accounts) ID. 같은 계정이 여러 워크스페이스 멤버십을 가질 수 있다.",
  accrued_amount: "해당 연도에 새로 발생한 휴가 수량. 기초 잔액과 별도로 누적 부여량을 저장한다.",
  accrual_date: "휴가가 발생한 기준일.",
  action: "감사 로그에 기록된 수행 동작 코드. 예: 사용자 수정, 근태 이벤트 생성.",
  actor_type: "작업을 수행한 주체의 유형. 일반 사용자, 시스템, 배치 작업 등을 구분한다.",
  actor_user_id: "작업을 수행한 실제 사용자 ID. 시스템 작업이면 NULL일 수 있다.",
  actual_first_work_start_at: "해당 근태 세션에서 처음 근무 상태로 전환된 실제 시각.",
  actual_last_work_end_at: "해당 근태 세션에서 마지막으로 근무 종료가 확정된 실제 시각.",
  after_json: "변경 후 스냅샷 JSON. 감사 로그에서 결과 상태를 재구성할 때 사용한다.",
  anomaly_code: "감지된 근태 이상 유형 코드. 예: GPS_SIGNAL_MISSING, OUTSIDE_GEOFENCE.",
  anomaly_count: "해당 근태 세션에 연결된 미해결 이상징후 건수.",
  apply_type: "스케줄 템플릿 배정 대상의 종류. USER, UNIT, SITE 같은 범위를 나타낸다.",
  approval_status: "휴가 신청의 현재 승인 상태. SUBMITTED, APPROVED, REJECTED 같은 업무 상태를 저장한다.",
  attendance_event_id: "이상징후가 특정 이벤트에서 발생했을 때 연결되는 근태 이벤트 ID.",
  auth_result_json: "근태 이벤트 처리 당시 수행한 인증 판정 결과와 경고 목록을 저장한 JSON.",
  balance_year: "휴가 잔액이 귀속되는 연도.",
  before_json: "변경 전 스냅샷 JSON. 감사 로그에서 이전 상태를 복원할 때 사용한다.",
  break_minutes: "휴게 시간 분 단위 값. 템플릿 요일 규칙 또는 집계 결과에 사용된다.",
  cancelled_at: "휴가 신청이 취소된 시각. 취소되지 않았다면 NULL.",
  client_event_id: "중복 전송 방지를 위한 클라이언트 측 이벤트 식별자.",
  closed_at: "세션이나 토큰이 종료 또는 폐기 처리된 시각.",
  code: "업무 식별용 코드. 사람도 읽을 수 있는 짧은 키로 외부 표시와 조회에 사용된다.",
  country_code: "근무지의 국가 코드. 지도/주소 처리와 지역화에 사용된다.",
  created_at: "레코드가 처음 생성된 UTC 시각.",
  created_by: "근태 이벤트를 생성한 사용자 ID. 본인 처리인지 관리자 대리 처리인지 추적할 때 사용한다.",
  created_by_user_id: "초대 링크를 생성한 관리자 사용자 ID.",
  cross_midnight: "일정이 자정을 넘겨 다음 날까지 이어지는지 여부.",
  consumed_at: "초대 링크가 실제로 사용되어 워크스페이스 합류가 완료된 시각.",
  current_state: "현재 집계된 근태 상태. 세션의 최신 상태를 저장한다.",
  current_state_after: "이 이벤트 처리 직후의 근태 상태.",
  current_state_before: "이 이벤트 처리 직전의 근태 상태.",
  daily_max_minutes: "근로정책에서 허용하는 1일 최대 근무시간(분).",
  day_of_week: "요일 숫자. 1=월요일, 7=일요일 규칙을 사용한다.",
  default_site_id: "사용자 기본 근무지 또는 템플릿 기본 근무지 ID.",
  deleted_at: "소프트 삭제 시각. NULL이면 활성 레코드로 본다.",
  delivery_error: "메일/메시지 발송 실패 시 기록하는 오류 메시지.",
  delivery_message_id: "SMTP 등 외부 발송 시스템이 반환한 메시지 식별자.",
  delivery_mode: "초대 발송 경로. smtp, suppressed 같은 실제 전달 방식을 저장한다.",
  delivery_status: "초대 발송 상태. PENDING, SENT, FAILED 같은 전달 결과를 저장한다.",
  details_json: "이상징후 세부 근거를 저장한 JSON. 경고 메시지나 부가 데이터를 담는다.",
  detected_at: "이상징후가 감지되어 기록된 시각.",
  early_leave_grace_minutes: "조퇴 판정 전에 허용하는 유예시간(분).",
  early_leave_minutes: "계획 종료 대비 실제 조기 종료로 계산된 조퇴 시간(분).",
  effective_from: "정책/템플릿/권한이 적용되기 시작하는 날짜 또는 시각.",
  effective_to: "정책/템플릿/권한 적용이 끝나는 날짜 또는 시각. NULL이면 계속 유효할 수 있다.",
  employee_no: "회사 내부에서 사용하는 사용자 사번.",
  employment_status: "재직 상태 코드. ACTIVE, INACTIVE 등 사용 가능 여부를 나타낸다.",
  employment_type: "고용 형태. 정규직, 계약직 같은 인사 구분 값을 저장한다.",
  end_date: "기간성 데이터의 종료 날짜.",
  end_time: "하루 일정 규칙의 종료 시각.",
  entity_id: "감사 로그 대상 엔터티의 기본키 값.",
  entity_type: "감사 로그 대상 엔터티의 종류. 예: user, attendance_event.",
  event_type: "근태 이벤트의 종류. CLOCK_IN, CLOCK_OUT, WFH_START 같은 상태 전이 이벤트를 저장한다.",
  expires_at: "토큰, 인증 코드, 링크 등이 더 이상 유효하지 않게 되는 시각.",
  failed_at: "발송 실패가 기록된 시각.",
  first_name: "사용자 이름 중 이름 부분.",
  geofence_radius_meters: "근무지 중심 좌표를 기준으로 허용할 출퇴근 반경(미터).",
  gps_accuracy_meters: "이벤트 수집 당시 단말이 보고한 GPS 정확도(미터).",
  gps_lat: "이벤트 수집 당시 단말의 GPS 위도.",
  gps_lng: "이벤트 수집 당시 단말의 GPS 경도.",
  gross_work_minutes: "휴게 차감 전 실제 체류 기반 총 근무시간(분).",
  holiday_date: "실제 휴일 날짜.",
  holiday_source: "휴일 데이터의 출처. 시스템 동기화값인지 사용자가 추가한 값인지 구분한다.",
  id: "애플리케이션이 생성한 UUID 기본키. 각 레코드를 전역에서 유일하게 식별한다.",
  ip_address: "요청을 발생시킨 클라이언트 IP 주소.",
  is_default: "해당 레코드가 조직의 기본 선택값인지 여부.",
  is_paid_holiday: "해당 휴일을 유급 휴일로 처리할지 여부.",
  is_working_day: "템플릿의 해당 요일이 실제 근무일인지 여부.",
  invite_channels_json: "합류 요청 발송 채널 목록(JSON). 이메일, 문자 등 사용자가 선택한 전송 방식을 저장한다.",
  invite_token_hash: "원문 초대 토큰의 SHA-256 해시값. 메일에 담긴 링크 토큰을 안전하게 검증할 때 사용한다.",
  job_title_id: "직책 마스터(job_titles) 레코드를 가리키는 ID.",
  join_date: "사용자의 입사일.",
  join_request_status: "직원 합류 요청 처리 상태. DRAFT, PENDING, REQUESTED, JOINED 같은 상태를 저장한다.",
  last_name: "사용자 성명 중 성 부분.",
  lat: "근무지 중심점의 위도.",
  late_grace_minutes: "지각 판정 전에 허용하는 유예시간(분).",
  late_minutes: "계획 시작 대비 실제 시작이 늦어진 지각 시간(분).",
  leave_type_id: "휴가 유형 마스터(leave_types)를 가리키는 ID.",
  lng: "근무지 중심점의 경도.",
  login_email: "로그인에 사용하는 사용자 이메일. 계정 식별자 역할을 한다.",
  manager_user_id: "사용자의 직접 관리자 사용자 ID.",
  map_metadata_json: "지도 검색 결과 원본, 표시명, 좌표 선택 보조 정보 등을 저장한 JSON.",
  metadata_json: "정규 컬럼으로 분리하지 않은 부가 속성, 시스템 플래그, 마이그레이션 보조값을 저장하는 확장 JSON.",
  name: "사람이 읽는 표시 이름.",
  next_day_cutoff_time: "자정 교차 일정에서 다음 날로 넘겨 집계할 마감 기준 시각.",
  occurred_at: "근태 이벤트가 실제로 발생한 UTC 시각.",
  opened_at: "세션이 시작되었거나 토큰이 발급된 시각.",
  opening_balance: "해당 연도 시작 시점의 휴가 기초 잔액.",
  organization_id: "레코드가 소속된 회사/워크스페이스 ID. 멀티테넌시 분리의 기준이 된다.",
  overtime_minutes: "인정 근무시간 중 계획 근무시간을 초과한 연장근무 시간(분).",
  parent_unit_id: "상위 조직 노드 ID. 조직 트리 계층을 구성한다.",
  parent_leave_group_id: "상위 휴가정책 노드 ID. 휴가정책 트리 계층을 구성한다.",
  immediate_accrual_type: "입사 즉시 휴가 발생 방식. FIXED는 고정 일수, PRORATED는 연간 기준 비례 계산이다.",
  proration_basis: "입사 즉시 비례 계산의 기간 기준. 회계연도 또는 입사일 기준 1년을 나타낸다.",
  proration_unit: "입사 즉시 비례 계산 단위. 잔여 일수 또는 잔여 월수를 나타낸다.",
  rounding_method: "비례 계산 휴가 일수 반올림 방식. FLOOR, ROUND, CEIL 등을 사용한다.",
  rounding_increment: "비례 계산 반올림 단위. 1일 또는 0.5일 단위 등.",
  min_amount_days: "비례 계산 후 보장할 최소 부여 일수.",
  max_amount_days: "비례 계산 후 제한할 최대 부여 일수.",
  monthly_accrual_method: "월 주기 휴가 발생 계산 방식. FIXED, CONTRACTUAL_HOURS, ATTENDANCE_RATE 등을 사용한다.",
  reference_daily_minutes: "소정근로시간 기반 비례 발생에서 기준이 되는 1일 근로시간(분).",
  attendance_accrual_method: "출근율 기반 발생 방식. 출근율에 따른 비례 발생 또는 만근 월수 기반 발생을 나타낸다.",
  attendance_rate_threshold: "출근율 기반 발생에서 전체 발생 여부를 판단하는 기준 출근율(%)",
  partial_day_type: "반차/반일 같은 부분 차감 구분 값.",
  password_hash: "로그인 비밀번호 해시값. 원문 비밀번호는 저장하지 않는다.",
  path: "조직 트리에서 현재 노드의 경로 문자열. 계층 조회 최적화에 사용한다.",
  phone: "사용자 연락처 전화번호.",
  personnel_card_json: "인사기록카드 업로드 파일의 이름, 타입, 크기, 데이터 URL 정보를 저장한 JSON.",
  planned_break_minutes: "근무 계획상 예정된 휴게시간(분).",
  planned_end_at: "계획된 근무 종료 UTC 시각.",
  planned_start_at: "계획된 근무 시작 UTC 시각.",
  policy_json: "정책 상세 규칙을 직렬화한 JSON. UI에서 입력한 고급 설정 대부분이 이 컬럼에 저장된다.",
  postal_code: "근무지 우편번호.",
  primary_unit_id: "사용자 또는 근무지가 기본 소속되는 조직 ID. 초기 워크스페이스 생성자처럼 아직 조직을 배정하지 않은 경우 NULL일 수 있다.",
  quantity: "휴가 신청 수량. 일(day) 또는 시간 기준 수량을 소수로 저장할 수 있다.",
  reason_text: "인증 예외나 수기 입력 시 사용자가 남긴 사유 텍스트.",
  recognized_work_minutes: "정책 적용 후 최종 인정된 근무시간(분).",
  remaining_amount: "현재 남아 있는 휴가 잔량.",
  repeat_unit: "사용자 지정 휴일이 반복될 주기. NONE이면 일회성 휴일이다.",
  replaced_by_invitation_id: "재발송으로 기존 링크가 폐기될 때 새 초대 레코드의 ID를 저장한다.",
  request_id: "하나의 HTTP 요청 또는 작업 흐름을 추적하기 위한 요청 식별자.",
  request_reason: "휴가 신청자가 입력한 신청 사유.",
  retire_date: "사용자의 퇴사일. 재직 중이면 NULL.",
  rule_set_id: "여러 휴가 발생 구간을 하나의 등록 규칙으로 묶는 식별자.",
  rule_set_name: "휴가 발생 구간 묶음의 사용자 입력 규칙명.",
  revoked_at: "재발송 또는 관리자 처리로 초대 링크가 폐기된 시각.",
  role_id: "권한 역할 마스터(roles)를 가리키는 ID.",
  schedule_assignment_id: "이 근무 계획이 어떤 템플릿 배정에서 생성되었는지 나타내는 ID.",
  schedule_template_id: "근무 일정 템플릿(schedule_templates)을 가리키는 ID.",
  scheduled_minutes: "계획상 근무해야 하는 총 시간(분).",
  scope_id: "역할이 적용되는 구체적인 대상 ID. organization/self 등 scope_type과 함께 해석한다.",
  scope_type: "역할 적용 범위의 종류. organization, self 같은 권한 범위를 나타낸다.",
  session_id: "근태 이벤트나 이상징후가 속한 1일 근태 세션 ID.",
  severity: "이상징후 심각도. WARNING 등 운영상 우선순위를 나타낸다.",
  shift_date: "근무 계획이 속하는 기준 날짜.",
  shift_instance_id: "근무 계획 인스턴스(shift_instances)를 가리키는 ID.",
  site_id: "근무지(site) 레코드를 가리키는 ID.",
  sort_order: "같은 범위 안에서 화면 표시 순서를 제어하는 정렬 값.",
  source_type: "이 데이터가 어느 입력 채널에서 생성되었는지 나타내는 출처 구분. 예: WEB, MOBILE.",
  standard_daily_minutes: "근로정책상 기준이 되는 1일 표준 근무시간(분).",
  standard_weekly_minutes: "근로정책상 기준이 되는 주간 표준 근무시간(분).",
  start_date: "기간성 데이터의 시작 날짜.",
  start_time: "하루 일정 규칙의 시작 시각.",
  status: "테이블별로 정의된 현재 상태 코드. ACTIVE, OPEN, CLOSED 같은 업무 상태를 저장한다.",
  summary_json: "집계 결과와 화면 보조 정보를 담은 JSON. 계산 산출물이나 출처 메모를 함께 저장한다.",
  sent_at: "초대 메일/메시지 발송이 성공으로 기록된 시각.",
  target_id: "스케줄 배정이 적용될 실제 대상의 ID. apply_type에 따라 사용자/조직/근무지를 가리킨다.",
  target_user_id: "휴가 신청 또는 대상 데이터가 귀속되는 사용자 ID.",
  timezone: "날짜 계산과 표시의 기준이 되는 IANA 타임존 문자열.",
  track_type: "근무 추적 방식. FIXED, FLEXIBLE 같은 근로 형태 분류값을 저장한다.",
  unit_id: "조직(unit) 레코드를 가리키는 ID.",
  unit_type: "조직 유형. HEADQUARTERS, DEPARTMENT, TEAM 같은 분류값을 저장한다.",
  updated_at: "레코드가 마지막으로 수정된 UTC 시각.",
  used_amount: "해당 연도에 실제 사용된 휴가 수량.",
  user_agent: "요청을 발생시킨 클라이언트의 User-Agent 문자열.",
  user_id: "사용자(users) 레코드를 가리키는 ID.",
  wifi_snapshot_json: "이벤트 처리 시점에 수집한 Wi-Fi 정보 스냅샷 JSON.",
  work_date_local: "사용자 로컬 타임존 기준의 근무일.",
  work_policy_id: "적용된 근로정책(work_policies) ID. 초기 워크스페이스 생성자처럼 아직 근로정책을 배정하지 않은 경우 NULL일 수 있다.",
});

const NUMERIC_TYPES = new Set([
  "bigint",
  "bit",
  "decimal",
  "double",
  "float",
  "int",
  "mediumint",
  "smallint",
  "tinyint",
]);

function formatDefaultValue(column) {
  if (column.columnDefault === null || column.columnDefault === undefined) {
    return "";
  }

  const defaultValue = String(column.columnDefault);

  if (defaultValue.toUpperCase() === "NULL") {
    return "NULL";
  }

  if (/^'.*'$/.test(defaultValue)) {
    return defaultValue;
  }

  if (/^current_timestamp(?:\(\d+\))?$/i.test(defaultValue)) {
    return defaultValue.toUpperCase();
  }

  if (NUMERIC_TYPES.has(column.dataType)) {
    return defaultValue;
  }

  return mysql.escape(column.columnDefault);
}

function buildColumnDefinition(column) {
  const parts = [`${quoteIdentifier(column.columnName)} ${column.columnType}`];

  if (column.characterSetName) {
    parts.push(`CHARACTER SET ${column.characterSetName}`);
  }

  if (column.collationName) {
    parts.push(`COLLATE ${column.collationName}`);
  }

  parts.push(column.isNullable === "NO" ? "NOT NULL" : "NULL");

  const defaultValue = formatDefaultValue(column);
  if (defaultValue) {
    parts.push(`DEFAULT ${defaultValue}`);
  }

  const extra = String(column.extra || "");
  if (/auto_increment/i.test(extra)) {
    parts.push("AUTO_INCREMENT");
  }

  const onUpdateMatch = extra.match(/on update (current_timestamp(?:\(\d+\))?)/i);
  if (onUpdateMatch) {
    parts.push(`ON UPDATE ${onUpdateMatch[1].toUpperCase()}`);
  }

  return parts.join(" ");
}

async function applySchemaComments(connection) {
  const [tableRows] = await connection.query(
    `
      SELECT
        table_name AS tableName,
        table_comment AS tableComment
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
    `,
  );

  const [columnRows] = await connection.query(
    `
      SELECT
        table_name AS tableName,
        column_name AS columnName,
        column_type AS columnType,
        data_type AS dataType,
        is_nullable AS isNullable,
        column_default AS columnDefault,
        extra,
        character_set_name AS characterSetName,
        collation_name AS collationName,
        column_comment AS columnComment
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
      ORDER BY table_name, ordinal_position
    `,
  );

  const tables = new Map();

  tableRows.forEach((tableRow) => {
    tables.set(tableRow.tableName, {
      columns: [],
      currentComment: tableRow.tableComment || "",
    });
  });

  columnRows.forEach((columnRow) => {
    if (!tables.has(columnRow.tableName)) {
      tables.set(columnRow.tableName, {
        columns: [],
        currentComment: "",
      });
    }

    tables.get(columnRow.tableName).columns.push(columnRow);
  });

  for (const [tableName, tableData] of tables.entries()) {
    const alterParts = [];
    const desiredTableComment = TABLE_COMMENTS[tableName] || `${tableName} 테이블`;

    tableData.columns.forEach((column) => {
      const desiredColumnComment = COLUMN_COMMENTS[column.columnName] || `${column.columnName} 컬럼`;

      if ((column.columnComment || "") === desiredColumnComment) {
        return;
      }

      alterParts.push(
        `MODIFY COLUMN ${buildColumnDefinition(column)} COMMENT ${mysql.escape(desiredColumnComment)}`,
      );
    });

    if ((tableData.currentComment || "") !== desiredTableComment) {
      alterParts.push(`COMMENT = ${mysql.escape(desiredTableComment)}`);
    }

    if (alterParts.length === 0) {
      continue;
    }

    await connection.query(`ALTER TABLE ${quoteIdentifier(tableName)} ${alterParts.join(",\n")}`);
  }
}

module.exports = {
  applySchemaComments,
  COLUMN_COMMENTS,
  TABLE_COMMENTS,
};
