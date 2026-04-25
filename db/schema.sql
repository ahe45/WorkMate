
-- WorkSync MariaDB Schema v1.0
-- Charset: utf8mb4
-- Time policy: store timestamps in UTC, keep work_date_local for reporting
-- ID policy: application-generated UUID (CHAR(36))

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE organizations (
  id CHAR(36) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Seoul',
  metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_organizations_code (code),
  KEY idx_organizations_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE units (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  parent_unit_id CHAR(36) NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  unit_type VARCHAR(30) NOT NULL DEFAULT 'TEAM',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  sort_order INT NOT NULL DEFAULT 0,
  path VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_units_org_code (organization_id, code),
  KEY idx_units_org_parent (organization_id, parent_unit_id),
  KEY idx_units_path (path),
  CONSTRAINT fk_units_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_units_parent FOREIGN KEY (parent_unit_id) REFERENCES units(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_titles (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_job_titles_org_status (organization_id, status),
  KEY idx_job_titles_org_name (organization_id, name),
  CONSTRAINT fk_job_titles_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_title_units (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  job_title_id CHAR(36) NOT NULL,
  unit_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_job_title_units_unique (job_title_id, unit_id),
  KEY idx_job_title_units_org (organization_id, unit_id),
  CONSTRAINT fk_job_title_units_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_job_title_units_job_title FOREIGN KEY (job_title_id) REFERENCES job_titles(id),
  CONSTRAINT fk_job_title_units_unit FOREIGN KEY (unit_id) REFERENCES units(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE work_policies (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  track_type VARCHAR(30) NOT NULL DEFAULT 'FIXED',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Seoul',
  standard_daily_minutes INT NOT NULL DEFAULT 480,
  standard_weekly_minutes INT NOT NULL DEFAULT 2400,
  daily_max_minutes INT NOT NULL DEFAULT 720,
  late_grace_minutes INT NOT NULL DEFAULT 10,
  early_leave_grace_minutes INT NOT NULL DEFAULT 10,
  policy_json JSON NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_work_policies_org_code (organization_id, code),
  KEY idx_work_policies_org_default (organization_id, is_default),
  CONSTRAINT fk_work_policies_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sites (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  primary_unit_id CHAR(36) NULL,
  code VARCHAR(50) NULL,
  name VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  sort_order INT NOT NULL DEFAULT 0,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Seoul',
  country_code VARCHAR(8) NULL,
  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  postal_code VARCHAR(20) NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  geofence_radius_meters INT NULL,
  map_metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sites_org_code (organization_id, code),
  KEY idx_sites_org_status (organization_id, status),
  KEY idx_sites_org_unit (organization_id, primary_unit_id),
  CONSTRAINT fk_sites_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_sites_unit FOREIGN KEY (primary_unit_id) REFERENCES units(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  employee_no VARCHAR(50) NOT NULL,
  login_email VARCHAR(150) NULL,
  password_hash VARCHAR(255) NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NULL,
  employment_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  employment_type VARCHAR(30) NULL,
  join_date DATE NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Seoul',
  primary_unit_id CHAR(36) NOT NULL,
  default_site_id CHAR(36) NULL,
  track_type VARCHAR(30) NULL,
  work_policy_id CHAR(36) NOT NULL,
  manager_user_id CHAR(36) NULL,
  metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_org_employee_no (organization_id, employee_no),
  UNIQUE KEY uk_users_login_email (login_email),
  KEY idx_users_org_status (organization_id, employment_status),
  KEY idx_users_org_unit (organization_id, primary_unit_id),
  KEY idx_users_manager (manager_user_id),
  CONSTRAINT fk_users_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_users_primary_unit FOREIGN KEY (primary_unit_id) REFERENCES units(id),
  CONSTRAINT fk_users_default_site FOREIGN KEY (default_site_id) REFERENCES sites(id),
  CONSTRAINT fk_users_work_policy FOREIGN KEY (work_policy_id) REFERENCES work_policies(id),
  CONSTRAINT fk_users_manager FOREIGN KEY (manager_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_roles_org_code (organization_id, code),
  CONSTRAINT fk_roles_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_roles (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role_id CHAR(36) NOT NULL,
  scope_type VARCHAR(20) NOT NULL,
  scope_id CHAR(36) NULL,
  effective_from DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  effective_to DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_user_roles_user (user_id, effective_from, effective_to),
  KEY idx_user_roles_scope (scope_type, scope_id),
  CONSTRAINT fk_user_roles_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE holiday_calendars (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Seoul',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_holiday_calendars_org_code (organization_id, code),
  CONSTRAINT fk_holiday_calendars_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE holiday_dates (
  id CHAR(36) NOT NULL,
  holiday_calendar_id CHAR(36) NOT NULL,
  holiday_date DATE NOT NULL,
  name VARCHAR(150) NOT NULL,
  is_paid_holiday TINYINT(1) NOT NULL DEFAULT 1,
  holiday_source VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
  repeat_unit VARCHAR(20) NOT NULL DEFAULT 'NONE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_holiday_dates_calendar_date_source (holiday_calendar_id, holiday_date, holiday_source),
  CONSTRAINT fk_holiday_dates_calendar FOREIGN KEY (holiday_calendar_id) REFERENCES holiday_calendars(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE schedule_templates (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  work_policy_id CHAR(36) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  track_type VARCHAR(30) NOT NULL,
  effective_from DATE NULL,
  effective_to DATE NULL,
  cross_midnight TINYINT(1) NOT NULL DEFAULT 0,
  next_day_cutoff_time TIME NOT NULL DEFAULT '04:00:00',
  default_site_id CHAR(36) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_schedule_templates_org_code (organization_id, code),
  KEY idx_schedule_templates_policy (work_policy_id),
  CONSTRAINT fk_schedule_templates_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_schedule_templates_policy FOREIGN KEY (work_policy_id) REFERENCES work_policies(id),
  CONSTRAINT fk_schedule_templates_default_site FOREIGN KEY (default_site_id) REFERENCES sites(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE schedule_template_days (
  id CHAR(36) NOT NULL,
  schedule_template_id CHAR(36) NOT NULL,
  day_of_week TINYINT NOT NULL,
  is_working_day TINYINT(1) NOT NULL DEFAULT 1,
  start_time TIME NULL,
  end_time TIME NULL,
  break_minutes INT NULL,
  late_grace_minutes INT NULL,
  early_leave_grace_minutes INT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_schedule_template_days_unique (schedule_template_id, day_of_week),
  CONSTRAINT fk_schedule_template_days_template FOREIGN KEY (schedule_template_id) REFERENCES schedule_templates(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE schedule_assignments (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  schedule_template_id CHAR(36) NOT NULL,
  apply_type VARCHAR(20) NOT NULL,
  target_id CHAR(36) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_schedule_assignments_target (apply_type, target_id, effective_from, effective_to),
  KEY idx_schedule_assignments_template (schedule_template_id),
  CONSTRAINT fk_schedule_assignments_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_schedule_assignments_template FOREIGN KEY (schedule_template_id) REFERENCES schedule_templates(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE shift_instances (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  schedule_assignment_id CHAR(36) NULL,
  schedule_template_id CHAR(36) NULL,
  work_policy_id CHAR(36) NOT NULL,
  site_id CHAR(36) NULL,
  shift_date DATE NOT NULL,
  planned_start_at DATETIME(3) NOT NULL,
  planned_end_at DATETIME(3) NOT NULL,
  planned_break_minutes INT NOT NULL DEFAULT 0,
  cross_midnight TINYINT(1) NOT NULL DEFAULT 0,
  next_day_cutoff_time TIME NOT NULL DEFAULT '04:00:00',
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_shift_instances_user_date_start (user_id, shift_date, planned_start_at),
  KEY idx_shift_instances_org_user_date (organization_id, user_id, shift_date),
  KEY idx_shift_instances_site_date (site_id, shift_date),
  CONSTRAINT fk_shift_instances_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_shift_instances_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_shift_instances_assignment FOREIGN KEY (schedule_assignment_id) REFERENCES schedule_assignments(id),
  CONSTRAINT fk_shift_instances_template FOREIGN KEY (schedule_template_id) REFERENCES schedule_templates(id),
  CONSTRAINT fk_shift_instances_work_policy FOREIGN KEY (work_policy_id) REFERENCES work_policies(id),
  CONSTRAINT fk_shift_instances_site FOREIGN KEY (site_id) REFERENCES sites(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE leave_types (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  unit_type VARCHAR(20) NOT NULL DEFAULT 'DAY',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_leave_types_org_code (organization_id, code),
  CONSTRAINT fk_leave_types_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE leave_balances (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  leave_type_id CHAR(36) NOT NULL,
  balance_year SMALLINT NOT NULL,
  opening_balance DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  accrued_amount DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  used_amount DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  remaining_amount DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_leave_balances_unique (user_id, leave_type_id, balance_year),
  CONSTRAINT fk_leave_balances_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_leave_balances_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_leave_balances_leave_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendance_sessions (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  site_id CHAR(36) NULL,
  shift_instance_id CHAR(36) NULL,
  work_policy_id CHAR(36) NOT NULL,
  work_date_local DATE NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Seoul',
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  current_state VARCHAR(20) NOT NULL DEFAULT 'OFF_DUTY',
  planned_start_at DATETIME(3) NULL,
  planned_end_at DATETIME(3) NULL,
  actual_first_work_start_at DATETIME(3) NULL,
  actual_last_work_end_at DATETIME(3) NULL,
  scheduled_minutes INT NOT NULL DEFAULT 0,
  gross_work_minutes INT NOT NULL DEFAULT 0,
  break_minutes INT NOT NULL DEFAULT 0,
  recognized_work_minutes INT NOT NULL DEFAULT 0,
  overtime_minutes INT NOT NULL DEFAULT 0,
  late_minutes INT NOT NULL DEFAULT 0,
  early_leave_minutes INT NOT NULL DEFAULT 0,
  anomaly_count INT NOT NULL DEFAULT 0,
  summary_json JSON NULL,
  opened_at DATETIME(3) NULL,
  closed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_attendance_sessions_user_date (user_id, work_date_local),
  KEY idx_attendance_sessions_org_site_date (organization_id, site_id, work_date_local),
  KEY idx_attendance_sessions_org_user_date (organization_id, user_id, work_date_local),
  KEY idx_attendance_sessions_shift_instance (shift_instance_id),
  CONSTRAINT fk_attendance_sessions_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_attendance_sessions_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_attendance_sessions_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_attendance_sessions_shift_instance FOREIGN KEY (shift_instance_id) REFERENCES shift_instances(id),
  CONSTRAINT fk_attendance_sessions_work_policy FOREIGN KEY (work_policy_id) REFERENCES work_policies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendance_events (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  session_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  site_id CHAR(36) NULL,
  shift_instance_id CHAR(36) NULL,
  event_type VARCHAR(30) NOT NULL,
  current_state_before VARCHAR(20) NULL,
  current_state_after VARCHAR(20) NULL,
  occurred_at DATETIME(3) NOT NULL,
  source_type VARCHAR(20) NOT NULL DEFAULT 'MOBILE',
  client_event_id CHAR(36) NULL,
  gps_lat DECIMAL(10,7) NULL,
  gps_lng DECIMAL(10,7) NULL,
  gps_accuracy_meters DECIMAL(8,2) NULL,
  wifi_snapshot_json JSON NULL,
  reason_text TEXT NULL,
  auth_result_json JSON NULL,
  metadata_json JSON NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_attendance_events_client_event (user_id, client_event_id),
  KEY idx_attendance_events_session_time (session_id, occurred_at),
  KEY idx_attendance_events_user_time (user_id, occurred_at),
  KEY idx_attendance_events_org_site_time (organization_id, site_id, occurred_at),
  CONSTRAINT fk_attendance_events_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_attendance_events_session FOREIGN KEY (session_id) REFERENCES attendance_sessions(id),
  CONSTRAINT fk_attendance_events_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_attendance_events_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_attendance_events_shift_instance FOREIGN KEY (shift_instance_id) REFERENCES shift_instances(id),
  CONSTRAINT fk_attendance_events_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendance_anomalies (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  session_id CHAR(36) NOT NULL,
  attendance_event_id CHAR(36) NULL,
  user_id CHAR(36) NOT NULL,
  anomaly_code VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'WARNING',
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  details_json JSON NULL,
  detected_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_attendance_anomalies_session (session_id, status),
  KEY idx_attendance_anomalies_user_date (user_id, detected_at),
  KEY idx_attendance_anomalies_org_code (organization_id, anomaly_code, status),
  CONSTRAINT fk_attendance_anomalies_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_attendance_anomalies_session FOREIGN KEY (session_id) REFERENCES attendance_sessions(id),
  CONSTRAINT fk_attendance_anomalies_event FOREIGN KEY (attendance_event_id) REFERENCES attendance_events(id),
  CONSTRAINT fk_attendance_anomalies_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE leave_requests (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  target_user_id CHAR(36) NOT NULL,
  leave_type_id CHAR(36) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  partial_day_type VARCHAR(20) NULL,
  quantity DECIMAL(8,2) NOT NULL DEFAULT 1.00,
  request_reason TEXT NOT NULL,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
  cancelled_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_leave_requests_user_dates (target_user_id, start_date, end_date),
  CONSTRAINT fk_leave_requests_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_leave_requests_user FOREIGN KEY (target_user_id) REFERENCES users(id),
  CONSTRAINT fk_leave_requests_leave_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NULL,
  actor_user_id CHAR(36) NULL,
  actor_type VARCHAR(20) NOT NULL DEFAULT 'USER',
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id CHAR(36) NULL,
  request_id VARCHAR(100) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_audit_logs_org_created (organization_id, created_at),
  KEY idx_audit_logs_actor_created (actor_user_id, created_at),
  KEY idx_audit_logs_entity (entity_type, entity_id),
  CONSTRAINT fk_audit_logs_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
