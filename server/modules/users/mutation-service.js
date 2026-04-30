const { createHttpError } = require("../common/http-error");
const { normalizeInviteChannels } = require("../common/normalizers");
const { createUserCreateMutation } = require("./create-user-mutation");
const { createUserDeleteMutation } = require("./delete-user-mutation");
const { createUserMutationHelpers } = require("./mutation-helpers");
const {
  USER_MANAGEMENT_STATUS,
  buildDisplayName,
  buildJoinRequestStatus,
  buildUserMetadata,
  normalizeAssignableRoleCode,
  normalizeDateOnlyValue,
  normalizeEmploymentStatus,
  normalizeSubmissionMode,
  parseJsonArrayValue,
  parseJsonObjectValue,
  parseMetadata,
  resolveUpdateEmploymentStatus,
  sanitizePersonnelCard,
  splitDisplayName,
} = require("./user-normalizers");

function createUserMutationService({
  accountsService,
  joinInvitationsService,
  listUsers,
  query,
  withTransaction,
}) {
  const {
    assertRequiredUserFields,
    assertWorkspaceLoginEmailAvailable,
    cleanupStaleAccount,
    getJobTitleSummary,
    loadCurrentUserRoleCode,
    mapUserMutationError,
    replaceUserRole,
    resolveUserAccountBinding,
  } = createUserMutationHelpers({ accountsService });

  const createUser = createUserCreateMutation({
    assertRequiredUserFields,
    assertWorkspaceLoginEmailAvailable,
    getJobTitleSummary,
    joinInvitationsService,
    listUsers,
    mapUserMutationError,
    replaceUserRole,
    resolveUserAccountBinding,
    withTransaction,
  });

  async function updateUser(organizationId, userId, payload = {}, options = {}) {
    const existingUsers = await query(
      `
        SELECT id
        FROM users
        WHERE id = :userId
          AND (:organizationId IS NULL OR organization_id = :organizationId)
          AND deleted_at IS NULL
      `,
      { organizationId: organizationId || null, userId },
    );

    if (!existingUsers[0]) {
      throw createHttpError(404, "사용자를 찾을 수 없습니다.", "USER_NOT_FOUND");
    }

    const submissionMode = normalizeSubmissionMode(payload.submissionMode);
    await withTransaction(async (connection) => {
      const [existingRows] = await connection.query(
        `
          SELECT
            id,
            account_id AS accountId,
            employee_no AS employeeNo,
            name,
            login_email AS loginEmail,
            password_hash AS passwordHash,
            phone,
            employment_status AS employmentStatus,
            join_date AS joinDate,
            retire_date AS retireDate,
            primary_unit_id AS primaryUnitId,
            job_title_id AS jobTitleId,
            default_site_id AS defaultSiteId,
            track_type AS trackType,
            work_policy_id AS workPolicyId,
            manager_user_id AS managerUserId,
            first_name AS firstName,
            last_name AS lastName,
            note,
            personnel_card_json AS personnelCardJson,
            invite_channels_json AS inviteChannelsJson,
            join_request_status AS joinRequestStatus,
            metadata_json AS metadataJson
          FROM users
          WHERE organization_id = ?
            AND id = ?
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [organizationId, userId],
      );
      const existingUser = existingRows[0] || null;

      if (!existingUser) {
        throw createHttpError(404, "사용자를 찾을 수 없습니다.", "USER_NOT_FOUND");
      }

      const existingMetadata = parseMetadata(existingUser.metadataJson);
      const hasPayloadName = Object.prototype.hasOwnProperty.call(payload, "name");
      const payloadNameParts = hasPayloadName ? splitDisplayName(payload.name) : { firstName: "", lastName: "" };
      const firstName = Object.prototype.hasOwnProperty.call(payload, "firstName")
        ? (String(payload.firstName || "").trim() || payloadNameParts.firstName)
        : hasPayloadName
          ? payloadNameParts.firstName
          : String(existingUser.firstName || existingMetadata.firstName || "").trim();
      const lastName = Object.prototype.hasOwnProperty.call(payload, "lastName")
        ? (String(payload.lastName || "").trim() || payloadNameParts.lastName)
        : hasPayloadName
          ? payloadNameParts.lastName
          : String(existingUser.lastName || existingMetadata.lastName || "").trim();
      const name = buildDisplayName({
        firstName,
        lastName,
        name: hasPayloadName ? payload.name : existingUser.name,
      }) || String(existingUser.name || "").trim();
      const employeeNo = Object.prototype.hasOwnProperty.call(payload, "employeeNo")
        ? String(payload.employeeNo || "").trim()
        : String(existingUser.employeeNo || "").trim();
      const loginEmail = Object.prototype.hasOwnProperty.call(payload, "loginEmail")
        ? String(payload.loginEmail || "").trim().toLowerCase()
        : String(existingUser.loginEmail || "").trim().toLowerCase();
      const primaryUnitId = Object.prototype.hasOwnProperty.call(payload, "primaryUnitId")
        ? String(payload.primaryUnitId || "").trim()
        : String(existingUser.primaryUnitId || "").trim();
      const workPolicyId = Object.prototype.hasOwnProperty.call(payload, "workPolicyId")
        ? String(payload.workPolicyId || "").trim()
        : String(existingUser.workPolicyId || "").trim();
      const joinDate = Object.prototype.hasOwnProperty.call(payload, "joinDate")
        ? (normalizeDateOnlyValue(payload.joinDate) || getCurrentDateKey())
        : normalizeDateOnlyValue(existingUser.joinDate);
      const hasRequestedRoleCode = Object.prototype.hasOwnProperty.call(payload, "roleCode");
      const requestedRoleCodeValue = hasRequestedRoleCode ? String(payload.roleCode || "").trim() : "";
      const requestedRoleCode = hasRequestedRoleCode ? normalizeAssignableRoleCode(payload.roleCode) : "";
      const roleCode = hasRequestedRoleCode
        ? requestedRoleCode
        : await loadCurrentUserRoleCode(connection, organizationId, userId);
      const inviteChannels = Object.prototype.hasOwnProperty.call(payload, "inviteChannels")
        ? normalizeInviteChannels(payload.inviteChannels)
        : normalizeInviteChannels(parseJsonArrayValue(existingUser.inviteChannelsJson).length > 0
          ? parseJsonArrayValue(existingUser.inviteChannelsJson)
          : existingMetadata.inviteChannels || []);
      const employmentStatus = resolveUpdateEmploymentStatus({
        existingEmploymentStatus: existingUser.employmentStatus,
        requestedEmploymentStatus: payload.employmentStatus,
        submissionMode,
      });
      const jobTitleId = Object.prototype.hasOwnProperty.call(payload, "jobTitleId")
        ? String(payload.jobTitleId || "").trim()
        : String(existingUser.jobTitleId || existingMetadata.jobTitleId || "").trim();
      const jobTitleSummary = await getJobTitleSummary(connection, organizationId, jobTitleId);
      const normalizedJobTitleId = String(jobTitleSummary?.id || "").trim();
      const retireDate = Object.prototype.hasOwnProperty.call(payload, "retireDate")
        ? (normalizeDateOnlyValue(payload.retireDate) || null)
        : (normalizeDateOnlyValue(existingUser.retireDate || existingMetadata.retireDate) || null);
      const note = Object.prototype.hasOwnProperty.call(payload, "note")
        ? String(payload.note || "").trim()
        : String(existingUser.note || existingMetadata.note || "").trim();
      const personnelCard = sanitizePersonnelCard(Object.prototype.hasOwnProperty.call(payload, "personnelCard")
        ? payload.personnelCard
        : parseJsonObjectValue(existingUser.personnelCardJson) || existingMetadata.personnelCard);
      const joinRequestStatus = buildJoinRequestStatus(employmentStatus, existingUser.joinRequestStatus || existingMetadata.joinRequestStatus || "");

      if (hasRequestedRoleCode && requestedRoleCodeValue && !requestedRoleCode) {
        throw createHttpError(400, "선택할 수 없는 권한입니다.", "USER_UPDATE_ROLE_UNSUPPORTED");
      }

      if (jobTitleId && !jobTitleSummary) {
        throw createHttpError(400, "선택할 수 없는 직급입니다.", "USER_UPDATE_JOB_TITLE_UNSUPPORTED");
      }

      if (submissionMode !== "DRAFT") {
        assertRequiredUserFields({
          employeeNo,
          firstName,
          inviteChannels,
          jobTitleId: normalizedJobTitleId,
          joinDate,
          lastName,
          loginEmail,
          name,
          phone: Object.prototype.hasOwnProperty.call(payload, "phone")
            ? String(payload.phone || "").trim()
            : String(existingUser.phone || "").trim(),
          primaryUnitId,
          roleCode,
          workPolicyId,
        }, {
          errorPrefix: "USER_UPDATE",
          requireInviteChannels: submissionMode === "INVITED",
        });
      }

      if (submissionMode === "INVITED" && normalizeEmploymentStatus(existingUser.employmentStatus) === USER_MANAGEMENT_STATUS.ACTIVE) {
        throw createHttpError(400, "이미 합류한 직원은 저장 버튼으로만 수정할 수 있습니다.", "USER_UPDATE_ALREADY_JOINED");
      }

      if (loginEmail) {
        await assertWorkspaceLoginEmailAvailable(connection, organizationId, loginEmail, { excludedUserId: userId });
      }

      const accountBinding = await resolveUserAccountBinding(connection, {
        currentAccountId: existingUser.accountId,
        loginEmail,
      });
      const nextAccountId = accountBinding.shouldDetach ? null : (accountBinding.account?.id || null);
      const nextLoginEmail = accountBinding.shouldDetach
        ? null
        : (String(accountBinding.account?.loginEmail || loginEmail || "").trim() || null);
      const nextPasswordHash = accountBinding.shouldDetach
        ? null
        : (String(accountBinding.account?.passwordHash || "").trim() || null);
      const metadata = buildUserMetadata(existingMetadata, payload);

      await connection.query(
        `
          UPDATE users
          SET
            account_id = ?,
            employee_no = ?,
            name = ?,
            login_email = ?,
            password_hash = ?,
            first_name = ?,
            last_name = ?,
            phone = ?,
            employment_status = ?,
            join_date = ?,
            retire_date = ?,
            primary_unit_id = ?,
            job_title_id = ?,
            default_site_id = ?,
            track_type = ?,
            work_policy_id = ?,
            manager_user_id = ?,
            note = ?,
            personnel_card_json = ?,
            invite_channels_json = ?,
            join_request_status = ?,
            metadata_json = ?
          WHERE organization_id = ?
            AND id = ?
        `,
        [
          nextAccountId,
          employeeNo || existingUser.employeeNo,
          name,
          nextLoginEmail,
          nextPasswordHash,
          firstName || null,
          lastName || null,
          Object.prototype.hasOwnProperty.call(payload, "phone") ? (payload.phone || null) : existingUser.phone,
          employmentStatus,
          joinDate,
          retireDate,
          primaryUnitId || null,
          normalizedJobTitleId || null,
          Object.prototype.hasOwnProperty.call(payload, "defaultSiteId") ? (payload.defaultSiteId || null) : existingUser.defaultSiteId,
          Object.prototype.hasOwnProperty.call(payload, "trackType") ? (payload.trackType || null) : existingUser.trackType,
          workPolicyId || null,
          Object.prototype.hasOwnProperty.call(payload, "managerUserId") ? (payload.managerUserId || null) : existingUser.managerUserId,
          note || null,
          personnelCard ? JSON.stringify(personnelCard) : null,
          inviteChannels.length > 0 ? JSON.stringify(inviteChannels) : null,
          joinRequestStatus,
          JSON.stringify(metadata),
          organizationId,
          userId,
        ],
      );

      if (Object.prototype.hasOwnProperty.call(payload, "roleCode") || Object.prototype.hasOwnProperty.call(payload, "roleId")) {
        await replaceUserRole(connection, organizationId, userId, roleCode, payload.roleId);
      }

      if (accountBinding.staleAccountId) {
        await cleanupStaleAccount(connection, accountBinding.staleAccountId);
      }

      if (submissionMode === "INVITED") {
        await joinInvitationsService?.issueInvitationWithConnection(connection, {
          actorUserId: String(options.actorUserId || "").trim(),
          inviteChannels,
          organizationId,
          request: options.request || null,
          resetPassword: String(existingUser.employmentStatus || "").trim().toUpperCase() !== USER_MANAGEMENT_STATUS.ACTIVE,
          userId,
        });
      }
    }).catch(mapUserMutationError);

    return (await listUsers(organizationId)).find((user) => String(user?.id || "") === String(userId)) || null;
  }

  const deleteUser = createUserDeleteMutation({
    mapUserMutationError,
    withTransaction,
  });

  return Object.freeze({
    createUser,
    deleteUser,
    updateUser,
  });
}

module.exports = {
  createUserMutationService,
};
