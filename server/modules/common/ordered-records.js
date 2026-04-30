const { createHttpError } = require("./http-error");

const SQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertSqlIdentifier(value, label = "SQL identifier") {
  const identifier = String(value || "").trim();

  if (!SQL_IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`${label} is invalid: ${identifier}`);
  }

  return identifier;
}

function normalizeIdList(value = []) {
  const source = Array.isArray(value)
    ? value
    : value == null
      ? []
      : [value];

  return Array.from(new Set(source.map((item) => String(item || "").trim()).filter(Boolean)));
}

function normalizeOrderByClause(orderBy = "") {
  const terms = String(orderBy || "")
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => {
      const [column, direction = "ASC", ...rest] = term.split(/\s+/);
      const normalizedDirection = String(direction || "ASC").trim().toUpperCase();

      if (rest.length > 0 || !["ASC", "DESC"].includes(normalizedDirection)) {
        throw new Error(`ORDER BY term is invalid: ${term}`);
      }

      return `${assertSqlIdentifier(column, "ORDER BY column")} ${normalizedDirection}`;
    });

  if (terms.length === 0) {
    throw new Error("ORDER BY clause must not be empty.");
  }

  return terms.join(", ");
}

function buildActiveScopeWhere({
  organizationColumn = "organization_id",
  organizationId,
  parentColumn = "",
  parentId = null,
}) {
  const conditions = [
    `${assertSqlIdentifier(organizationColumn, "organization column")} = ?`,
    "deleted_at IS NULL",
  ];
  const params = [organizationId];

  if (parentColumn) {
    const normalizedParentColumn = assertSqlIdentifier(parentColumn, "parent column");

    if (parentId) {
      conditions.push(`${normalizedParentColumn} = ?`);
      params.push(parentId);
    } else {
      conditions.push(`${normalizedParentColumn} IS NULL`);
    }
  }

  return {
    sql: conditions.join(" AND "),
    params,
  };
}

async function getNextSortOrder(queryRunner, options = {}) {
  const {
    orderColumn = "sort_order",
    tableName,
  } = options;
  const where = buildActiveScopeWhere(options);
  const [rows] = await queryRunner(
    `
      SELECT COALESCE(MAX(${assertSqlIdentifier(orderColumn, "order column")}), 0) + 1 AS nextSortOrder
      FROM ${assertSqlIdentifier(tableName, "table name")}
      WHERE ${where.sql}
    `,
    where.params,
  );

  return Math.max(1, Number(rows[0]?.nextSortOrder || 1));
}

async function listActiveOrderedIds(queryRunner, options = {}) {
  const {
    orderBy = "sort_order ASC, created_at DESC, name ASC, id ASC",
    tableName,
  } = options;
  const where = buildActiveScopeWhere(options);
  const normalizedOrderBy = normalizeOrderByClause(orderBy);
  const [rows] = await queryRunner(
    `
      SELECT id
      FROM ${assertSqlIdentifier(tableName, "table name")}
      WHERE ${where.sql}
      ORDER BY ${normalizedOrderBy}
    `,
    where.params,
  );

  return rows.map((row) => String(row?.id || "").trim()).filter(Boolean);
}

async function resequenceSortOrders(queryRunner, options = {}) {
  const {
    idColumn = "id",
    orderedIds = [],
    orderColumn = "sort_order",
    organizationColumn = "organization_id",
    organizationId,
    tableName,
  } = options;
  const normalizedOrderedIds = normalizeIdList(orderedIds);
  const targetIds = normalizedOrderedIds.length > 0
    ? normalizedOrderedIds
    : await listActiveOrderedIds(queryRunner, options);
  const normalizedTableName = assertSqlIdentifier(tableName, "table name");
  const normalizedOrderColumn = assertSqlIdentifier(orderColumn, "order column");
  const normalizedOrganizationColumn = assertSqlIdentifier(organizationColumn, "organization column");
  const normalizedIdColumn = assertSqlIdentifier(idColumn, "id column");

  for (let index = 0; index < targetIds.length; index += 1) {
    await queryRunner(
      `
        UPDATE ${normalizedTableName}
        SET
          ${normalizedOrderColumn} = ?,
          updated_at = CURRENT_TIMESTAMP(3)
        WHERE ${normalizedOrganizationColumn} = ?
          AND ${normalizedIdColumn} = ?
          AND deleted_at IS NULL
      `,
      [index + 1, organizationId, targetIds[index]],
    );
  }

  return targetIds;
}

function assertCompleteReorder({
  currentIds = [],
  emptyCode,
  emptyMessage,
  invalidCode,
  invalidMessage,
  orderedIds = [],
  unknownIdCode = invalidCode,
  unknownIdMessage = invalidMessage,
}) {
  if (currentIds.length === 0) {
    throw createHttpError(400, emptyMessage, emptyCode);
  }

  if (orderedIds.length !== currentIds.length) {
    throw createHttpError(400, invalidMessage, invalidCode);
  }

  const currentIdSet = new Set(currentIds);

  if (orderedIds.some((orderedId) => !currentIdSet.has(orderedId))) {
    throw createHttpError(400, unknownIdMessage, unknownIdCode);
  }
}

module.exports = {
  assertCompleteReorder,
  getNextSortOrder,
  listActiveOrderedIds,
  normalizeIdList,
  resequenceSortOrders,
};
