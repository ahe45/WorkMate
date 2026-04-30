const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");
const { buildLeavePolicyCode } = require("./leave-utils");
const {
  ensureDefaultLeaveType,
  fetchLeaveGroupById,
} = require("./store");

function createLeaveGroupCommands({ withTransaction }) {
  if (typeof withTransaction !== "function") {
    throw new Error("createLeaveGroupCommands requires withTransaction dependency.");
  }

  async function createLeaveGroup(organizationId, payload = {}) {
    const normalizedOrganizationId = String(organizationId || "").trim();
    const name = String(payload.name || "").trim();
    const parentLeaveGroupId = String(payload.parentLeaveGroupId || "").trim() || null;
    const negativeLimitDays = Math.max(0, Number(payload.negativeLimitDays || 0) || 0);
    const description = String(payload.description || "").trim();

    if (!normalizedOrganizationId) {
      throw createHttpError(400, "회사 정보를 찾을 수 없습니다.", "ORGANIZATION_REQUIRED");
    }

    if (!name) {
      throw createHttpError(400, "휴가정책명을 입력하세요.", "LEAVE_GROUP_NAME_REQUIRED");
    }

    return withTransaction(async (connection) => {
      const leaveGroupId = generateId();
      const code = buildLeavePolicyCode(leaveGroupId);
      let normalizedParentLeaveGroupId = null;

      if (parentLeaveGroupId) {
        const [parentRows] = await connection.query(
          `
            SELECT id
            FROM leave_groups
            WHERE organization_id = ?
              AND id = ?
              AND deleted_at IS NULL
              AND status = 'ACTIVE'
            LIMIT 1
          `,
          [normalizedOrganizationId, parentLeaveGroupId],
        );

        if (!parentRows[0]) {
          throw createHttpError(404, "상위 휴가정책을 찾을 수 없습니다.", "LEAVE_PARENT_GROUP_NOT_FOUND");
        }

        normalizedParentLeaveGroupId = parentRows[0].id;
      }

      await connection.query(
        `
          INSERT INTO leave_groups (id, organization_id, parent_leave_group_id, code, name, negative_limit_days, description, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        `,
        [leaveGroupId, normalizedOrganizationId, normalizedParentLeaveGroupId, code, name, negativeLimitDays, description || null],
      );

      await ensureDefaultLeaveType(connection, normalizedOrganizationId, {
        code,
        id: leaveGroupId,
        name,
      });

      return {
        childCount: 0,
        code,
        description,
        id: leaveGroupId,
        name,
        negativeLimitDays,
        parentLeaveGroupId: normalizedParentLeaveGroupId,
        status: "ACTIVE",
      };
    });
  }

  async function updateLeaveGroup(organizationId, leaveGroupId, payload = {}) {
    const normalizedOrganizationId = String(organizationId || "").trim();
    const normalizedLeaveGroupId = String(leaveGroupId || "").trim();
    const name = String(payload.name || "").trim();
    const parentLeaveGroupId = String(payload.parentLeaveGroupId || "").trim() || null;
    const negativeLimitDays = Math.max(0, Number(payload.negativeLimitDays || 0) || 0);
    const description = String(payload.description || "").trim();

    if (!normalizedOrganizationId || !normalizedLeaveGroupId) {
      throw createHttpError(400, "휴가정책을 찾을 수 없습니다.", "LEAVE_GROUP_REQUIRED");
    }

    if (!name) {
      throw createHttpError(400, "휴가정책명을 입력하세요.", "LEAVE_GROUP_NAME_REQUIRED");
    }

    return withTransaction(async (connection) => {
      const targetGroup = await fetchLeaveGroupById(connection, normalizedOrganizationId, normalizedLeaveGroupId);

      if (!targetGroup || targetGroup.status !== "ACTIVE") {
        throw createHttpError(404, "휴가정책을 찾을 수 없습니다.", "LEAVE_GROUP_NOT_FOUND");
      }

      let normalizedParentLeaveGroupId = null;

      if (parentLeaveGroupId) {
        if (parentLeaveGroupId === normalizedLeaveGroupId) {
          throw createHttpError(400, "휴가정책 자신을 상위 정책으로 지정할 수 없습니다.", "LEAVE_GROUP_PARENT_SELF");
        }

        let parentGroup = await fetchLeaveGroupById(connection, normalizedOrganizationId, parentLeaveGroupId);

        if (!parentGroup || parentGroup.status !== "ACTIVE") {
          throw createHttpError(404, "상위 휴가정책을 찾을 수 없습니다.", "LEAVE_PARENT_GROUP_NOT_FOUND");
        }

        let guard = 0;

        while (parentGroup && guard < 20) {
          const nextParentId = String(parentGroup.parentLeaveGroupId || "").trim();

          if (nextParentId === normalizedLeaveGroupId) {
            throw createHttpError(400, "하위 휴가정책 아래로 이동할 수 없습니다.", "LEAVE_GROUP_PARENT_CYCLE");
          }

          parentGroup = nextParentId
            ? await fetchLeaveGroupById(connection, normalizedOrganizationId, nextParentId)
            : null;
          guard += 1;
        }

        normalizedParentLeaveGroupId = parentLeaveGroupId;
      }

      await connection.query(
        `
          UPDATE leave_groups
          SET
            parent_leave_group_id = ?,
            name = ?,
            negative_limit_days = ?,
            description = ?,
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE organization_id = ?
            AND id = ?
            AND deleted_at IS NULL
        `,
        [
          normalizedParentLeaveGroupId,
          name,
          negativeLimitDays,
          description || null,
          normalizedOrganizationId,
          normalizedLeaveGroupId,
        ],
      );

      await connection.query(
        `
          UPDATE leave_types
          SET
            name = ?,
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE organization_id = ?
            AND leave_group_id = ?
            AND status = 'ACTIVE'
        `,
        [name, normalizedOrganizationId, normalizedLeaveGroupId],
      );

      return fetchLeaveGroupById(connection, normalizedOrganizationId, normalizedLeaveGroupId);
    });
  }

  async function deleteLeaveGroup(organizationId, leaveGroupId) {
    const normalizedOrganizationId = String(organizationId || "").trim();
    const normalizedLeaveGroupId = String(leaveGroupId || "").trim();

    if (!normalizedOrganizationId || !normalizedLeaveGroupId) {
      throw createHttpError(400, "삭제할 휴가정책을 찾을 수 없습니다.", "LEAVE_GROUP_REQUIRED");
    }

    return withTransaction(async (connection) => {
      const targetGroup = await fetchLeaveGroupById(connection, normalizedOrganizationId, normalizedLeaveGroupId);

      if (!targetGroup || targetGroup.status !== "ACTIVE") {
        throw createHttpError(404, "휴가정책을 찾을 수 없습니다.", "LEAVE_GROUP_NOT_FOUND");
      }

      const [usageRows] = await connection.query(
        `
          SELECT
            (
              SELECT COUNT(*)
              FROM leave_groups child_lg
              WHERE child_lg.organization_id = ?
                AND child_lg.parent_leave_group_id = ?
                AND child_lg.deleted_at IS NULL
                AND child_lg.status = 'ACTIVE'
            ) AS childCount,
            (
              SELECT COUNT(*)
              FROM leave_accrual_rules lar
              WHERE lar.organization_id = ?
                AND lar.leave_group_id = ?
                AND lar.deleted_at IS NULL
            ) AS ruleCount,
            (
              SELECT COUNT(*)
              FROM leave_accrual_entries lae
              WHERE lae.organization_id = ?
                AND lae.leave_group_id = ?
            ) AS accrualEntryCount,
            (
              SELECT COUNT(*)
              FROM leave_balances lb
              INNER JOIN leave_types lt
                ON lt.id = lb.leave_type_id
              WHERE lb.organization_id = ?
                AND lt.leave_group_id = ?
            ) AS balanceCount,
            (
              SELECT COUNT(*)
              FROM leave_requests lr
              INNER JOIN leave_types lt
                ON lt.id = lr.leave_type_id
              WHERE lr.organization_id = ?
                AND lt.leave_group_id = ?
                AND lr.cancelled_at IS NULL
            ) AS requestCount
        `,
        [
          normalizedOrganizationId,
          normalizedLeaveGroupId,
          normalizedOrganizationId,
          normalizedLeaveGroupId,
          normalizedOrganizationId,
          normalizedLeaveGroupId,
          normalizedOrganizationId,
          normalizedLeaveGroupId,
          normalizedOrganizationId,
          normalizedLeaveGroupId,
        ],
      );
      const usage = usageRows[0] || {};

      if (Number(usage.childCount || 0) > 0) {
        throw createHttpError(409, "하위 휴가정책이 남아 있어 삭제할 수 없습니다.", "LEAVE_GROUP_DELETE_HAS_CHILDREN");
      }

      if (Number(usage.ruleCount || 0) > 0) {
        throw createHttpError(409, "휴가 발생 규칙이 연결된 정책은 삭제할 수 없습니다.", "LEAVE_GROUP_DELETE_HAS_RULES");
      }

      if (Number(usage.accrualEntryCount || 0) > 0 || Number(usage.balanceCount || 0) > 0) {
        throw createHttpError(409, "휴가 부여 또는 잔여 이력이 있는 정책은 삭제할 수 없습니다.", "LEAVE_GROUP_DELETE_HAS_ACCRUALS");
      }

      if (Number(usage.requestCount || 0) > 0) {
        throw createHttpError(409, "휴가 신청 이력이 있는 정책은 삭제할 수 없습니다.", "LEAVE_GROUP_DELETE_HAS_REQUESTS");
      }

      await connection.query(
        `
          UPDATE leave_groups
          SET
            status = 'INACTIVE',
            deleted_at = CURRENT_TIMESTAMP(3),
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE organization_id = ?
            AND id = ?
            AND deleted_at IS NULL
        `,
        [normalizedOrganizationId, normalizedLeaveGroupId],
      );

      await connection.query(
        `
          UPDATE leave_types
          SET
            status = 'INACTIVE',
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE organization_id = ?
            AND leave_group_id = ?
        `,
        [normalizedOrganizationId, normalizedLeaveGroupId],
      );

      return {
        deleted: true,
        id: normalizedLeaveGroupId,
      };
    });
  }

  return {
    createLeaveGroup,
    deleteLeaveGroup,
    updateLeaveGroup,
  };
}

module.exports = {
  createLeaveGroupCommands,
};
