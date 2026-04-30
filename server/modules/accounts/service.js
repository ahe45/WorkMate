const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");
const { normalizeLoginEmail } = require("../common/normalizers");

function createAccountsService({ hashPassword, query }) {
  if (typeof hashPassword !== "function" || typeof query !== "function") {
    throw new Error("createAccountsService requires account service dependencies.");
  }

  async function findAccountByEmailWithRunner(queryRunner, loginEmail = "") {
    const normalizedLoginEmail = normalizeLoginEmail(loginEmail);

    if (!normalizedLoginEmail) {
      return null;
    }

    const [rows] = await queryRunner(
      `
        SELECT
          id,
          login_email AS loginEmail,
          password_hash AS passwordHash,
          name,
          phone,
          role_code AS roleCode,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM accounts
        WHERE login_email = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [normalizedLoginEmail],
    );

    return rows[0] || null;
  }

  async function findAccountByIdWithRunner(queryRunner, accountId = "") {
    const normalizedAccountId = String(accountId || "").trim();

    if (!normalizedAccountId) {
      return null;
    }

    const [rows] = await queryRunner(
      `
        SELECT
          id,
          login_email AS loginEmail,
          password_hash AS passwordHash,
          name,
          phone,
          role_code AS roleCode,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM accounts
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [normalizedAccountId],
    );

    return rows[0] || null;
  }

  async function getAccountAuthRecord(loginEmail = "") {
    const normalizedLoginEmail = normalizeLoginEmail(loginEmail);

    if (!normalizedLoginEmail) {
      return null;
    }

    const rows = await query(
      `
        SELECT
          id,
          login_email AS loginEmail,
          password_hash AS passwordHash,
          name,
          phone,
          role_code AS roleCode,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM accounts
        WHERE login_email = :loginEmail
          AND deleted_at IS NULL
        LIMIT 1
      `,
      { loginEmail: normalizedLoginEmail },
    );

    return rows[0] || null;
  }

  async function createAccount(connection, { loginEmail = "", name = "", password = "", passwordHash = "", phone = "", roleCode = "" } = {}) {
    const normalizedLoginEmail = normalizeLoginEmail(loginEmail);
    const normalizedName = String(name || "").trim();
    const normalizedPhone = String(phone || "").trim();
    const normalizedRoleCode = String(roleCode || "").trim().toUpperCase();

    if (!normalizedLoginEmail) {
      throw createHttpError(400, "이메일을 입력하세요.", "ACCOUNT_LOGIN_EMAIL_REQUIRED");
    }

    const nextPasswordHash = String(passwordHash || "").trim() || hashPassword(password || "Passw0rd!");
    const accountId = generateId();

    await connection.query(
      `
        INSERT INTO accounts (id, login_email, password_hash, name, phone, role_code)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [accountId, normalizedLoginEmail, nextPasswordHash, normalizedName || null, normalizedPhone || null, normalizedRoleCode || null],
    );

    return {
      id: accountId,
      loginEmail: normalizedLoginEmail,
      name: normalizedName,
      passwordHash: nextPasswordHash,
      phone: normalizedPhone,
      roleCode: normalizedRoleCode,
    };
  }

  async function updateAccount(connection, accountId = "", payload = {}) {
    const normalizedAccountId = String(accountId || "").trim();

    if (!normalizedAccountId) {
      throw createHttpError(400, "계정을 찾을 수 없습니다.", "ACCOUNT_ID_REQUIRED");
    }

    const updates = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(payload, "loginEmail")) {
      const normalizedLoginEmail = normalizeLoginEmail(payload.loginEmail);

      if (!normalizedLoginEmail) {
        throw createHttpError(400, "이메일을 입력하세요.", "ACCOUNT_LOGIN_EMAIL_REQUIRED");
      }

      updates.push("login_email = ?");
      values.push(normalizedLoginEmail);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "name")) {
      updates.push("name = ?");
      values.push(String(payload.name || "").trim() || null);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "phone")) {
      updates.push("phone = ?");
      values.push(String(payload.phone || "").trim() || null);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "passwordHash")) {
      const normalizedPasswordHash = String(payload.passwordHash || "").trim();

      if (!normalizedPasswordHash) {
        throw createHttpError(400, "비밀번호 정보를 저장할 수 없습니다.", "ACCOUNT_PASSWORD_HASH_REQUIRED");
      }

      updates.push("password_hash = ?");
      values.push(normalizedPasswordHash);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "roleCode")) {
      updates.push("role_code = ?");
      values.push(String(payload.roleCode || "").trim().toUpperCase() || null);
    }

    if (updates.length === 0) {
      return findAccountByIdWithRunner(connection.query.bind(connection), normalizedAccountId);
    }

    values.push(normalizedAccountId);

    await connection.query(
      `
        UPDATE accounts
        SET
          ${updates.join(", ")},
          updated_at = CURRENT_TIMESTAMP(3)
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      values,
    );

    return findAccountByIdWithRunner(connection.query.bind(connection), normalizedAccountId);
  }

  async function syncUsersForAccount(connection, accountId = "") {
    const normalizedAccountId = String(accountId || "").trim();

    if (!normalizedAccountId) {
      return;
    }

    await connection.query(
      `
        UPDATE users u
        INNER JOIN accounts a
          ON a.id = u.account_id
         AND a.deleted_at IS NULL
        SET
          u.login_email = a.login_email,
          u.password_hash = a.password_hash,
          u.updated_at = CURRENT_TIMESTAMP(3)
        WHERE u.account_id = ?
      `,
      [normalizedAccountId],
    );
  }

  async function attachUserToAccount(connection, userId = "", accountId = "") {
    const normalizedUserId = String(userId || "").trim();
    const normalizedAccountId = String(accountId || "").trim();

    if (!normalizedUserId || !normalizedAccountId) {
      return;
    }

    await connection.query(
      `
        UPDATE users u
        INNER JOIN accounts a
          ON a.id = ?
         AND a.deleted_at IS NULL
        SET
          u.account_id = a.id,
          u.login_email = a.login_email,
          u.password_hash = a.password_hash,
          u.updated_at = CURRENT_TIMESTAMP(3)
        WHERE u.id = ?
      `,
      [normalizedAccountId, normalizedUserId],
    );
  }

  async function detachUserFromAccount(connection, userId = "") {
    const normalizedUserId = String(userId || "").trim();

    if (!normalizedUserId) {
      return;
    }

    await connection.query(
      `
        UPDATE users
        SET
          account_id = NULL,
          login_email = NULL,
          password_hash = NULL,
          updated_at = CURRENT_TIMESTAMP(3)
        WHERE id = ?
      `,
      [normalizedUserId],
    );
  }

  async function countLinkedUsers(connection, accountId = "", { excludedUserId = "" } = {}) {
    const normalizedAccountId = String(accountId || "").trim();
    const normalizedExcludedUserId = String(excludedUserId || "").trim();

    if (!normalizedAccountId) {
      return 0;
    }

    const [rows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM users
        WHERE account_id = ?
          AND deleted_at IS NULL
          ${normalizedExcludedUserId ? "AND id <> ?" : ""}
      `,
      normalizedExcludedUserId ? [normalizedAccountId, normalizedExcludedUserId] : [normalizedAccountId],
    );

    return Number(rows[0]?.count || 0);
  }

  async function deleteAccountIfOrphaned(connection, accountId = "") {
    const normalizedAccountId = String(accountId || "").trim();

    if (!normalizedAccountId) {
      return false;
    }

    if (await countLinkedUsers(connection, normalizedAccountId)) {
      return false;
    }

    await connection.query(
      `
        DELETE FROM accounts
        WHERE id = ?
      `,
      [normalizedAccountId],
    );

    return true;
  }

  return Object.freeze({
    attachUserToAccount,
    createAccount,
    deleteAccountIfOrphaned,
    detachUserFromAccount,
    findAccountByEmail: getAccountAuthRecord,
    findAccountByEmailWithRunner,
    findAccountByIdWithRunner,
    getAccountAuthRecord,
    normalizeLoginEmail,
    syncUsersForAccount,
    updateAccount,
  });
}

module.exports = {
  createAccountsService,
  normalizeLoginEmail,
};
