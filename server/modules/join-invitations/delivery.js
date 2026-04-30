const nodemailer = require("nodemailer");

const { createHttpError } = require("../common/http-error");

const WORKSPACE_JOIN_INVITE_TTL_MINUTES = 30;
const WORKSPACE_JOIN_INVITE_TTL_MS = WORKSPACE_JOIN_INVITE_TTL_MINUTES * 60 * 1000;
const WORKSPACE_JOIN_INVITE_DELIVERY_STATUSES = Object.freeze({
  FAILED: "FAILED",
  PENDING: "PENDING",
  SENT: "SENT",
});
const RESERVED_EMAIL_DOMAINS = Object.freeze([
  "example.com",
  "example.net",
  "example.org",
  "workmate.local",
]);
const RESERVED_EMAIL_SUFFIXES = Object.freeze([
  ".example",
  ".invalid",
  ".local",
  ".localhost",
  ".test",
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatInvitationExpirationLabel(expiresAt) {
  if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
    return "";
  }

  return `${expiresAt.getFullYear()}-${String(expiresAt.getMonth() + 1).padStart(2, "0")}-${String(expiresAt.getDate()).padStart(2, "0")} ${String(expiresAt.getHours()).padStart(2, "0")}:${String(expiresAt.getMinutes()).padStart(2, "0")}`;
}

function normalizeInviteToken(inviteToken = "") {
  return String(inviteToken || "").trim();
}

function shouldSuppressWorkspaceInviteEmail(email = "") {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const [, domain = ""] = normalizedEmail.split("@");

  if (!domain) {
    return false;
  }

  return (
    RESERVED_EMAIL_DOMAINS.includes(domain)
    || RESERVED_EMAIL_SUFFIXES.some((suffix) => domain.endsWith(suffix))
  );
}

function resolveWorkspaceAppBaseUrl(request) {
  const configuredBaseUrl = String(process.env.WORKMATE_APP_BASE_URL || process.env.APP_BASE_URL || "").trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/g, "");
  }

  const forwardedProto = String(request?.headers?.["x-forwarded-proto"] || "").split(",")[0].trim();
  const forwardedHost = String(request?.headers?.["x-forwarded-host"] || "").split(",")[0].trim();
  const requestHost = forwardedHost || String(request?.headers?.host || "").trim() || `localhost:${Number(process.env.PORT) || 3001}`;
  const protocol = forwardedProto || (request?.socket?.encrypted ? "https" : "http");

  return `${protocol}://${requestHost}`.replace(/\/+$/g, "");
}

function buildWorkspaceJoinInviteUrl(request, inviteToken) {
  const baseUrl = resolveWorkspaceAppBaseUrl(request);
  const url = new URL("/join-invite", `${baseUrl}/`);

  url.searchParams.set("joinInvite", inviteToken);
  return url.toString();
}

function buildWorkspaceInviteRedirectPath(organizationCode = "") {
  const normalizedOrganizationCode = String(organizationCode || "").trim().toUpperCase();

  if (!normalizedOrganizationCode) {
    return "/companies";
  }

  return `/companies/${encodeURIComponent(normalizedOrganizationCode)}/workspace`;
}

function createWorkspaceInviteEmailSender() {
  const smtpHost = String(process.env.SMTP_HOST || "").trim();
  const smtpPort = Math.round(Number(process.env.SMTP_PORT));
  const smtpUser = String(process.env.SMTP_USER || "").trim();
  const smtpPass = String(process.env.SMTP_PASS || "").trim();
  const smtpFrom = String(process.env.SMTP_FROM || "").trim();
  const smtpFromName = String(process.env.SMTP_FROM_NAME || "WorkMate").trim();
  const smtpSecure = String(process.env.SMTP_SECURE || "").trim().toLowerCase() === "true";
  const smtpTlsRejectUnauthorized = String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "").trim().toLowerCase() !== "false";
  const inviteMailSubject = String(
    process.env.WORKMATE_INVITE_EMAIL_SUBJECT
    || process.env.APPLICANT_VERIFICATION_EMAIL_SUBJECT
    || "[WorkMate] 워크스페이스 합류 요청 안내",
  ).trim();
  const transporter = smtpHost && Number.isFinite(smtpPort) && smtpPort > 0 && smtpFrom
    ? nodemailer.createTransport({
      auth: smtpUser || smtpPass ? { pass: smtpPass, user: smtpUser } : undefined,
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      tls: {
        rejectUnauthorized: smtpTlsRejectUnauthorized,
      },
    })
    : null;
  let transporterVerificationPromise = null;

  async function verifyTransporterAvailability() {
    if (!transporter) {
      throw createHttpError(
        503,
        "이메일 발송 설정이 완료되지 않았습니다. SMTP_HOST, SMTP_PORT, SMTP_FROM 값을 확인하세요.",
        "WORKSPACE_JOIN_INVITE_NOT_CONFIGURED",
      );
    }

    if (!transporterVerificationPromise) {
      transporterVerificationPromise = transporter.verify().catch((error) => {
        transporterVerificationPromise = null;
        throw error;
      });
    }

    try {
      await transporterVerificationPromise;
    } catch (error) {
      console.error(`Workspace invite mail transport verification failed: ${error.message}`);
      throw createHttpError(
        503,
        "이메일 발송 설정을 확인할 수 없습니다. SMTP 서버 주소와 계정 정보를 점검하세요.",
        "WORKSPACE_JOIN_INVITE_NOT_AVAILABLE",
      );
    }
  }

  return async ({
    email = "",
    expiresAt = null,
    inviteUrl = "",
    loginEmail = "",
    organizationName = "",
    recipientName = "",
    temporaryPassword = "",
  }) => {
    const expirationLabel = formatInvitationExpirationLabel(expiresAt);
    const normalizedRecipientName = String(recipientName || "").trim() || "구성원";
    const normalizedOrganizationName = String(organizationName || "").trim() || "WorkMate";
    const normalizedInviteUrl = String(inviteUrl || "").trim();
    const normalizedLoginEmail = String(loginEmail || "").trim().toLowerCase();
    const normalizedTemporaryPassword = String(temporaryPassword || "").trim();
    const textLines = [
      `${normalizedRecipientName}님, ${normalizedOrganizationName} 워크스페이스 합류 요청이 도착했습니다.`,
      "아래 링크를 열고 로그인하면 해당 워크스페이스에 합류됩니다.",
      normalizedInviteUrl ? `합류 링크: ${normalizedInviteUrl}` : "",
      normalizedLoginEmail ? `로그인 이메일: ${normalizedLoginEmail}` : "",
      normalizedTemporaryPassword ? `임시 비밀번호: ${normalizedTemporaryPassword}` : "",
      `링크 유효시간: ${WORKSPACE_JOIN_INVITE_TTL_MINUTES}분`,
      expirationLabel ? `만료 시각: ${expirationLabel}` : "",
      "초대 메일을 다시 발송하면 이전 링크는 즉시 폐기됩니다.",
      "이 메일은 WorkMate에서 발송되었습니다.",
    ].filter(Boolean);

    if (shouldSuppressWorkspaceInviteEmail(email)) {
      return {
        deliveryMode: "suppressed",
        deliveryStatus: WORKSPACE_JOIN_INVITE_DELIVERY_STATUSES.SENT,
        messageId: `suppressed:${Date.now()}`,
      };
    }

    await verifyTransporterAvailability();

    try {
      const sendResult = await transporter.sendMail({
        from: `"${smtpFromName}" <${smtpFrom}>`,
        html: `
          <div style="font-family:'Noto Sans KR',sans-serif;color:#152033;line-height:1.7;">
            <p><strong>${escapeHtml(normalizedRecipientName)}</strong>님, <strong>${escapeHtml(normalizedOrganizationName)}</strong> 워크스페이스 합류 요청이 도착했습니다.</p>
            <p>아래 링크를 열고 로그인하면 해당 워크스페이스에 합류됩니다.</p>
            ${normalizedInviteUrl ? `<p><a href="${escapeHtml(normalizedInviteUrl)}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#173a6a;color:#ffffff;text-decoration:none;font-weight:700;">합류 링크 열기</a></p>` : ""}
            ${normalizedInviteUrl ? `<p style="word-break:break-all;">${escapeHtml(normalizedInviteUrl)}</p>` : ""}
            ${normalizedLoginEmail ? `<p>로그인 이메일: <strong>${escapeHtml(normalizedLoginEmail)}</strong></p>` : ""}
            ${normalizedTemporaryPassword ? `<p>임시 비밀번호: <strong>${escapeHtml(normalizedTemporaryPassword)}</strong></p>` : ""}
            <p>링크 유효시간: <strong>${escapeHtml(String(WORKSPACE_JOIN_INVITE_TTL_MINUTES))}분</strong></p>
            ${expirationLabel ? `<p>만료 시각: <strong>${escapeHtml(expirationLabel)}</strong></p>` : ""}
            <p>초대 메일을 다시 발송하면 이전 링크는 즉시 폐기됩니다.</p>
            <p>이 메일은 WorkMate에서 발송되었습니다.</p>
          </div>
        `,
        subject: inviteMailSubject || "[WorkMate] 워크스페이스 합류 요청 안내",
        text: textLines.join("\n"),
        to: email,
      });

      return {
        deliveryMode: "smtp",
        deliveryStatus: WORKSPACE_JOIN_INVITE_DELIVERY_STATUSES.SENT,
        messageId: String(sendResult?.messageId || "").trim(),
      };
    } catch (error) {
      console.error(`Workspace invite mail send failed: ${error.message}`);
      throw createHttpError(
        502,
        "합류 요청 메일을 발송하지 못했습니다. SMTP 서버 연결과 계정 정보를 확인하세요.",
        "WORKSPACE_JOIN_INVITE_SEND_FAILED",
      );
    }
  };
}

function createWorkspaceInviteSmsSender() {
  const webhookUrl = String(process.env.WORKMATE_INVITE_SMS_WEBHOOK_URL || "").trim();
  const webhookToken = String(process.env.WORKMATE_INVITE_SMS_WEBHOOK_TOKEN || "").trim();

  return async ({
    expiresAt = null,
    inviteUrl = "",
    loginEmail = "",
    phone = "",
    recipientName = "",
    temporaryPassword = "",
  } = {}) => {
    const normalizedPhone = String(phone || "").trim();
    const normalizedInviteUrl = String(inviteUrl || "").trim();
    const normalizedLoginEmail = String(loginEmail || "").trim().toLowerCase();
    const normalizedTemporaryPassword = String(temporaryPassword || "").trim();
    const expirationLabel = formatInvitationExpirationLabel(expiresAt);
    const textLines = [
      `${String(recipientName || "").trim() || "구성원"}님, WorkMate 합류 요청이 도착했습니다.`,
      normalizedInviteUrl ? `합류 링크: ${normalizedInviteUrl}` : "",
      normalizedLoginEmail ? `로그인 이메일: ${normalizedLoginEmail}` : "",
      normalizedTemporaryPassword ? `임시 비밀번호: ${normalizedTemporaryPassword}` : "",
      `유효시간: ${WORKSPACE_JOIN_INVITE_TTL_MINUTES}분`,
      expirationLabel ? `만료 시각: ${expirationLabel}` : "",
    ].filter(Boolean);

    if (!webhookUrl) {
      throw createHttpError(
        503,
        "문자 발송 설정이 완료되지 않았습니다. WORKMATE_INVITE_SMS_WEBHOOK_URL 값을 확인하세요.",
        "WORKSPACE_JOIN_INVITE_SMS_NOT_CONFIGURED",
      );
    }

    if (typeof fetch !== "function") {
      throw createHttpError(503, "현재 Node.js 런타임에서 문자 발송 요청을 처리할 수 없습니다.", "WORKSPACE_JOIN_INVITE_SMS_UNAVAILABLE");
    }

    const response = await fetch(webhookUrl, {
      body: JSON.stringify({
        expiresAt: expiresAt instanceof Date ? expiresAt.toISOString() : null,
        inviteUrl: normalizedInviteUrl,
        loginEmail: normalizedLoginEmail,
        message: textLines.join("\n"),
        phone: normalizedPhone,
        temporaryPassword: normalizedTemporaryPassword,
      }),
      headers: {
        "Content-Type": "application/json",
        ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
      },
      method: "POST",
    });

    if (!response.ok) {
      throw createHttpError(
        502,
        "문자 발송 요청이 실패했습니다. 문자 발송 웹훅 설정을 확인하세요.",
        "WORKSPACE_JOIN_INVITE_SMS_SEND_FAILED",
      );
    }

    return {
      deliveryMode: "sms-webhook",
      deliveryStatus: WORKSPACE_JOIN_INVITE_DELIVERY_STATUSES.SENT,
      messageId: response.headers.get("x-message-id") || `sms:${Date.now()}`,
    };
  };
}

module.exports = {
  WORKSPACE_JOIN_INVITE_DELIVERY_STATUSES,
  WORKSPACE_JOIN_INVITE_TTL_MINUTES,
  WORKSPACE_JOIN_INVITE_TTL_MS,
  buildWorkspaceInviteRedirectPath,
  buildWorkspaceJoinInviteUrl,
  createWorkspaceInviteEmailSender,
  createWorkspaceInviteSmsSender,
  normalizeInviteToken,
};
