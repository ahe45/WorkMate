const { randomBytes } = require("crypto");

const { recordAuditLog } = require("../common/audit-log");
const { createHttpError } = require("../common/http-error");
const { generateId, sha256 } = require("../common/ids");
const { normalizeInviteChannels, parseJsonValue } = require("../common/normalizers");
const {
  WORKSPACE_JOIN_INVITE_DELIVERY_STATUSES,
  WORKSPACE_JOIN_INVITE_TTL_MINUTES,
  WORKSPACE_JOIN_INVITE_TTL_MS,
  buildWorkspaceInviteRedirectPath,
  buildWorkspaceJoinInviteUrl,
  createWorkspaceInviteEmailSender,
  createWorkspaceInviteSmsSender,
} = require("./delivery");
const {
  assertInvitationExpectedIdentity,
  assertInvitationUsable,
  buildInvitationContext,
  loadInvitationRecord,
  loadInvitationTarget,
  normalizeInvitationLoginEmail,
} = require("./invitation-records");

function createJoinInvitationsService({ accountsService, withTransaction }) {
  if (!accountsService || typeof withTransaction !== "function") {
    throw new Error("createJoinInvitationsService requires invitation service dependencies.");
  }

  const dispatchWorkspaceInviteEmail = createWorkspaceInviteEmailSender();
  const dispatchWorkspaceInviteSms = createWorkspaceInviteSmsSender();

  async function issueInvitationWithConnection(connection, {
    actorUserId = "",
    inviteChannels = [],
    organizationId = "",
    request = null,
    resetPassword = false,
    userId = "",
  } = {}) {
    const queryRunner = connection.query.bind(connection);
    const target = await loadInvitationTarget(queryRunner, organizationId, userId);
    const normalizedInviteChannels = normalizeInviteChannels(inviteChannels);

    if (!target) {
      throw createHttpError(404, "합류 요청을 보낼 사용자를 찾을 수 없습니다.", "WORKSPACE_JOIN_INVITE_USER_NOT_FOUND");
    }

    if (String(target.employmentStatus || "").trim().toUpperCase() === "ACTIVE") {
      throw createHttpError(400, "이미 합류한 직원에게는 합류 요청을 다시 보낼 수 없습니다.", "WORKSPACE_JOIN_INVITE_ALREADY_JOINED");
    }

    if (normalizedInviteChannels.length === 0) {
      throw createHttpError(400, "합류 요청 전송 방식을 선택하세요.", "WORKSPACE_JOIN_INVITE_CHANNEL_REQUIRED");
    }

    if (!String(target.loginEmail || "").trim()) {
      throw createHttpError(400, "합류 요청을 보내려면 이메일이 필요합니다.", "WORKSPACE_JOIN_INVITE_EMAIL_REQUIRED");
    }

    if (normalizedInviteChannels.includes("SMS") && !String(target.phone || "").trim()) {
      throw createHttpError(400, "합류 요청 문자를 보내려면 전화번호가 필요합니다.", "WORKSPACE_JOIN_INVITE_SMS_PHONE_REQUIRED");
    }

    const invitationId = generateId();
    const inviteToken = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + WORKSPACE_JOIN_INVITE_TTL_MS);
    const inviteUrl = buildWorkspaceJoinInviteUrl(request, inviteToken);
    const temporaryPassword = "";
    const normalizedLoginEmail = normalizeInvitationLoginEmail(accountsService, target.loginEmail);
    const temporaryPasswordIssued = false;

    await connection.query(
      `
        UPDATE user_join_invitations
        SET
          revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3)),
          replaced_by_invitation_id = ?
        WHERE organization_id = ?
          AND user_id = ?
          AND consumed_at IS NULL
          AND revoked_at IS NULL
      `,
      [invitationId, organizationId, userId],
    );

    await connection.query(
      `
        INSERT INTO user_join_invitations (
          id,
          organization_id,
          user_id,
          created_by_user_id,
          invite_token_hash,
          invite_channels_json,
          delivery_status,
          expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        invitationId,
        organizationId,
        userId,
        String(actorUserId || "").trim() || null,
        sha256(inviteToken),
        JSON.stringify(normalizedInviteChannels),
        WORKSPACE_JOIN_INVITE_DELIVERY_STATUSES.PENDING,
        expiresAt,
      ],
    );

    try {
      const sendResults = [];

      if (normalizedInviteChannels.includes("EMAIL")) {
        sendResults.push(await dispatchWorkspaceInviteEmail({
          email: normalizedLoginEmail,
          expiresAt,
          inviteUrl,
          loginEmail: normalizedLoginEmail,
          organizationName: target.organizationName,
          recipientName: target.userName,
          temporaryPassword,
        }));
      }

      if (normalizedInviteChannels.includes("SMS")) {
        sendResults.push(await dispatchWorkspaceInviteSms({
          expiresAt,
          inviteUrl,
          loginEmail: normalizedLoginEmail,
          phone: target.phone,
          recipientName: target.userName,
          temporaryPassword,
        }));
      }

      const deliveryStatus = sendResults.some((sendResult) => String(sendResult?.deliveryStatus || "").trim().toUpperCase() === WORKSPACE_JOIN_INVITE_DELIVERY_STATUSES.FAILED)
        ? WORKSPACE_JOIN_INVITE_DELIVERY_STATUSES.FAILED
        : WORKSPACE_JOIN_INVITE_DELIVERY_STATUSES.SENT;
      const deliveryMode = sendResults
        .map((sendResult) => String(sendResult?.deliveryMode || "").trim())
        .filter(Boolean)
        .join("+") || "unknown";
      const deliveryMessageId = sendResults
        .map((sendResult) => String(sendResult?.messageId || "").trim())
        .filter(Boolean)
        .join(",")
        .slice(0, 255);

      await connection.query(
        `
          UPDATE user_join_invitations
          SET
            delivery_status = ?,
            delivery_mode = ?,
            delivery_message_id = ?,
            sent_at = CASE WHEN ? = ? THEN NOW() ELSE sent_at END,
            failed_at = CASE WHEN ? = ? THEN NOW() ELSE NULL END,
            delivery_error = ''
          WHERE id = ?
        `,
        [
          deliveryStatus,
          deliveryMode,
          deliveryMessageId || null,
          deliveryStatus,
          WORKSPACE_JOIN_INVITE_DELIVERY_STATUSES.SENT,
          deliveryStatus,
          WORKSPACE_JOIN_INVITE_DELIVERY_STATUSES.FAILED,
          invitationId,
        ],
      );

      await recordAuditLog(queryRunner, {
        action: "user.join_invitation.issue",
        actorUserId: actorUserId || null,
        entityId: invitationId,
        entityType: "user_join_invitation",
        metadataJson: {
          deliveryMode,
          expiresAt: expiresAt.toISOString(),
          inviteChannels: normalizedInviteChannels,
          inviteUrl,
          temporaryPasswordIssued,
          userId,
        },
        organizationId,
      });

      return {
        deliveryMode,
        expiresAt,
        inviteUrl,
        invitationId,
        temporaryPasswordIssued,
      };
    } catch (error) {
      const normalizedError = error?.statusCode && error?.code
        ? error
        : createHttpError(
          error?.statusCode || 502,
          String(error?.message || "합류 요청 메일을 발송하지 못했습니다. 잠시 후 다시 시도하세요."),
          String(error?.code || "WORKSPACE_JOIN_INVITE_SEND_FAILED"),
        );

      await connection.query(
        `
          UPDATE user_join_invitations
          SET
            delivery_status = ?,
            failed_at = NOW(),
            delivery_error = ?
          WHERE id = ?
        `,
        [
          WORKSPACE_JOIN_INVITE_DELIVERY_STATUSES.FAILED,
          String(normalizedError.message || "합류 요청 메일 발송 실패").trim().slice(0, 500),
          invitationId,
        ],
      ).catch(() => {});

      throw normalizedError;
    }
  }

  async function acceptInvitationInConnection(connection, {
    actorAccountId = "",
    actorUserId = "",
    expectedAccountId = "",
    expectedLoginEmail = "",
    expectedUserId = "",
    inviteToken = "",
    request = null,
  } = {}) {
    const queryRunner = connection.query.bind(connection);
    const invitation = await loadInvitationRecord(queryRunner, inviteToken);

    assertInvitationUsable(invitation);

    const { normalizedExpectedAccountId } = assertInvitationExpectedIdentity(invitation, {
      expectedAccountId,
      expectedLoginEmail,
      expectedUserId,
    });

    const normalizedEmploymentStatus = String(invitation.employmentStatus || "").trim().toUpperCase();

    if (["INACTIVE", "RETIRED"].includes(normalizedEmploymentStatus)) {
      throw createHttpError(403, "현재 상태에서는 합류 요청을 완료할 수 없습니다.", "WORKSPACE_JOIN_INVITE_USER_INACTIVE");
    }

    if (!String(invitation.accountId || "").trim() && normalizedExpectedAccountId) {
      await accountsService.attachUserToAccount(connection, invitation.userId, normalizedExpectedAccountId);
    }

    await connection.query(
      `
        UPDATE users
        SET
          employment_status = 'ACTIVE',
          join_request_status = 'JOINED',
          updated_at = CURRENT_TIMESTAMP(3)
        WHERE organization_id = ?
          AND id = ?
          AND deleted_at IS NULL
      `,
      [invitation.organizationId, invitation.userId],
    );
    await connection.query(
      `
        UPDATE user_join_invitations
        SET consumed_at = COALESCE(consumed_at, UTC_TIMESTAMP(3))
        WHERE id = ?
      `,
      [invitation.id],
    );
    await connection.query(
      `
        UPDATE user_join_invitations
        SET
          revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3)),
          replaced_by_invitation_id = COALESCE(replaced_by_invitation_id, ?)
        WHERE organization_id = ?
          AND user_id = ?
          AND id <> ?
          AND consumed_at IS NULL
          AND revoked_at IS NULL
      `,
      [invitation.id, invitation.organizationId, invitation.userId, invitation.id],
    );

    await recordAuditLog(queryRunner, {
      action: "user.join_invitation.accept",
      actorUserId: actorUserId || invitation.userId || null,
      entityId: invitation.id,
      entityType: "user_join_invitation",
      metadataJson: {
        accountId: normalizedExpectedAccountId || String(invitation.accountId || "").trim() || null,
        actorAccountId: String(actorAccountId || "").trim() || null,
        inviteChannels: normalizeInviteChannels(parseJsonValue(invitation.inviteChannelsJson)),
        inviteTokenAccepted: true,
        requestHost: String(request?.headers?.host || "").trim(),
        userId: invitation.userId,
      },
      organizationId: invitation.organizationId,
    });

    return {
      invitationId: invitation.id,
      organizationCode: String(invitation.organizationCode || "").trim().toUpperCase(),
      organizationId: invitation.organizationId,
      organizationName: String(invitation.organizationName || "").trim(),
      redirectPath: buildWorkspaceInviteRedirectPath(invitation.organizationCode),
      userId: invitation.userId,
    };
  }

  async function acceptInvitationForLogin(options = {}) {
    return withTransaction(async (connection) => acceptInvitationInConnection(connection, options));
  }

  async function rejectInvitationInConnection(connection, {
    actorAccountId = "",
    actorUserId = "",
    expectedAccountId = "",
    expectedLoginEmail = "",
    expectedUserId = "",
    inviteToken = "",
    request = null,
  } = {}) {
    const queryRunner = connection.query.bind(connection);
    const invitation = await loadInvitationRecord(queryRunner, inviteToken);

    assertInvitationUsable(invitation);

    const { normalizedExpectedAccountId } = assertInvitationExpectedIdentity(invitation, {
      expectedAccountId,
      expectedLoginEmail,
      expectedUserId,
    });

    const normalizedEmploymentStatus = String(invitation.employmentStatus || "").trim().toUpperCase();

    if (normalizedEmploymentStatus === "ACTIVE") {
      throw createHttpError(400, "이미 합류가 완료된 요청입니다.", "WORKSPACE_JOIN_INVITE_ALREADY_JOINED");
    }

    if (!["INACTIVE", "RETIRED"].includes(normalizedEmploymentStatus)) {
      await connection.query(
        `
          UPDATE users
          SET
            employment_status = 'PENDING',
            join_request_status = 'PENDING',
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE organization_id = ?
            AND id = ?
            AND deleted_at IS NULL
        `,
        [invitation.organizationId, invitation.userId],
      );
    }

    await connection.query(
      `
        UPDATE user_join_invitations
        SET consumed_at = COALESCE(consumed_at, UTC_TIMESTAMP(3))
        WHERE id = ?
      `,
      [invitation.id],
    );
    await connection.query(
      `
        UPDATE user_join_invitations
        SET
          revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3)),
          replaced_by_invitation_id = COALESCE(replaced_by_invitation_id, ?)
        WHERE organization_id = ?
          AND user_id = ?
          AND id <> ?
          AND consumed_at IS NULL
          AND revoked_at IS NULL
      `,
      [invitation.id, invitation.organizationId, invitation.userId, invitation.id],
    );

    await recordAuditLog(queryRunner, {
      action: "user.join_invitation.reject",
      actorUserId: actorUserId || invitation.userId || null,
      entityId: invitation.id,
      entityType: "user_join_invitation",
      metadataJson: {
        accountId: normalizedExpectedAccountId || String(invitation.accountId || "").trim() || null,
        actorAccountId: String(actorAccountId || "").trim() || null,
        inviteChannels: normalizeInviteChannels(parseJsonValue(invitation.inviteChannelsJson)),
        inviteTokenRejected: true,
        requestHost: String(request?.headers?.host || "").trim(),
        userId: invitation.userId,
      },
      organizationId: invitation.organizationId,
    });

    return {
      invitationId: invitation.id,
      organizationCode: String(invitation.organizationCode || "").trim().toUpperCase(),
      organizationId: invitation.organizationId,
      organizationName: String(invitation.organizationName || "").trim(),
      redirectPath: "/companies",
      userId: invitation.userId,
    };
  }

  async function rejectInvitationForLogin(options = {}) {
    return withTransaction(async (connection) => rejectInvitationInConnection(connection, options));
  }

  async function getInvitationContext({ inviteToken = "" } = {}) {
    return withTransaction(async (connection) => buildInvitationContext({
      accountsService,
      inviteToken,
      queryRunner: connection.query.bind(connection),
    }));
  }

  return Object.freeze({
    acceptInvitationForLogin,
    getInvitationContext,
    issueInvitationWithConnection,
    rejectInvitationForLogin,
  });
}

module.exports = {
  WORKSPACE_JOIN_INVITE_TTL_MINUTES,
  createJoinInvitationsService,
};
