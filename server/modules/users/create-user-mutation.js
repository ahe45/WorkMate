const { getCurrentDateKey } = require("../common/date");
const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");
const { normalizeInviteChannels } = require("../common/normalizers");
const { SYSTEM_ROLE_CODES } = require("../common/system-roles");
const {
  buildDisplayName,
  buildJoinRequestStatus,
  buildUserMetadata,
  normalizeAssignableRoleCode,
  normalizeDateOnlyValue,
  normalizeSubmissionMode,
  resolveCreateEmploymentStatus,
  sanitizePersonnelCard,
  splitDisplayName,
} = require("./user-normalizers");

function createUserCreateMutation({
  assertRequiredUserFields,
  assertWorkspaceLoginEmailAvailable,
  getJobTitleSummary,
  joinInvitationsService,
  listUsers,
  mapUserMutationError,
  replaceUserRole,
  resolveUserAccountBinding,
  withTransaction,
}) {
  return async function createUser(organizationId, payload = {}, options = {}) {
    const submissionMode = normalizeSubmissionMode(payload.submissionMode);
    const createdUserId = await withTransaction(async (connection) => {
      const payloadNameParts = splitDisplayName(payload.name);
      const firstName = String(payload.firstName || "").trim() || payloadNameParts.firstName;
      const lastName = String(payload.lastName || "").trim() || payloadNameParts.lastName;
      const loginEmail = String(payload.loginEmail || "").trim().toLowerCase();
      const employeeNo = String(payload.employeeNo || "").trim()
        || (submissionMode === "DRAFT" ? `E${generateId().replace(/-/g, "").slice(0, 8).toUpperCase()}` : "");
      const name = buildDisplayName({
        firstName,
        lastName,
        name: payload.name,
      }) || (submissionMode === "DRAFT" ? `임시 저장-${employeeNo}` : "");
      const primaryUnitId = String(payload.primaryUnitId || "").trim();
      const workPolicyId = String(payload.workPolicyId || "").trim();
      const joinDate = normalizeDateOnlyValue(payload.joinDate) || getCurrentDateKey();
      const hasRequestedRoleCode = Object.prototype.hasOwnProperty.call(payload, "roleCode")
        && String(payload.roleCode || "").trim() !== "";
      const requestedRoleCode = normalizeAssignableRoleCode(payload.roleCode);
      const roleCode = requestedRoleCode || (submissionMode === "STANDARD" ? SYSTEM_ROLE_CODES.EMPLOYEE : "");
      const inviteChannels = normalizeInviteChannels(payload.inviteChannels || []);
      const employmentStatus = resolveCreateEmploymentStatus(submissionMode, payload.employmentStatus);
      const requestedJobTitleId = String(payload.jobTitleId || "").trim();
      const jobTitleSummary = await getJobTitleSummary(connection, organizationId, requestedJobTitleId);
      const jobTitleId = String(jobTitleSummary?.id || "").trim();
      const retireDate = normalizeDateOnlyValue(payload.retireDate) || null;
      const note = String(payload.note || "").trim();
      const personnelCard = sanitizePersonnelCard(payload.personnelCard);
      const joinRequestStatus = buildJoinRequestStatus(employmentStatus);

      if (hasRequestedRoleCode && !requestedRoleCode) {
        throw createHttpError(400, "선택할 수 없는 권한입니다.", "USER_CREATE_ROLE_UNSUPPORTED");
      }

      if (requestedJobTitleId && !jobTitleSummary) {
        throw createHttpError(400, "선택할 수 없는 직급입니다.", "USER_CREATE_JOB_TITLE_UNSUPPORTED");
      }

      if (!employeeNo || (submissionMode !== "DRAFT" && !name)) {
        throw createHttpError(400, "필수 사용자 필드가 누락되었습니다.", "USER_CREATE_INVALID");
      }

      if (submissionMode !== "DRAFT") {
        assertRequiredUserFields({
          employeeNo,
          firstName,
          inviteChannels,
          jobTitleId,
          joinDate,
          lastName,
          loginEmail,
          name,
          phone: String(payload.phone || "").trim(),
          primaryUnitId,
          roleCode,
          workPolicyId,
        }, {
          errorPrefix: "USER_CREATE",
          requireInviteChannels: submissionMode === "INVITED",
        });
      }

      if (loginEmail) {
        await assertWorkspaceLoginEmailAvailable(connection, organizationId, loginEmail);
      }

      const accountBinding = await resolveUserAccountBinding(connection, {
        loginEmail,
      });
      const id = generateId();
      const passwordHash = String(accountBinding.account?.passwordHash || "").trim() || null;
      const metadata = buildUserMetadata({}, payload);

      await connection.query(
        `
          INSERT INTO users (
            id, organization_id, account_id, employee_no, login_email, password_hash, name, first_name, last_name, phone,
            employment_status, employment_type, join_date, retire_date, timezone, primary_unit_id, job_title_id,
            default_site_id, track_type, work_policy_id, manager_user_id, note, personnel_card_json,
            invite_channels_json, join_request_status, metadata_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          organizationId,
          accountBinding.account?.id || null,
          employeeNo,
          String(accountBinding.account?.loginEmail || loginEmail || "").trim() || null,
          passwordHash,
          name,
          firstName || null,
          lastName || null,
          payload.phone || null,
          employmentStatus,
          payload.employmentType || "FULL_TIME",
          joinDate,
          retireDate,
          payload.timezone || "Asia/Seoul",
          primaryUnitId || null,
          jobTitleId || null,
          payload.defaultSiteId || null,
          payload.trackType || "FIXED",
          workPolicyId || null,
          payload.managerUserId || null,
          note || null,
          personnelCard ? JSON.stringify(personnelCard) : null,
          inviteChannels.length > 0 ? JSON.stringify(inviteChannels) : null,
          joinRequestStatus,
          JSON.stringify(metadata),
        ],
      );

      if (roleCode || payload.roleId) {
        await replaceUserRole(connection, organizationId, id, roleCode, payload.roleId);
      }

      if (submissionMode === "INVITED") {
        await joinInvitationsService?.issueInvitationWithConnection(connection, {
          actorUserId: String(options.actorUserId || "").trim(),
          inviteChannels,
          organizationId,
          request: options.request || null,
          resetPassword: true,
          userId: id,
        });
      }

      return id;
    }).catch(mapUserMutationError);

    return (await listUsers(organizationId)).find((user) => String(user?.id || "") === String(createdUserId)) || null;
  };
}

module.exports = {
  createUserCreateMutation,
};
