# 근로정책 설정 메뉴 상세 설명

이 문서는 현재 `WorkMate` 프로젝트 구현 기준으로 `관리 > 기본 > 근로정책 설정` 메뉴의 각 요소가 무엇을 의미하는지, 화면에서 어떻게 동작하는지, 어떤 값에 영향을 받는지, 저장 후 어디에 반영되는지를 정리한 문서다.

## 1. 메뉴 위치와 전체 흐름

`근로정책 설정` 메뉴는 관리 화면의 기본 메뉴 중 하나이며, 설명은 다음과 같이 정의되어 있다.

- 메뉴 위치: `관리 > 기본 > 근로정책 설정`
- 메뉴 설명: `적용 대상, 정산 기준, 소정·최소·최대 근로시간 규칙을 설정합니다.`

화면 동작 흐름은 아래와 같다.

1. 화면 진입 시 `/v1/bootstrap` 응답의 `workPolicy`, `units`, `jobTitles`, `sites`, `holidayData` 등을 사용해 폼과 미리보기 카드가 렌더링된다.
2. 사용자가 폼 값을 수정하면 저장 전이라도 상단의 일/주/월 미리보기 카드가 즉시 다시 계산된다.
3. 저장 버튼을 누르면 `PATCH /v1/orgs/:orgId/work-policy` 요청이 전송된다.
4. 서버는 payload를 정규화한 뒤 `work_policies.policy_json.workInformation`에 대부분의 설정을 저장한다.
5. 동시에 서버는 `work_policies` 테이블의 일부 컬럼도 함께 갱신한다.
   - `standard_daily_minutes`
   - `standard_weekly_minutes`
   - `daily_max_minutes`

중요한 점은, 현재 구현에서는 메뉴의 모든 값이 근태 운영 로직에 직접 강제되는 것은 아니라는 점이다. 일부 값은 화면 미리보기와 저장된 정책 메타데이터에는 반영되지만, 실제 출퇴근 계산/차단/승인 로직까지 연결되지는 않았다.

## 2. 현재 구현에서 "즉시" 영향을 주는 범위

현재 이 메뉴의 값은 아래 범위에 확실히 영향을 준다.

- 화면 상단 미리보기 카드의 소정/최소/최대 시간 계산
- 저장 후 정책 폼 재로딩 시 표시되는 값
- `work_policies.policy_json.workInformation` 내부 저장값
- 일부 상위 컬럼 동기화
  - `standard_daily_minutes`
  - `standard_weekly_minutes`
  - `daily_max_minutes`

반대로 현재 코드 기준으로 직접 연결이 약하거나 아직 연결되지 않은 영역도 있다.

- 적용 대상(`targetRule`)은 저장되지만, 현재는 "이 정책을 실제 누구에게 자동 적용할지"까지 서버가 집행하지 않는다.
- 근로제 유형(`workType`)은 저장되지만, 현재 근태 엔진이 유형별로 별도 분기하지 않는다.
- 최소근로시간 조정 규칙, 월 최대 계산 방식, 공휴일 제외 규칙 등은 미리보기에는 반영되지만 실제 출퇴근 이벤트 처리 로직에 직접 쓰이지 않는다.
- 경고 토글(`alertOnDailyLimit`, `alertOnWeeklyLimit`, `alertOnRestTime`)은 저장되지만 현재 경고 발송 로직과 연결되어 있지 않다.

## 3. 화면 구성 개요

근로정책 설정 화면은 크게 아래 순서로 구성된다.

1. 상단 미리보기 카드
   - 일 / 주 / 월 기준의 소정, 최소, 최대 근로시간을 즉시 계산해 보여준다.
2. 적용 대상
3. 정산 기준
4. 근로 요일
5. 소정근로시간
6. 최소근로시간
7. 최대근로시간 / 경고
8. 휴일 포함 기준
9. 하단 저장 버튼

## 4. 상단 미리보기 카드

### 4.1 카드의 목적

상단 카드 3개는 사용자가 설정한 정책이 실제로 일/주/월 기준에서 어떻게 계산되는지 즉시 보여주는 요약 미리보기다.

각 카드에는 아래 항목이 표시된다.

- 기준 기간 입력값
  - 일: 날짜 입력
  - 주: `YYYY-Www` 형식의 주 입력
  - 월: `YYYY-MM` 형식의 월 입력
- 기간 라벨
  - 예: `2026년 4월 1일 - 2026년 4월 30일 · 근로일 22일`
- 소정
- 최소
- 최대
- 각 값의 계산 근거 1줄

### 4.2 어떤 값이 카드 계산에 영향을 주는가

미리보기 카드는 아래 값을 함께 사용한다.

- 근로 요일
- 주말 포함 여부
- 공휴일 제외 여부
- 대체공휴일 제외 여부
- 지정 공휴일 제외 여부
- 정산 기준의 주 시작 요일
- 정산 기준의 월 기준 방식
- 하루 소정근로시간
- 소정근로시간 계산 방식
- 최소근로시간 계산 방식과 조정 규칙
- 최대근로시간 계산 방식

### 4.3 카드가 계산에 사용하는 휴일 데이터

미리보기 카드는 관리의 공휴일 데이터(`holidayData`)를 사용한다. 따라서 공휴일 설정 화면의 데이터 상태에 따라 근로일 수가 달라질 수 있다.

예를 들어 다음과 같은 식이다.

- 특정 날짜가 공휴일인데 `공휴일 제외`가 켜져 있으면 해당 날짜는 근로일 수에서 빠진다.
- 특정 날짜가 지정 공휴일인데 `지정 공휴일 제외`가 꺼져 있으면 그 날짜는 근로일로 남는다.

### 4.4 현재 구현상의 특징

- 미리보기는 "실제 저장된 정책"이 아니라 "현재 화면에서 수정 중인 draft"를 기준으로 즉시 계산한다.
- 저장하지 않아도 카드 값은 변경된다.
- 카드 계산은 프론트엔드에서 수행된다.

## 5. 적용 대상 섹션

이 섹션은 "이 근로정보 정책을 누구 기준으로 관리할지"를 표현한다.

### 5.1 정책명

- 필드명: `policyName`
- 의미: 화면에서 식별하기 위한 정책 이름
- 예시: `본사 선택근무 정책`

동작 방식:

- 저장 시 `policy_json.workInformation.policyName`에 저장된다.
- 현재 서버는 `work_policies.name` 컬럼 자체는 이 값으로 갱신하지 않는다.
- 정책을 다시 읽어올 때는 `policy_json.workInformation.policyName`이 우선 표시된다.

영향 요소:

- 사용자 입력값
- 기존 `work_policies.name`

현재 영향 범위:

- 화면 표시
- 저장된 정책 메타데이터

### 5.2 근로제 유형

- 필드명: `workType`
- 선택값
  - `FIXED`: 고정근로
  - `SELECTIVE`: 선택적 근로시간제
  - `FLEXIBLE`: 탄력적 근로시간제
  - `SCHEDULE_BASED`: 스케줄 기반
  - `DEEMED`: 간주근로
  - `DISCRETIONARY`: 재량근로

의미:

- 정책이 어떤 성격의 근로제인지 분류하는 값이다.
- 현재 구현에서는 이 값이 근태 계산 엔진의 실제 분기 조건으로 강하게 연결되지는 않는다.

동작 방식:

- 저장 시 `policy_json.workInformation.workType`에 저장된다.
- 정책 재로딩 시 이 값을 우선 표시한다.

현재 영향 범위:

- 화면 표시
- 정책 메타데이터 보존

### 5.3 적용 범위

- 필드명: `targetRule.scope`
- 선택값
  - `ORGANIZATION`: 전체 회사
  - `UNITS`: 조직 선택
  - `JOB_TITLES`: 직급 선택
  - `SITES`: 근무지 선택
  - `MIXED`: 혼합 선택

의미:

- 정책 적용 대상을 어떤 기준으로 지정할지 나타낸다.

동작 방식:

- 선택값은 `policy_json.workInformation.targetRule.scope`에 저장된다.
- 실제 체크리스트의 선택값과 함께 저장되어 "정책 설계 의도"를 남긴다.

현재 영향 범위:

- 화면 표시
- 저장된 정책 정의

현재 제한:

- 이 값을 저장한다고 해서 현재 서버가 자동으로 특정 사용자/조직/직급/근무지에 정책을 배포하지는 않는다.

### 5.4 조직 / 직급 / 근무지 체크리스트

각각의 필드:

- `targetUnitIds`
- `targetJobTitleIds`
- `targetSiteIds`

의미:

- 적용 대상 범위를 세부적으로 선택하는 체크리스트다.

데이터 출처:

- 조직: `units`
- 직급: `jobTitles`
- 근무지: `sites`

동작 방식:

- 체크한 ID 배열이 각각 아래에 저장된다.
  - `targetRule.unitIds`
  - `targetRule.jobTitleIds`
  - `targetRule.siteIds`

현재 영향 범위:

- 화면 표시
- 정책 메타데이터 저장

현재 제한:

- 이 선택값을 기반으로 사용자의 `work_policy_id`를 자동 변경하거나 스케줄을 강제 변경하는 로직은 현재 없다.

## 6. 정산 기준 섹션

이 섹션은 "근로시간을 어떤 기간 단위로 묶어서 보느냐"를 정의한다.

### 6.1 정산 단위

- 필드명: `settlementRule.unit`
- 선택값
  - `DAY`
  - `WEEK`
  - `MONTH`
  - `CUSTOM`

의미:

- 정책을 평가하는 대표 단위를 나타낸다.

현재 동작:

- 저장은 되지만, 상단 미리보기 카드는 항상 일/주/월 3개를 모두 보여준다.
- 따라서 현재 UI에서는 "대표 단위 표시용/정책 의미 정의용" 성격이 더 크다.

### 6.2 주 시작 요일

- 필드명: `settlementRule.weekStartsOn`
- 값 범위: `1`~`7`
  - 1: 월요일
  - 7: 일요일

의미:

- 주 단위 정산과 주 미리보기 카드의 시작 날짜를 정할 때 사용한다.

실제 영향:

- 주 미리보기 카드의 기간 시작일이 바뀐다.
- 같은 주 입력값이어도 `weekStartsOn`이 다르면 근로일 계산 범위가 달라질 수 있다.

### 6.3 월 정산 기준

- 필드명: `settlementRule.monthBasis`
- 선택값
  - `CALENDAR_MONTH`: 매월 1일-말일
  - `CUSTOM_PERIOD`: 사용자 지정일

의미:

- 월 단위 계산을 일반 달력월로 볼지, 회사 커스텀 마감기간으로 볼지 정한다.

실제 영향:

- 월 미리보기 카드의 시작일/종료일이 달라진다.

예:

- `CALENDAR_MONTH`: 4월이면 4월 1일 ~ 4월 30일
- `CUSTOM_PERIOD`: 시작일/종료일 입력에 따라 예를 들어 4월 26일 ~ 5월 25일처럼 잡힐 수 있다

### 6.4 사용자 지정 시작일 / 종료일

- 필드명
  - `settlementRule.customPeriodStartDay`
  - `settlementRule.customPeriodEndDay`
- 입력 범위: 1~31

의미:

- `monthBasis = CUSTOM_PERIOD`일 때 월 정산 기간의 시작/종료 일자를 정의한다.

현재 구현 규칙:

- 종료일이 시작일보다 작으면 다음 달로 넘겨 계산한다.
- 각 월의 실제 마지막 날짜를 초과하면 그 달의 마지막 날짜로 보정한다.

예:

- 시작일 26, 종료일 25
  - 4월 기준 입력이면 4월 26일 ~ 5월 25일

### 6.5 공휴일 제외 / 대체공휴일 제외 / 지정 공휴일 제외

- 필드명
  - `settlementRule.excludePublicHolidays`
  - `settlementRule.excludeSubstituteHolidays`
  - `settlementRule.excludeCustomHolidays`

의미:

- 근로일 수 계산에서 어떤 종류의 휴일을 제외할지를 정한다.

실제 영향:

- 상단 미리보기 카드의 근로일 수
- 소정근로시간 계산
- 최소근로시간 계산

주의:

- 이름은 `제외` 기준이지만 payload에는 반대로 `includePublicHolidays`, `includeSubstituteHolidays`, `includeCustomHolidays`도 함께 관리된다.
- 현재 화면에서는 제외 체크박스가 진짜 기준이고, include 계열 값은 호환성/표시 목적에 가깝다.

## 7. 근로 요일 섹션

- 필드명: `workingDays`
- 선택값: 월~일, 내부값 1~7

의미:

- "이 정책에서 근로일로 인정하는 요일"을 정의한다.

실제 영향:

- 미리보기 카드의 근로일 수 계산
- `WORKING_DAYS_TIMES_DAILY_STANDARD` 방식의 소정근로시간 계산
- `DAILY_MIN_SUM` 방식의 최소근로시간 계산
- `WEEKLY_FIXED`, `MONTHLY_FIXED`가 아닌 경우 주 합산 기본값 계산

검증 규칙:

- 최소 1개 이상 선택해야 한다.

현재 서버/클라이언트 공통 제약:

- 아무 요일도 선택하지 않으면 저장이 막힌다.

## 8. 소정근로시간 섹션

이 섹션은 "정상적으로 기대하는 기준 근로시간"을 정의한다.

### 8.1 계산 방식

- 필드명: `standardRule.method`
- 선택값
  - `WORKING_DAYS_TIMES_DAILY_STANDARD`
  - `WEEKLY_FIXED`
  - `MONTHLY_FIXED`
  - `SCHEDULE_TEMPLATE_SUM`

각 의미는 아래와 같다.

#### 8.1.1 근로일 × 하루 소정근로시간

- 가장 기본적인 방식
- 계산식:
  - `근로일 수 × 하루 소정근로시간`

예:

- 근로일 22일, 하루 소정근로시간 8시간이면
  - 월 소정근로시간 = 176시간

#### 8.1.2 주 고정 소정시간

- 필드 `standardWeeklyTime`을 직접 기준으로 삼는다.

현재 미리보기 계산:

- 주 카드: `standardWeeklyMinutes`를 그대로 사용
- 일/월 카드: 기준 기간의 근로일 수에 맞춰 주 기준 시간을 비례 배분

#### 8.1.3 월 고정 소정시간

- 필드 `standardMonthlyTime`을 직접 기준으로 삼는다.

현재 미리보기 계산:

- 월 카드: `standardMonthlyMinutes`를 그대로 사용
- 일/주 카드: 해당 월 전체 근로일 수 대비 현재 기간의 근로일 수 비율로 안분

#### 8.1.4 스케줄 템플릿 합산

의도상 의미:

- 배정된 스케줄 템플릿의 실제 시간 합을 기준으로 삼으려는 설정이다.

현재 구현 상태:

- 현재 프론트 미리보기 계산에서는 이 값이 별도 분기로 계산되지 않고, 사실상 `근로일 × 하루 소정근로시간`과 동일하게 처리된다.
- 서버 저장 시에도 별도 템플릿 합산 로직으로 `standard_weekly_minutes`를 다시 계산하지 않는다.

즉, 현재 구현에서 이 옵션은 "의미 정의용/확장 대비용" 성격이 크다.

### 8.2 하루 소정근로시간

- 필드명: `standardDailyTime`
- 저장값: `standardDailyMinutes`
- 허용 범위: 1분 ~ 1440분

의미:

- 하루의 기준 근로시간

실제 영향:

- 소정근로시간 계산의 핵심 기준값
- 주 기준 기본 계산값
  - 서버 저장 시 `WEEKLY_FIXED`가 아니면 `workingDays.length × standardDailyMinutes`로 `standard_weekly_minutes`를 계산
- 검증 규칙
  - `dailyMinMinutes <= standardDailyMinutes <= dailyMaxMinutes`

### 8.3 주 고정 소정시간

- 필드명: `standardWeeklyTime`
- 저장값: `standardRule.standardWeeklyMinutes`
- 허용 범위: 0 ~ 10080분

의미:

- `WEEKLY_FIXED`일 때 주 소정근로시간으로 사용하는 값

실제 영향:

- 미리보기에서 `WEEKLY_FIXED` 선택 시 직접 사용

### 8.4 월 고정 소정시간

- 필드명: `standardMonthlyTime`
- 저장값: `standardRule.standardMonthlyMinutes`
- 허용 범위: 0 ~ 60000분

의미:

- `MONTHLY_FIXED`일 때 월 소정근로시간으로 사용하는 값

실제 영향:

- 미리보기에서 `MONTHLY_FIXED` 선택 시 직접 사용

## 9. 최소근로시간 섹션

이 섹션은 "최소한 인정되거나 기대되는 근로시간 기준"을 정의한다.

### 9.1 계산 방식

- 필드명: `minimumRule.method`
- 선택값
  - `SAME_AS_STANDARD`
  - `FIXED`
  - `STANDARD_MINUS_ADJUSTMENTS`
  - `DAILY_MIN_SUM`

#### 9.1.1 소정근로시간과 동일

- 최소 = 소정

현재 미리보기 결과:

- 최소 시간이 소정 시간과 똑같이 나온다.

#### 9.1.2 고정 시간 직접 입력

- 단위별 고정 최소시간을 직접 입력해 사용한다.

현재 미리보기 결과:

- 일 카드: `dailyMinMinutes`
- 주 카드: `weeklyMinMinutes`
- 월 카드: `monthlyMinMinutes`

#### 9.1.3 소정근로시간에서 조정 규칙 적용

- 소정근로시간을 시작점으로 삼고, 아래 조정 규칙들을 더하거나 빼서 최소시간을 만든다.

계산식 개념:

- `최소 = 소정 ± (매칭된 조정 규칙 횟수 × 조정 시간)`

#### 9.1.4 근로일별 최소시간 합산

- 근로일 수 × 하루 최소근로시간

계산식:

- `근로일 수 × dailyMinMinutes`

### 9.2 하루 / 주 / 월 고정 최소근로시간

- 필드명
  - `dailyMinTime`
  - `minimumWeeklyTime`
  - `minimumMonthlyTime`

의미:

- 최소근로시간 계산 방식이 `FIXED`일 때 직접 사용되는 값들이다.
- `DAILY_MIN_SUM`에서는 하루 최소근로시간이 기준이 된다.

검증 규칙:

- 하루 최소근로시간은 하루 소정근로시간보다 클 수 없다.

### 9.3 조정 규칙 행

화면에는 기존 규칙들 아래에 항상 빈 행 하나가 추가로 보인다. 이 행은 새 규칙을 바로 입력할 수 있게 하기 위한 placeholder다.

`조정 규칙 추가` 버튼을 누르면 빈 규칙 행이 하나 더 추가된다.

### 9.4 조정 규칙 필드별 의미

각 조정 규칙은 아래 구조를 가진다.

#### 규칙명

- 필드: `minimumAdjustmentName_n`
- 의미: 미리보기 breakdown과 정책 관리 식별용 이름

#### 유형

- 필드: `minimumAdjustmentType_n`
- 선택값
  - `DEDUCT`: 차감
  - `ADD`: 가산

의미:

- 조정 시간을 소정근로시간에서 뺄지 더할지 결정한다.

#### 반복

- 필드: `minimumAdjustmentRepeatUnit_n`
- 선택값
  - `DAY`
  - `WEEK`
  - `MONTH`

의미:

- 이 규칙이 어떤 주기로 매칭될지 결정한다.

현재 매칭 방식:

- `DAY`: 기간 내 모든 후보 근로일
- `WEEK`: 지정한 요일과 일치하는 날짜
- `MONTH`: 지정한 월 일자와 일치하는 날짜

#### 요일

- 필드: `minimumAdjustmentDayOfWeek_n`
- 의미:
  - `repeatUnit = WEEK`일 때 매칭 기준 요일

#### 월 반복 일자

- 필드: `minimumAdjustmentDayOfMonth_n`
- 의미:
  - `repeatUnit = MONTH`일 때 매칭 기준 일자

#### 조정 시간

- 필드: `minimumAdjustmentMinutes_n`
- 허용 범위: 0 ~ 10080분

의미:

- 규칙이 한 번 적용될 때 더하거나 빼는 시간

#### 근로일인 경우만

- 필드: `minimumAdjustmentOnlyIfWorkingDay_n`

의미:

- 해당 날짜가 `workingDays`에 포함될 때만 규칙을 적용한다.

#### 공휴일이면 제외

- 필드: `minimumAdjustmentSkipIfHoliday_n`

의미:

- 그 날짜가 휴일 규칙에 걸리면 규칙 적용을 건너뛴다.

#### 일 반영 / 주 반영 / 월 반영

- 필드: `minimumAdjustmentAppliesTo_n`
- 값
  - `DAY`
  - `WEEK`
  - `MONTH`

의미:

- 미리보기 카드 중 어떤 단위 계산에 이 규칙을 반영할지 선택한다.

예:

- `주 반영`만 체크하면 주 카드 계산에는 반영되지만 일/월 카드에는 반영되지 않는다.

### 9.5 조정 규칙의 현재 계산 방식

현재 구현에서는 조정 규칙이 아래 방식으로 동작한다.

1. 먼저 선택된 단위(`DAY`, `WEEK`, `MONTH`)와 현재 카드 단위가 맞는지 확인한다.
2. 기간 내 근로일 후보를 순회한다.
3. `repeatUnit`에 따라 요일/일자 매칭을 확인한다.
4. `onlyIfWorkingDay`가 켜져 있으면 `workingDays`에 포함되는 날짜만 허용한다.
5. `skipIfHoliday`가 켜져 있으면 휴일 날짜는 제외한다.
6. 남은 날짜 수 × `minutes`를 계산한다.
7. `type`이 `ADD`면 더하고, `DEDUCT`면 뺀다.

## 10. 최대근로시간 / 경고 섹션

이 섹션은 "허용 가능한 상한선"을 정의한다.

### 10.1 일 최대근로시간

- 필드명: `dailyMaxTime`
- 저장값: `dailyMaxMinutes`
- 허용 범위: 1 ~ 1440분

의미:

- 하루 기준 상한 시간

검증 규칙:

- `standardDailyMinutes <= dailyMaxMinutes`

저장 시 추가 반영:

- `work_policies.daily_max_minutes` 컬럼도 함께 갱신된다.

### 10.2 주 최대근로시간

- 필드명: `weeklyMaxTime`
- 저장값: `maximumRule.weeklyMaxMinutes`
- 허용 범위: 1 ~ 10080분

의미:

- 주 기준 최대근로시간

현재 미리보기:

- 주 카드의 최대 시간으로 그대로 사용된다.

### 10.3 월 최대 계산

- 필드명: `maximumRule.monthlyMaxMethod`
- 선택값
  - `WEEKLY_LIMIT_PRORATED`
  - `FIXED`

의미:

- 월 최대시간을 주 최대 기준으로 비례 계산할지, 월 고정 최대시간을 직접 사용할지 정한다.

현재 구현:

- `FIXED`이고 월 고정 최대시간이 0보다 크면 그 값을 사용
- 아니면 `weeklyMaxMinutes × (기간 총 일수 / 7)`로 계산

주의:

- 여기서 사용하는 것은 "근로일 수"가 아니라 "달력 일수"다.

### 10.4 월 고정 최대근로시간

- 필드명: `monthlyMaxTime`
- 저장값: `maximumRule.monthlyMaxMinutes`
- 허용 범위: 0 ~ 60000분

의미:

- `monthlyMaxMethod = FIXED`일 때 사용할 월 고정 상한

### 10.5 경고 토글

- `alertOnDailyLimit`
- `alertOnWeeklyLimit`
- `alertOnRestTime`

의미:

- 일 한도 초과, 주 한도 초과, 휴게/휴식 관련 상황에서 경고를 낼 것인지 정책적으로 표시한다.

현재 구현 상태:

- 저장은 된다.
- 현재 서버의 알림/차단/경고 엔진과는 직접 연결되어 있지 않다.
- 즉, 현재는 "정책 정의값"으로 저장되는 수준이다.

## 11. 휴일 포함 기준 섹션

현재 이 섹션에서 화면상 직접 수정 가능한 값은 `주말 포함` 하나다.

### 11.1 주말 포함

- 필드명: `includeWeekends`

의미:

- 토/일을 근로일 후보에 포함할지 결정한다.

실제 영향:

- 상단 미리보기 카드의 근로일 수 계산
- 소정근로시간 계산
- 최소근로시간 계산

주의:

- 공휴일 포함/제외는 이 섹션이 아니라 위의 `정산 기준` 섹션의 제외 체크박스에서 관리된다.

## 12. 시간 입력 UI의 작동 방식

시간 관련 필드는 일반 텍스트 입력이 아니라 커스텀 시간 선택기(`HH:MM`)를 사용한다.

작동 방식:

- 실제 폼 값은 hidden input에 저장된다.
- 사용자는 버튼을 눌러 시간/분 패널을 열고 선택한다.
- 값을 고르면 hidden input이 갱신된다.
- 값이 바뀌면 즉시 미리보기 카드가 다시 계산된다.

최대 범위:

- 하루 관련 필드: 최대 1440분
- 주 관련 필드: 최대 10080분
- 월 관련 필드: 최대 60000분

예:

- 하루 기준: `24:00`까지 가능
- 주 기준: `168:00`까지 가능

## 13. 저장 시 검증 규칙

클라이언트와 서버에서 공통으로 중요한 검증은 아래다.

- 근로 요일은 1개 이상 선택해야 한다.
- 하루 최소근로시간은 하루 소정근로시간보다 클 수 없다.
- 하루 소정근로시간은 하루 최대근로시간보다 클 수 없다.
- 시간 필드는 정해진 분 범위를 벗어나면 안 된다.
- 최소근로시간 조정 규칙은 이름이나 내용이 있으면 조정 시간이 유효해야 한다.

## 14. 저장 위치와 DB 반영 방식

### 14.1 대부분의 값

거의 모든 UI 값은 아래 경로에 저장된다.

- 테이블: `work_policies`
- JSON 컬럼: `policy_json`
- 내부 경로: `policy_json.workInformation`

여기에 저장되는 대표 항목:

- `policyName`
- `workType`
- `targetRule`
- `settlementRule`
- `workingDays`
- `standardRule`
- `minimumRule`
- `maximumRule`
- `includeWeekends`
- `dailyMinMinutes`
- `dailyMaxMinutes`
- `standardDailyMinutes`

### 14.2 별도 컬럼으로도 동기화되는 값

저장 시 아래 3개는 JSON뿐 아니라 컬럼에도 같이 반영된다.

- `standard_daily_minutes`
- `standard_weekly_minutes`
- `daily_max_minutes`

### 14.3 동기화되지 않는 값

아래 값들은 현재 이 메뉴에서 수정되더라도 top-level 컬럼은 바뀌지 않는다.

- `name`
- `track_type`
- `late_grace_minutes`
- `early_leave_grace_minutes`
- `clock_in_early_window_minutes`
- `clock_in_late_window_minutes`
- `weekly_warning_threshold_minutes`
- `weekly_hard_lock_threshold_minutes`
- `allow_wfh`
- `allow_clock_out_from_offsite`
- `require_pre_approval_for_overtime`

즉, 현재 메뉴는 "근로정보의 상세 정책 정의"를 `workInformation` JSON에 저장하는 구조에 가깝다.

## 15. 실제 운영 로직과의 연결 상태

현재 코드 기준으로 보면 이 메뉴는 "정책 정의와 미리보기"는 매우 구체적이지만, "근태 엔진과의 직접 연결"은 아직 부분적이다.

### 15.1 이미 연결된 부분

- 저장 API
- 부트스트랩 로딩
- 상단 미리보기 계산
- `standard_daily_minutes`, `standard_weekly_minutes`, `daily_max_minutes` 컬럼 동기화

### 15.2 아직 직접 연결이 약한 부분

- 적용 대상 자동 집행
- 근로제 유형별 엔진 분기
- 최소근로시간 조정 규칙의 실제 출퇴근 판정 반영
- 월 최대 계산 로직의 실시간 차단/경고
- 경고 토글의 실제 알림 발송
- 공휴일 제외 규칙의 실제 급여/근태 집계 엔진 반영

### 15.3 현재 근태 엔진이 실제로 보는 값과의 차이

현재 `attendance/session-store`는 근태 재계산 시 주로 아래 값을 사용한다.

- 세션의 계획 시작/종료 시간
- `work_policies.late_grace_minutes`
- `work_policies.early_leave_grace_minutes`

그런데 이 값들은 현재 근로정책 설정 화면에서 수정하지 않는다. 따라서 "근로정책 설정"에서 바꾼 값이 곧바로 현재 출퇴근 재계산 기준 전체를 바꾸는 것은 아니다.

## 16. 항목 간 영향 관계 요약

빠르게 보면 아래 관계로 이해하면 된다.

- `근로 요일`은 거의 모든 계산의 바닥 데이터다.
- `정산 기준`은 어떤 날짜 구간을 볼지 결정한다.
- `공휴일 제외`와 `주말 포함`은 근로일 수를 줄이거나 늘린다.
- `소정근로시간`은 기준 시간을 만든다.
- `최소근로시간`은 소정을 그대로 쓰거나, 고정값을 쓰거나, 조정 규칙으로 가감한다.
- `최대근로시간`은 상한선을 정의한다.
- `적용 대상`은 현재는 메타데이터 성격이 강하다.
- `근로제 유형`도 현재는 분류 정보 성격이 강하다.

## 17. 실무적으로 해석할 때의 권장 관점

현재 구현 기준으로 이 메뉴는 다음 세 층으로 이해하는 것이 가장 정확하다.

1. 정책 설계 문서화
   - 어떤 조직이 어떤 기준으로 일하는지 설명하는 구조화된 정의
2. 화면 미리보기 엔진
   - 일/주/월 기준 시간을 즉시 계산해 보여주는 도구
3. 점진적 기능 확장용 저장소
   - 아직 운영 엔진에 완전히 연결되지 않은 규칙도 먼저 저장 가능한 구조

즉, 지금은 "정책 선언과 시뮬레이션"에 강하고, "정책 자동 집행"은 일부만 구현된 상태라고 보는 것이 맞다.

## 18. 참고 구현 파일

근거가 되는 주요 구현 파일은 아래다.

- `shared/app-config.js`
- `client/renderers/management/settings.js`
- `client/renderers/management/work-schedules.js`
- `client/renderers/management/work-policy-form-sections.js`
- `client/renderers/management/work-policy-form-controls.js`
- `client/renderers/management/work-policy-normalizer.js`
- `client/renderers/management/work-policy-metrics.js`
- `client/controllers/work-policy-controller.js`
- `server/http/api-routes.js`
- `server/modules/schedules/service.js`
- `server/modules/schedules/work-policy.js`
- `server/modules/attendance/session-store.js`
