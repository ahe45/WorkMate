const { hashPassword } = require("../../server/modules/auth/passwords");
const { generateId } = require("../../server/modules/common/ids");
const { SYSTEM_ROLE_CODES, ensureSystemRoles, requireSystemRoleId } = require("../../server/modules/common/system-roles");
const {
  buildDisplayName,
  buildTemplateDayRules,
} = require("./demo-workforce-models");

async function getTargetOrganization(connection, organizationCode = "") {
  const params = [];
  let sql = `
    SELECT id, code, name
    FROM organizations
    WHERE deleted_at IS NULL
  `;

  if (organizationCode) {
    sql += " AND code = ?";
    params.push(organizationCode);
  }

  sql += " ORDER BY created_at DESC LIMIT 1";
  const [rows] = await connection.query(sql, params);
  return rows[0] || null;
}

async function getDefaultWorkPolicy(connection, organizationId) {
  const [rows] = await connection.query(
    `
      SELECT id, code, name
      FROM work_policies
      WHERE organization_id = ?
        AND deleted_at IS NULL
      ORDER BY is_default DESC, created_at
      LIMIT 1
    `,
    [organizationId],
  );

  return rows[0] || null;
}

async function ensureRootUnit(connection, organizationId) {
  const [rows] = await connection.query(
    `
      SELECT id, code, name, path
      FROM units
      WHERE organization_id = ?
        AND deleted_at IS NULL
      ORDER BY CASE WHEN parent_unit_id IS NULL THEN 0 ELSE 1 END, sort_order, created_at
      LIMIT 1
    `,
    [organizationId],
  );

  if (rows[0]) {
    return rows[0];
  }

  const unitId = generateId();
  await connection.query(
    `
      INSERT INTO units (id, organization_id, parent_unit_id, code, name, unit_type, status, sort_order, path)
      VALUES (?, ?, NULL, 'ROOT', '기본 조직', 'DEPARTMENT', 'ACTIVE', 1, '/ROOT')
    `,
    [unitId, organizationId],
  );

  return {
    code: "ROOT",
    id: unitId,
    name: "기본 조직",
    path: "/ROOT",
  };
}

async function ensureUnits(connection, organizationId, rootUnit) {
  const [existingRows] = await connection.query(
    `
      SELECT id, code, name, path
      FROM units
      WHERE organization_id = ?
        AND deleted_at IS NULL
    `,
    [organizationId],
  );
  const unitMap = new Map(existingRows.map((row) => [String(row.code || "").toUpperCase(), row]));
  const unitDefinitions = [
    { code: "SALES", name: "영업팀", sortOrder: 2 },
    { code: "OPS", name: "운영팀", sortOrder: 3 },
    { code: "FIN", name: "재무팀", sortOrder: 4 },
    { code: "HR", name: "인사팀", sortOrder: 5 },
    { code: "ENG", name: "개발팀", sortOrder: 6 },
  ];

  for (const definition of unitDefinitions) {
    if (unitMap.has(definition.code)) {
      continue;
    }

    const unitId = generateId();
    const path = `${String(rootUnit.path || "/ROOT").replace(/\/$/, "")}/${definition.code}`;
    await connection.query(
      `
        INSERT INTO units (id, organization_id, parent_unit_id, code, name, unit_type, status, sort_order, path)
        VALUES (?, ?, ?, ?, ?, 'TEAM', 'ACTIVE', ?, ?)
      `,
      [unitId, organizationId, rootUnit.id, definition.code, definition.name, definition.sortOrder, path],
    );
    unitMap.set(definition.code, { ...definition, id: unitId, path });
  }

  return unitDefinitions.map((definition) => unitMap.get(definition.code));
}

async function ensureSites(connection, organizationId, primaryUnitId) {
  const [existingRows] = await connection.query(
    `
      SELECT id, code, name
      FROM sites
      WHERE organization_id = ?
        AND deleted_at IS NULL
    `,
    [organizationId],
  );
  const siteMap = new Map(existingRows.map((row) => [String(row.code || "").toUpperCase(), row]));
  const siteDefinitions = [
    {
      addressLine1: "서울시 강남구 테헤란로 100",
      code: "DEMO-HQ",
      geofenceRadiusMeters: 220,
      lat: 37.4981,
      lng: 127.0276,
      name: "데모 본사",
      postalCode: "06100",
    },
    {
      addressLine1: "서울시 영등포구 국제금융로 10",
      code: "DEMO-BRANCH",
      geofenceRadiusMeters: 180,
      lat: 37.5252,
      lng: 126.9252,
      name: "데모 사업장",
      postalCode: "07326",
    },
    {
      addressLine1: "경기도 성남시 분당구 판교역로 166",
      code: "DEMO-FIELD",
      geofenceRadiusMeters: 260,
      lat: 37.3947,
      lng: 127.1112,
      name: "데모 외근 거점",
      postalCode: "13494",
    },
  ];

  for (const definition of siteDefinitions) {
    if (siteMap.has(definition.code)) {
      continue;
    }

    const siteId = generateId();
    await connection.query(
      `
        INSERT INTO sites (
          id, organization_id, primary_unit_id, code, name, status, timezone, country_code, address_line1,
          postal_code, lat, lng, geofence_radius_meters, map_metadata_json
        )
        VALUES (?, ?, ?, ?, ?, 'ACTIVE', 'Asia/Seoul', 'KR', ?, ?, ?, ?, ?, JSON_OBJECT('source', 'demo-workforce'))
      `,
      [
        siteId,
        organizationId,
        primaryUnitId,
        definition.code,
        definition.name,
        definition.addressLine1,
        definition.postalCode,
        definition.lat,
        definition.lng,
        definition.geofenceRadiusMeters,
      ],
    );
    siteMap.set(definition.code, { ...definition, id: siteId });
  }

  return Object.fromEntries(siteDefinitions.map((definition) => [definition.code, siteMap.get(definition.code)]));
}

async function ensureLeaveTypes(connection, organizationId) {
  const [existingRows] = await connection.query(
    `
      SELECT id, code, name
      FROM leave_types
      WHERE organization_id = ?
    `,
    [organizationId],
  );
  const leaveTypeMap = new Map(existingRows.map((row) => [String(row.code || "").toUpperCase(), row]));
  const leaveTypeDefinitions = [
    { code: "ANNUAL", name: "연차휴가" },
    { code: "COMP", name: "보상휴가" },
    { code: "OTHER", name: "기타휴가" },
    { code: "SICK", name: "병가" },
  ];

  for (const definition of leaveTypeDefinitions) {
    const existing = leaveTypeMap.get(definition.code);

    if (existing) {
      if (existing.name !== definition.name) {
        await connection.query(
          `
            UPDATE leave_types
            SET name = ?
            WHERE id = ?
          `,
          [definition.name, existing.id],
        );
        existing.name = definition.name;
      }

      continue;
    }

    const leaveTypeId = generateId();
    await connection.query(
      `
        INSERT INTO leave_types (
          id, organization_id, code, name, unit_type, status
        )
        VALUES (?, ?, ?, ?, 'DAY', 'ACTIVE')
      `,
      [leaveTypeId, organizationId, definition.code, definition.name],
    );
    leaveTypeMap.set(definition.code, { ...definition, id: leaveTypeId });
  }

  return Object.fromEntries(leaveTypeDefinitions.map((definition) => [definition.code, leaveTypeMap.get(definition.code)]));
}

async function ensureScheduleTemplates(connection, organizationId, workPolicyId, siteMap) {
  const [existingRows] = await connection.query(
    `
      SELECT id, code, name
      FROM schedule_templates
      WHERE organization_id = ?
        AND deleted_at IS NULL
    `,
    [organizationId],
  );
  const templateMap = new Map(existingRows.map((row) => [String(row.code || "").toUpperCase(), row]));
  const templateDefinitions = [
    { code: "DEMO-OFFICE", defaultSiteId: siteMap["DEMO-HQ"]?.id || null, name: "내근 일정", trackType: "FIXED" },
    { code: "DEMO-FIELD", defaultSiteId: siteMap["DEMO-FIELD"]?.id || null, name: "외근 일정", trackType: "FIXED" },
    { code: "DEMO-BUSINESS", defaultSiteId: siteMap["DEMO-BRANCH"]?.id || null, name: "사업 일정", trackType: "FIXED" },
    { code: "DEMO-HOLIDAY", defaultSiteId: null, name: "휴일 일정", trackType: "FIXED" },
  ];

  for (const definition of templateDefinitions) {
    let template = templateMap.get(definition.code);

    if (!template) {
      const templateId = generateId();
      await connection.query(
        `
          INSERT INTO schedule_templates (
            id, organization_id, work_policy_id, code, name, track_type, effective_from, effective_to,
            cross_midnight, next_day_cutoff_time, default_site_id, status
          )
          VALUES (?, ?, ?, ?, ?, ?, CURDATE(), NULL, 0, '04:00:00', ?, 'ACTIVE')
        `,
        [templateId, organizationId, workPolicyId, definition.code, definition.name, definition.trackType, definition.defaultSiteId],
      );
      template = { ...definition, id: templateId };
      templateMap.set(definition.code, template);
    }

    const [dayRows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM schedule_template_days
        WHERE schedule_template_id = ?
      `,
      [template.id],
    );

    if (Number(dayRows[0]?.count || 0) > 0) {
      continue;
    }

    const dayRules = buildTemplateDayRules(definition.code);
    for (const dayRule of dayRules) {
      await connection.query(
        `
          INSERT INTO schedule_template_days (
            id, schedule_template_id, day_of_week, is_working_day, start_time, end_time, break_minutes,
            late_grace_minutes, early_leave_grace_minutes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          generateId(),
          template.id,
          dayRule.dayOfWeek,
          dayRule.isWorkingDay,
          dayRule.startTime,
          dayRule.endTime,
          dayRule.breakMinutes,
          dayRule.lateGraceMinutes,
          dayRule.earlyLeaveGraceMinutes,
        ],
      );
    }
  }

  return Object.fromEntries(templateDefinitions.map((definition) => [definition.code, templateMap.get(definition.code)]));
}

async function ensureDemoUsers(connection, organization, workPolicyId, unitList, siteMap, desiredCount) {
  const queryRunner = connection.query.bind(connection);
  await ensureSystemRoles(queryRunner);
  const employeeRoleId = await requireSystemRoleId(queryRunner, SYSTEM_ROLE_CODES.EMPLOYEE);
  const emailPrefix = `demo.${String(organization.code || "").trim().toLowerCase()}.`;
  const [existingRows] = await connection.query(
    `
      SELECT
        id,
        employee_no AS employeeNo,
        login_email AS loginEmail,
        name,
        primary_unit_id AS primaryUnitId,
        default_site_id AS defaultSiteId
      FROM users
      WHERE organization_id = ?
        AND login_email LIKE ?
        AND deleted_at IS NULL
      ORDER BY employee_no
    `,
    [organization.id, `${emailPrefix}%`],
  );

  const currentCount = existingRows.length;

  if (currentCount < desiredCount) {
    const passwordHash = hashPassword("Passw0rd!");

    for (let index = currentCount; index < desiredCount; index += 1) {
      const unit = unitList[index % unitList.length];
      const defaultSiteCode = index % 3 === 0 ? "DEMO-HQ" : index % 3 === 1 ? "DEMO-BRANCH" : "DEMO-FIELD";
      const defaultSite = siteMap[defaultSiteCode] || siteMap["DEMO-HQ"];
      const userId = generateId();
      const serial = String(index + 1).padStart(3, "0");
      const employeeNo = `D${String(index + 1).padStart(4, "0")}`;
      const loginEmail = `${emailPrefix}${serial}@workmate.local`;
      const name = buildDisplayName(index);
      const phone = `010-${String(7000 + index).padStart(4, "0")}-${String(1000 + index).padStart(4, "0")}`;
      const joinDay = String((index % 20) + 1).padStart(2, "0");
      const joinDate = `2026-03-${joinDay}`;

      await connection.query(
        `
          INSERT INTO users (
            id, organization_id, employee_no, login_email, password_hash, name, phone, employment_status,
            employment_type, join_date, timezone, primary_unit_id, default_site_id, track_type, work_policy_id,
            manager_user_id, metadata_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'FULL_TIME', ?, 'Asia/Seoul', ?, ?, 'FIXED', ?, NULL,
            JSON_OBJECT('source', 'demo-workforce', 'demoWorkforce', true))
        `,
        [
          userId,
          organization.id,
          employeeNo,
          loginEmail,
          passwordHash,
          name,
          phone,
          joinDate,
          unit.id,
          defaultSite?.id || null,
          workPolicyId,
        ],
      );

      await connection.query(
        `
          INSERT INTO user_roles (id, organization_id, user_id, role_id, scope_type, scope_id)
          VALUES (?, ?, ?, ?, 'self', NULL)
        `,
        [generateId(), organization.id, userId, employeeRoleId],
      );
    }
  }

  const [demoUsers] = await connection.query(
    `
      SELECT
        id,
        employee_no AS employeeNo,
        login_email AS loginEmail,
        name,
        primary_unit_id AS primaryUnitId,
        default_site_id AS defaultSiteId
      FROM users
      WHERE organization_id = ?
        AND login_email LIKE ?
        AND deleted_at IS NULL
      ORDER BY employee_no
    `,
    [organization.id, `${emailPrefix}%`],
  );

  for (let index = 0; index < demoUsers.length; index += 1) {
    const name = buildDisplayName(index);

    await connection.query(
      `
        UPDATE users
        SET name = ?,
          metadata_json = JSON_SET(
          COALESCE(metadata_json, JSON_OBJECT()),
          '$.source', 'demo-workforce',
          '$.demoWorkforce', true
        )
        WHERE id = ?
      `,
      [name, demoUsers[index].id],
    );
    demoUsers[index].name = name;
  }

  return demoUsers;
}

async function ensureLeaveBalances(connection, organizationId, demoUsers, leaveTypeMap, balanceYear) {
  const targetTypes = [
    { code: "ANNUAL", getAccrued: (index) => 15 + (index % 4), getOpening: (index) => index % 5 === 0 ? 2 : index % 7 === 0 ? 1 : 0, getUsed: (index) => 1 + (index % 7) },
    { code: "COMP", getAccrued: (index) => 2 + ((index % 5) * 0.5), getOpening: (index) => index % 6 === 0 ? 1 : 0, getUsed: (index) => (index % 4) * 0.5 },
    { code: "OTHER", getAccrued: (index) => 3 + (index % 3), getOpening: (index) => index % 8 === 0 ? 0.5 : 0, getUsed: (index) => index % 2 },
  ];
  let upsertedCount = 0;

  for (let index = 0; index < demoUsers.length; index += 1) {
    const user = demoUsers[index];

    for (const type of targetTypes) {
      const leaveType = leaveTypeMap[type.code];

      if (!leaveType?.id) {
        continue;
      }

      const openingBalance = Number(type.getOpening(index).toFixed(2));
      const accruedAmount = Number(type.getAccrued(index).toFixed(2));
      const usedAmount = Math.min(accruedAmount, Number(type.getUsed(index).toFixed(2)));
      const remainingAmount = Number((openingBalance + accruedAmount - usedAmount).toFixed(2));

      await connection.query(
        `
          INSERT INTO leave_balances (
            id, organization_id, user_id, leave_type_id, balance_year, opening_balance, accrued_amount,
            used_amount, remaining_amount
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            opening_balance = VALUES(opening_balance),
            accrued_amount = VALUES(accrued_amount),
            used_amount = VALUES(used_amount),
            remaining_amount = VALUES(remaining_amount)
        `,
        [
          generateId(),
          organizationId,
          user.id,
          leaveType.id,
          balanceYear,
          openingBalance,
          accruedAmount,
          usedAmount,
          remainingAmount,
        ],
      );
      upsertedCount += 1;
    }
  }

  return upsertedCount;
}

module.exports = {
  ensureDemoUsers,
  ensureLeaveBalances,
  ensureLeaveTypes,
  ensureRootUnit,
  ensureScheduleTemplates,
  ensureSites,
  ensureUnits,
  getDefaultWorkPolicy,
  getTargetOrganization,
};
