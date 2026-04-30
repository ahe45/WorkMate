const {
  normalizeInviteChannels,
  parseJsonValue,
} = require("../common/normalizers");
const { SYSTEM_ROLE_CODES } = require("../common/system-roles");

const USER_MANAGEMENT_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  DRAFT: "DRAFT",
  EXPIRED: "EXPIRED",
  INACTIVE: "INACTIVE",
  INVITED: "INVITED",
  PENDING: "PENDING",
  RETIRED: "RETIRED",
});

const USER_JOIN_REQUEST_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  EXPIRED: "EXPIRED",
  JOINED: "JOINED",
  PENDING: "PENDING",
  REQUESTED: "REQUESTED",
});

const ASSIGNABLE_USER_ROLE_CODES = new Set([
  SYSTEM_ROLE_CODES.EMPLOYEE,
  SYSTEM_ROLE_CODES.ORG_ADMIN,
  SYSTEM_ROLE_CODES.SYSTEM_ADMIN,
]);

function parseMetadata(metadataJson) {
  return parseJsonValue(metadataJson, {});
}

function parseJsonArrayValue(value) {
  const parsedValue = parseMetadata(value);
  return Array.isArray(parsedValue) ? parsedValue : [];
}

function parseJsonObjectValue(value) {
  const parsedValue = parseMetadata(value);
  return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue) ? parsedValue : null;
}

function normalizeSubmissionMode(value = "") {
  const normalizedValue = String(value || "").trim().toUpperCase();

  if (["DRAFT", "TEMP", "TEMPORARY"].includes(normalizedValue)) {
    return "DRAFT";
  }

  if (["INVITE", "INVITED", "REQUEST", "REQUESTED", "JOIN_REQUEST"].includes(normalizedValue)) {
    return "INVITED";
  }

  return "STANDARD";
}

function normalizeEmploymentStatus(value = "") {
  const normalizedValue = String(value || "").trim().toUpperCase();
  return Object.values(USER_MANAGEMENT_STATUS).includes(normalizedValue)
    ? normalizedValue
    : "";
}

function normalizeJoinRequestStatus(value = "") {
  const normalizedValue = String(value || "").trim().toUpperCase();
  return Object.values(USER_JOIN_REQUEST_STATUS).includes(normalizedValue)
    ? normalizedValue
    : "";
}

function normalizeDateOnlyValue(value = "") {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }

  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return normalizedValue;
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return normalizedValue;
  }

  return [
    parsedDate.getFullYear(),
    String(parsedDate.getMonth() + 1).padStart(2, "0"),
    String(parsedDate.getDate()).padStart(2, "0"),
  ].join("-");
}

function normalizeRoleCode(value = "") {
  const normalizedValue = String(value || "").trim().toUpperCase();

  if (!normalizedValue) {
    return "";
  }

  return Object.values(SYSTEM_ROLE_CODES).includes(normalizedValue)
    ? normalizedValue
    : "";
}

function normalizeAssignableRoleCode(value = "") {
  const roleCode = normalizeRoleCode(value);
  return ASSIGNABLE_USER_ROLE_CODES.has(roleCode) ? roleCode : "";
}

function buildDisplayName(payload = {}) {
  const rawName = String(payload.name || "").trim();

  if (rawName) {
    return rawName;
  }

  const lastName = String(payload.lastName || "").trim();
  const firstName = String(payload.firstName || "").trim();

  if (lastName && firstName) {
    return `${lastName}${firstName}`;
  }

  return lastName || firstName;
}

function splitDisplayName(name = "") {
  const normalizedName = String(name || "").trim();

  if (!normalizedName) {
    return { firstName: "", lastName: "" };
  }

  const parts = normalizedName.split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    return {
      firstName: parts.slice(1).join(" "),
      lastName: parts[0] || "",
    };
  }

  if (normalizedName.length > 1) {
    return {
      firstName: normalizedName.slice(1),
      lastName: normalizedName.slice(0, 1),
    };
  }

  return {
    firstName: "",
    lastName: normalizedName,
  };
}

function sanitizePersonnelCard(card = null) {
  if (!card || typeof card !== "object") {
    return null;
  }

  const name = String(card.name || "").trim();
  const type = String(card.type || "").trim();
  const dataUrl = typeof card.dataUrl === "string" ? String(card.dataUrl || "") : "";
  const size = Math.max(0, Number(card.size || 0) || 0);

  if (!name && !dataUrl) {
    return null;
  }

  return {
    dataUrl,
    name,
    size,
    type,
  };
}

function isJoinInvitationExpired(source = {}) {
  if (!source || typeof source !== "object") {
    return false;
  }

  if (source.latestInvitationConsumedAt || source.latestInvitationRevokedAt) {
    return false;
  }

  const expiresAt = source.latestInvitationExpiresAt || source.invitationExpiresAt || source.expiresAt;

  if (!expiresAt) {
    return false;
  }

  const expiresAtTime = new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtTime) && expiresAtTime <= Date.now();
}

function buildJoinRequestStatus(employmentStatus = "", source = {}) {
  const normalizedEmploymentStatus = normalizeEmploymentStatus(employmentStatus);
  const normalizedStoredStatus = normalizeJoinRequestStatus(
    typeof source === "string" ? source : source?.joinRequestStatus,
  );

  if (normalizedEmploymentStatus === USER_MANAGEMENT_STATUS.ACTIVE) {
    return USER_JOIN_REQUEST_STATUS.JOINED;
  }

  if (normalizedStoredStatus === USER_JOIN_REQUEST_STATUS.EXPIRED) {
    return USER_JOIN_REQUEST_STATUS.EXPIRED;
  }

  if (
    (normalizedEmploymentStatus === USER_MANAGEMENT_STATUS.INVITED || normalizedStoredStatus === USER_JOIN_REQUEST_STATUS.REQUESTED)
    && isJoinInvitationExpired(source)
  ) {
    return USER_JOIN_REQUEST_STATUS.EXPIRED;
  }

  if (normalizedEmploymentStatus === USER_MANAGEMENT_STATUS.INVITED || normalizedStoredStatus === USER_JOIN_REQUEST_STATUS.REQUESTED) {
    return USER_JOIN_REQUEST_STATUS.REQUESTED;
  }

  if (normalizedEmploymentStatus === USER_MANAGEMENT_STATUS.PENDING || normalizedStoredStatus === USER_JOIN_REQUEST_STATUS.PENDING) {
    return USER_JOIN_REQUEST_STATUS.PENDING;
  }

  return USER_JOIN_REQUEST_STATUS.DRAFT;
}

function buildManagementStatus(employmentStatus = "", metadata = {}) {
  const normalizedEmploymentStatus = normalizeEmploymentStatus(employmentStatus);

  if (normalizedEmploymentStatus === USER_MANAGEMENT_STATUS.ACTIVE) {
    return USER_MANAGEMENT_STATUS.ACTIVE;
  }

  if (normalizedEmploymentStatus === USER_MANAGEMENT_STATUS.RETIRED) {
    return USER_MANAGEMENT_STATUS.RETIRED;
  }

  if (normalizedEmploymentStatus === USER_MANAGEMENT_STATUS.INACTIVE) {
    return USER_MANAGEMENT_STATUS.INACTIVE;
  }

  if (normalizedEmploymentStatus === USER_MANAGEMENT_STATUS.EXPIRED || buildJoinRequestStatus(normalizedEmploymentStatus, metadata) === USER_JOIN_REQUEST_STATUS.EXPIRED) {
    return USER_MANAGEMENT_STATUS.EXPIRED;
  }

  if (normalizedEmploymentStatus === USER_MANAGEMENT_STATUS.INVITED || buildJoinRequestStatus(normalizedEmploymentStatus, metadata) === USER_JOIN_REQUEST_STATUS.REQUESTED) {
    return USER_MANAGEMENT_STATUS.INVITED;
  }

  if (normalizedEmploymentStatus === USER_MANAGEMENT_STATUS.PENDING || buildJoinRequestStatus(normalizedEmploymentStatus, metadata) === USER_JOIN_REQUEST_STATUS.PENDING) {
    return USER_MANAGEMENT_STATUS.PENDING;
  }

  return USER_MANAGEMENT_STATUS.DRAFT;
}

function resolveCreateEmploymentStatus(submissionMode = "STANDARD", requestedEmploymentStatus = "") {
  const normalizedSubmissionMode = normalizeSubmissionMode(submissionMode);
  const normalizedRequestedStatus = normalizeEmploymentStatus(requestedEmploymentStatus);

  if (normalizedSubmissionMode === "DRAFT") {
    return USER_MANAGEMENT_STATUS.DRAFT;
  }

  if (normalizedSubmissionMode === "INVITED") {
    return USER_MANAGEMENT_STATUS.INVITED;
  }

  if ([
    USER_MANAGEMENT_STATUS.ACTIVE,
    USER_MANAGEMENT_STATUS.INACTIVE,
    USER_MANAGEMENT_STATUS.PENDING,
    USER_MANAGEMENT_STATUS.RETIRED,
  ].includes(normalizedRequestedStatus)) {
    return normalizedRequestedStatus;
  }

  return USER_MANAGEMENT_STATUS.PENDING;
}

function resolveUpdateEmploymentStatus({
  existingEmploymentStatus = "",
  requestedEmploymentStatus = "",
  submissionMode = "STANDARD",
} = {}) {
  const normalizedSubmissionMode = normalizeSubmissionMode(submissionMode);
  const normalizedExistingStatus = normalizeEmploymentStatus(existingEmploymentStatus);
  const normalizedRequestedStatus = normalizeEmploymentStatus(requestedEmploymentStatus);

  if (normalizedSubmissionMode === "DRAFT") {
    return USER_MANAGEMENT_STATUS.DRAFT;
  }

  if (normalizedSubmissionMode === "INVITED") {
    return USER_MANAGEMENT_STATUS.INVITED;
  }

  if ([
    USER_MANAGEMENT_STATUS.ACTIVE,
    USER_MANAGEMENT_STATUS.INACTIVE,
    USER_MANAGEMENT_STATUS.INVITED,
    USER_MANAGEMENT_STATUS.PENDING,
    USER_MANAGEMENT_STATUS.RETIRED,
  ].includes(normalizedRequestedStatus)) {
    return normalizedRequestedStatus;
  }

  if ([
    USER_MANAGEMENT_STATUS.ACTIVE,
    USER_MANAGEMENT_STATUS.INACTIVE,
    USER_MANAGEMENT_STATUS.INVITED,
    USER_MANAGEMENT_STATUS.PENDING,
    USER_MANAGEMENT_STATUS.RETIRED,
  ].includes(normalizedExistingStatus)) {
    return normalizedExistingStatus;
  }

  return USER_MANAGEMENT_STATUS.PENDING;
}

function buildUserMetadata(existingMetadata = {}, payload = {}) {
  const nextMetadata = {
    ...existingMetadata,
    source: String(existingMetadata.source || payload.source || "admin").trim() || "admin",
  };
  [
    "firstName",
    "lastName",
    "jobTitleId",
    "jobTitleName",
    "jobTitle",
    "rank",
    "position",
    "note",
    "personnelCard",
    "retireDate",
    "inviteChannels",
    "joinRequestStatus",
    "roleCode",
  ].forEach((key) => {
    delete nextMetadata[key];
  });

  return nextMetadata;
}

function mapUserRow(row = {}, roleCodesByUserId = new Map()) {
  const metadata = parseMetadata(row.metadataJson);
  const roleCodes = roleCodesByUserId.get(String(row.id || "").trim()) || [];
  const storedInviteChannels = parseJsonArrayValue(row.inviteChannelsJson);
  const roleCode = normalizeRoleCode(roleCodes[0] || (row.organizationId ? "" : metadata.roleCode) || SYSTEM_ROLE_CODES.EMPLOYEE) || SYSTEM_ROLE_CODES.EMPLOYEE;
  const inviteChannels = normalizeInviteChannels(storedInviteChannels.length > 0 ? storedInviteChannels : metadata.inviteChannels || []);
  const joinRequestStatus = buildJoinRequestStatus(row.employmentStatus, {
    joinRequestStatus: row.joinRequestStatus || metadata.joinRequestStatus || "",
    latestInvitationConsumedAt: row.latestInvitationConsumedAt,
    latestInvitationExpiresAt: row.latestInvitationExpiresAt,
    latestInvitationRevokedAt: row.latestInvitationRevokedAt,
  });
  const managementStatus = buildManagementStatus(row.employmentStatus, { joinRequestStatus });

  return {
    ...row,
    firstName: String(row.firstName || metadata.firstName || "").trim(),
    inviteChannels,
    jobTitle: String(row.jobTitleName || metadata.jobTitleName || metadata.jobTitle || metadata.rank || metadata.position || "").trim(),
    jobTitleId: String(row.jobTitleId || metadata.jobTitleId || "").trim(),
    joinDate: normalizeDateOnlyValue(row.joinDate),
    joinRequestStatus,
    lastName: String(row.lastName || metadata.lastName || "").trim(),
    managementStatus,
    note: String(row.note || metadata.note || "").trim(),
    personnelCard: sanitizePersonnelCard(parseJsonObjectValue(row.personnelCardJson) || metadata.personnelCard),
    retireDate: normalizeDateOnlyValue(row.retireDate || metadata.retireDate),
    roleCode,
    roleCodes: roleCodes.length > 0 ? roleCodes : [roleCode],
    workPolicyName: String(row.workPolicyName || "").trim(),
  };
}

module.exports = {
  ASSIGNABLE_USER_ROLE_CODES,
  USER_JOIN_REQUEST_STATUS,
  USER_MANAGEMENT_STATUS,
  buildDisplayName,
  buildJoinRequestStatus,
  buildManagementStatus,
  buildUserMetadata,
  isJoinInvitationExpired,
  mapUserRow,
  normalizeAssignableRoleCode,
  normalizeDateOnlyValue,
  normalizeEmploymentStatus,
  normalizeJoinRequestStatus,
  normalizeRoleCode,
  normalizeSubmissionMode,
  parseJsonArrayValue,
  parseJsonObjectValue,
  parseMetadata,
  resolveCreateEmploymentStatus,
  resolveUpdateEmploymentStatus,
  sanitizePersonnelCard,
  splitDisplayName,
};
