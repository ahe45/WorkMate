const { resolveDatabaseName } = require("../../../db");
const { generateId } = require("../common/ids");
const { SYSTEM_ROLE_CODES, ensureSystemRoles, requireSystemRoleId } = require("../common/system-roles");

function createDemoIds() {
  return Object.freeze({
    orgId: generateId(),
    hqUnitId: generateId(),
    opsUnitId: generateId(),
    policyId: generateId(),
    siteId: generateId(),
    adminAccountId: generateId(),
    adminUserId: generateId(),
    employeeAccountId: generateId(),
    employeeUserId: generateId(),
    adminRoleBindingId: generateId(),
    employeeRoleBindingId: generateId(),
    templateId: generateId(),
    assignmentId: generateId(),
  });
}

function buildTodayShiftWindow() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const date = `${year}-${month}-${day}`;
  return {
    date,
    endAt: `${date} 18:00:00.000`,
    startAt: `${date} 09:00:00.000`,
  };
}

function createBootstrapDemoSeeder({ assertActiveDatabase, hashPassword }) {
  if (typeof assertActiveDatabase !== "function" || typeof hashPassword !== "function") {
    throw new Error("createBootstrapDemoSeeder requires assertActiveDatabase and hashPassword dependencies.");
  }

  async function seedDemoData(connection) {
    await assertActiveDatabase(connection, resolveDatabaseName());
    const [orgRows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM organizations
      `,
    );
    const orgCount = Number(orgRows[0]?.count || 0);

    if (orgCount > 0) {
      return null;
    }

    const DEMO_IDS = createDemoIds();
    const queryRunner = connection.query.bind(connection);
    const demoPasswordHash = hashPassword("Passw0rd!");
    await ensureSystemRoles(queryRunner);
    const orgAdminRoleId = await requireSystemRoleId(queryRunner, SYSTEM_ROLE_CODES.ORG_ADMIN);
    const employeeRoleId = await requireSystemRoleId(queryRunner, SYSTEM_ROLE_CODES.EMPLOYEE);
    const shiftWindow = buildTodayShiftWindow();

    await connection.query(
      `
        INSERT INTO organizations (id, code, name, status, timezone, metadata_json)
        VALUES (?, ?, ?, 'ACTIVE', 'Asia/Seoul', JSON_OBJECT('seed', true))
      `,
      [DEMO_IDS.orgId, "WORKMATE", "WorkMate Holdings"],
    );

    await connection.query(
      `
        INSERT INTO units (id, organization_id, parent_unit_id, code, name, unit_type, status, sort_order, path)
        VALUES
          (?, ?, NULL, 'HQ', '본사', 'HEADQUARTERS', 'ACTIVE', 1, '/HQ'),
          (?, ?, ?, 'OPS', '운영팀', 'TEAM', 'ACTIVE', 2, '/HQ/OPS')
      `,
      [DEMO_IDS.hqUnitId, DEMO_IDS.orgId, DEMO_IDS.opsUnitId, DEMO_IDS.orgId, DEMO_IDS.hqUnitId],
    );

    await connection.query(
      `
        INSERT INTO work_policies (
          id, organization_id, code, name, track_type, timezone, standard_daily_minutes, standard_weekly_minutes,
          daily_max_minutes, late_grace_minutes, early_leave_grace_minutes, policy_json, is_default
        )
        VALUES (
          ?, ?, 'STD-9TO6', '기본 09:00~18:00', 'FIXED', 'Asia/Seoul', 480, 2400,
          720, 10, 10, JSON_OBJECT('seed', true), 1
        )
      `,
      [DEMO_IDS.policyId, DEMO_IDS.orgId],
    );

    await connection.query(
      `
        INSERT INTO sites (
          id, organization_id, primary_unit_id, code, name, status, sort_order, timezone, country_code, address_line1,
          postal_code, lat, lng, geofence_radius_meters, map_metadata_json
        )
        VALUES (?, ?, ?, 'SEOUL-HQ', '서울 본사', 'ACTIVE', 1, 'Asia/Seoul', 'KR', '서울시 강남구 테헤란로 100', '06100', 37.4981, 127.0276, 200, JSON_OBJECT('seed', true))
      `,
      [DEMO_IDS.siteId, DEMO_IDS.orgId, DEMO_IDS.hqUnitId],
    );

    await connection.query(
      `
        INSERT INTO accounts (id, login_email, password_hash, name, role_code)
        VALUES
          (?, 'admin@workmate.local', ?, '시스템 관리자', ?),
          (?, 'employee@workmate.local', ?, '홍길동', ?)
      `,
      [
        DEMO_IDS.adminAccountId,
        demoPasswordHash,
        SYSTEM_ROLE_CODES.SYSTEM_ADMIN,
        DEMO_IDS.employeeAccountId,
        demoPasswordHash,
        SYSTEM_ROLE_CODES.EMPLOYEE,
      ],
    );

    await connection.query(
      `
          INSERT INTO users (
            id, organization_id, account_id, employee_no, login_email, password_hash, name, phone, employment_status,
            employment_type, join_date, timezone, primary_unit_id, default_site_id, track_type, work_policy_id,
            manager_user_id, metadata_json
          )
          VALUES
            (?, ?, ?, 'A0001', 'admin@workmate.local', ?, '시스템 관리자', '010-0000-0001', 'ACTIVE', 'FULL_TIME', CURDATE(), 'Asia/Seoul', ?, ?, 'FIXED', ?, NULL, JSON_OBJECT('seed', true, 'kind', 'admin')),
            (?, ?, ?, 'E0001', 'employee@workmate.local', ?, '홍길동', '010-0000-0002', 'ACTIVE', 'FULL_TIME', CURDATE(), 'Asia/Seoul', ?, ?, 'FIXED', ?, ?, JSON_OBJECT('seed', true, 'kind', 'employee'))
        `,
      [
        DEMO_IDS.adminUserId,
        DEMO_IDS.orgId,
        DEMO_IDS.adminAccountId,
        demoPasswordHash,
        DEMO_IDS.hqUnitId,
        DEMO_IDS.siteId,
        DEMO_IDS.policyId,
        DEMO_IDS.employeeUserId,
        DEMO_IDS.orgId,
        DEMO_IDS.employeeAccountId,
        demoPasswordHash,
        DEMO_IDS.opsUnitId,
        DEMO_IDS.siteId,
        DEMO_IDS.policyId,
        DEMO_IDS.adminUserId,
      ],
    );

    await connection.query(
      `
        INSERT INTO user_roles (id, organization_id, user_id, role_id, scope_type, scope_id)
        VALUES
          (?, ?, ?, ?, 'organization', ?),
          (?, ?, ?, ?, 'self', NULL)
      `,
      [
        DEMO_IDS.adminRoleBindingId,
        DEMO_IDS.orgId,
        DEMO_IDS.adminUserId,
        orgAdminRoleId,
        DEMO_IDS.orgId,
        DEMO_IDS.employeeRoleBindingId,
        DEMO_IDS.orgId,
        DEMO_IDS.employeeUserId,
        employeeRoleId,
      ],
    );

    await connection.query(
      `
        INSERT INTO schedule_templates (
          id, organization_id, work_policy_id, code, name, track_type, effective_from, effective_to,
          cross_midnight, next_day_cutoff_time, default_site_id, status
        )
        VALUES (?, ?, ?, 'WEEKDAY-0900', '주간 기본 템플릿', 'FIXED', CURDATE(), NULL, 0, '04:00:00', ?, 'ACTIVE')
      `,
      [DEMO_IDS.templateId, DEMO_IDS.orgId, DEMO_IDS.policyId, DEMO_IDS.siteId],
    );

    const dayValues = [];
    const dayParams = [];

    for (let day = 1; day <= 5; day += 1) {
      dayValues.push("(?, ?, ?, 1, '09:00:00', '18:00:00', 60, 10, 10)");
      dayParams.push(generateId(), DEMO_IDS.templateId, day);
    }

    for (let day = 6; day <= 7; day += 1) {
      dayValues.push("(?, ?, ?, 0, NULL, NULL, NULL, NULL, NULL)");
      dayParams.push(generateId(), DEMO_IDS.templateId, day);
    }

    await connection.query(
      `
        INSERT INTO schedule_template_days (
          id, schedule_template_id, day_of_week, is_working_day, start_time, end_time, break_minutes,
          late_grace_minutes, early_leave_grace_minutes
        )
        VALUES ${dayValues.join(", ")}
      `,
      dayParams,
    );

    await connection.query(
      `
        INSERT INTO schedule_assignments (
          id, organization_id, schedule_template_id, apply_type, target_id, effective_from, effective_to, status
        )
        VALUES (?, ?, ?, 'USER', ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'ACTIVE')
      `,
      [DEMO_IDS.assignmentId, DEMO_IDS.orgId, DEMO_IDS.templateId, DEMO_IDS.employeeUserId],
    );

    await connection.query(
      `
        INSERT INTO shift_instances (
          id, organization_id, user_id, schedule_assignment_id, schedule_template_id, work_policy_id, site_id,
          shift_date, planned_start_at, planned_end_at, planned_break_minutes, cross_midnight, next_day_cutoff_time, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 60, 0, '04:00:00', 'CONFIRMED')
      `,
      [
        generateId(),
        DEMO_IDS.orgId,
        DEMO_IDS.employeeUserId,
        DEMO_IDS.assignmentId,
        DEMO_IDS.templateId,
        DEMO_IDS.policyId,
        DEMO_IDS.siteId,
        shiftWindow.date,
        shiftWindow.startAt,
        shiftWindow.endAt,
      ],
    );

    return DEMO_IDS;
  }

  return {
    seedDemoData,
  };
}

module.exports = {
  createBootstrapDemoSeeder,
};
