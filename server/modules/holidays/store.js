const { createHttpError } = require("../common/http-error");
const { HOLIDAY_SOURCE } = require("./calendar");

function createHolidayStore() {
  async function ensureOrganizationExists(queryRunner, organizationId) {
    const [rows] = await queryRunner(
      `
        SELECT
          id,
          name,
          timezone
        FROM organizations
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [organizationId],
    );

    if (!rows[0]) {
      throw createHttpError(404, "회사를 찾을 수 없습니다.", "ORG_NOT_FOUND");
    }

    return rows[0];
  }

  async function listCustomHolidayRowsByYear(queryRunner, organizationId, year) {
    const [rows] = await queryRunner(
      `
        SELECT
          id,
          DATE_FORMAT(holiday_date, '%Y-%m-%d') AS holidayDate,
          name,
          is_paid_holiday AS isPaidHoliday,
          COALESCE(repeat_unit, 'NONE') AS repeatUnit
        FROM holiday_dates
        WHERE organization_id = ?
          AND holiday_source = ?
          AND holiday_date <= ?
        ORDER BY holiday_date ASC, name ASC, id ASC
      `,
      [organizationId, HOLIDAY_SOURCE.CUSTOM, `${year}-12-31`],
    );

    return rows;
  }

  async function findCustomHolidayById(queryRunner, organizationId, holidayId) {
    const [rows] = await queryRunner(
      `
        SELECT
          hd.id,
          hd.organization_id AS organizationId,
          DATE_FORMAT(hd.holiday_date, '%Y-%m-%d') AS holidayDate
        FROM holiday_dates hd
        WHERE hd.organization_id = ?
          AND hd.id = ?
          AND hd.holiday_source = ?
        LIMIT 1
      `,
      [organizationId, holidayId, HOLIDAY_SOURCE.CUSTOM],
    );

    return rows[0] || null;
  }

  async function findCustomHolidayByDate(queryRunner, organizationId, holidayDate, excludedHolidayId = "") {
    const params = [organizationId, holidayDate, HOLIDAY_SOURCE.CUSTOM];
    let whereClause = `
      WHERE organization_id = ?
        AND holiday_date = ?
        AND holiday_source = ?
    `;

    if (excludedHolidayId) {
      whereClause += `
        AND id <> ?
      `;
      params.push(excludedHolidayId);
    }

    const [rows] = await queryRunner(
      `
        SELECT id
        FROM holiday_dates
        ${whereClause}
        LIMIT 1
      `,
      params,
    );

    return rows[0] || null;
  }

  return Object.freeze({
    ensureOrganizationExists,
    findCustomHolidayByDate,
    findCustomHolidayById,
    listCustomHolidayRowsByYear,
  });
}

module.exports = {
  createHolidayStore,
};
