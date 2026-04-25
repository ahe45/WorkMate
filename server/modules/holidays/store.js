const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");
const {
  DEFAULT_HOLIDAY_CALENDAR_CODE,
  DEFAULT_HOLIDAY_CALENDAR_NAME,
  DEFAULT_TIMEZONE,
  HOLIDAY_SOURCE,
} = require("./calendar");

function createHolidayStore() {
  async function ensureOrganizationExists(queryRunner, organizationId) {
    const [rows] = await queryRunner(
      `
        SELECT id
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
  }

  async function findOrCreateDefaultCalendar(queryRunner, organizationId) {
    const [existingRows] = await queryRunner(
      `
        SELECT
          id,
          code,
          name,
          timezone
        FROM holiday_calendars
        WHERE organization_id = ?
          AND code = ?
        LIMIT 1
      `,
      [organizationId, DEFAULT_HOLIDAY_CALENDAR_CODE],
    );

    if (existingRows[0]) {
      return existingRows[0];
    }

    const calendarId = generateId();

    await queryRunner(
      `
        INSERT INTO holiday_calendars (
          id,
          organization_id,
          code,
          name,
          timezone
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        calendarId,
        organizationId,
        DEFAULT_HOLIDAY_CALENDAR_CODE,
        DEFAULT_HOLIDAY_CALENDAR_NAME,
        DEFAULT_TIMEZONE,
      ],
    );

    return {
      code: DEFAULT_HOLIDAY_CALENDAR_CODE,
      id: calendarId,
      name: DEFAULT_HOLIDAY_CALENDAR_NAME,
      timezone: DEFAULT_TIMEZONE,
    };
  }

  async function listCustomHolidayRowsByYear(queryRunner, calendarId, year) {
    const [rows] = await queryRunner(
      `
        SELECT
          id,
          DATE_FORMAT(holiday_date, '%Y-%m-%d') AS holidayDate,
          name,
          is_paid_holiday AS isPaidHoliday,
          COALESCE(repeat_unit, 'NONE') AS repeatUnit
        FROM holiday_dates
        WHERE holiday_calendar_id = ?
          AND holiday_source = ?
          AND holiday_date <= ?
        ORDER BY holiday_date ASC, name ASC, id ASC
      `,
      [calendarId, HOLIDAY_SOURCE.CUSTOM, `${year}-12-31`],
    );

    return rows;
  }

  async function findCustomHolidayById(queryRunner, organizationId, holidayId) {
    const [rows] = await queryRunner(
      `
        SELECT
          hd.id,
          hd.holiday_calendar_id AS holidayCalendarId,
          DATE_FORMAT(hd.holiday_date, '%Y-%m-%d') AS holidayDate
        FROM holiday_dates hd
        INNER JOIN holiday_calendars hc
          ON hc.id = hd.holiday_calendar_id
        WHERE hc.organization_id = ?
          AND hd.id = ?
          AND hd.holiday_source = ?
        LIMIT 1
      `,
      [organizationId, holidayId, HOLIDAY_SOURCE.CUSTOM],
    );

    return rows[0] || null;
  }

  async function findCustomHolidayByDate(queryRunner, calendarId, holidayDate, excludedHolidayId = "") {
    const params = [calendarId, holidayDate, HOLIDAY_SOURCE.CUSTOM];
    let whereClause = `
      WHERE holiday_calendar_id = ?
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
    findOrCreateDefaultCalendar,
    listCustomHolidayRowsByYear,
  });
}

module.exports = {
  createHolidayStore,
};
