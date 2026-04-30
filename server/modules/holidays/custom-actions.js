const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");
const {
  CUSTOM_HOLIDAY_REPEAT_UNIT,
  HOLIDAY_SOURCE,
  createCustomHolidayItem,
  normalizeCustomHolidayRepeatUnit,
  normalizeHolidayDate,
  normalizeHolidayName,
} = require("./calendar");

function createCustomHolidayActions({ holidayStore, withTransaction }) {
  async function createCustomHoliday(organizationId, payload = {}) {
    const holidayDate = normalizeHolidayDate(payload.holidayDate || payload.date || "");
    const name = normalizeHolidayName(payload.name);
    const repeatUnit = normalizeCustomHolidayRepeatUnit(payload.repeatUnit || CUSTOM_HOLIDAY_REPEAT_UNIT.NONE);

    return withTransaction(async (connection) => {
      const queryRunner = connection.query.bind(connection);
      await holidayStore.ensureOrganizationExists(queryRunner, organizationId);
      const existingHoliday = await holidayStore.findCustomHolidayByDate(queryRunner, organizationId, holidayDate);

      if (existingHoliday) {
        throw createHttpError(409, "이미 지정 공휴일이 등록된 날짜입니다.", "HOLIDAY_CUSTOM_DATE_EXISTS");
      }

      const holidayId = generateId();

      await queryRunner(
        `
          INSERT INTO holiday_dates (
            id,
            organization_id,
            holiday_date,
            name,
            is_paid_holiday,
            holiday_source,
            repeat_unit
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [holidayId, organizationId, holidayDate, name, 1, HOLIDAY_SOURCE.CUSTOM, repeatUnit],
      );

      return createCustomHolidayItem({
        holidayDate,
        id: holidayId,
        isPaidHoliday: 1,
        name,
        repeatUnit,
      });
    });
  }

  async function updateCustomHoliday(organizationId, holidayId, payload = {}) {
    const normalizedHolidayId = String(holidayId || "").trim();
    const holidayDate = normalizeHolidayDate(payload.holidayDate || payload.date || "");
    const name = normalizeHolidayName(payload.name);
    const repeatUnit = normalizeCustomHolidayRepeatUnit(payload.repeatUnit || CUSTOM_HOLIDAY_REPEAT_UNIT.NONE);

    if (!normalizedHolidayId) {
      throw createHttpError(400, "수정할 지정 공휴일을 찾을 수 없습니다.", "HOLIDAY_CUSTOM_ID_REQUIRED");
    }

    return withTransaction(async (connection) => {
      const queryRunner = connection.query.bind(connection);
      await holidayStore.ensureOrganizationExists(queryRunner, organizationId);
      const targetHoliday = await holidayStore.findCustomHolidayById(queryRunner, organizationId, normalizedHolidayId);

      if (!targetHoliday) {
        throw createHttpError(404, "지정 공휴일을 찾을 수 없습니다.", "HOLIDAY_CUSTOM_NOT_FOUND");
      }

      const duplicateHoliday = await holidayStore.findCustomHolidayByDate(
        queryRunner,
        targetHoliday.organizationId,
        holidayDate,
        normalizedHolidayId,
      );

      if (duplicateHoliday) {
        throw createHttpError(409, "이미 지정 공휴일이 등록된 날짜입니다.", "HOLIDAY_CUSTOM_DATE_EXISTS");
      }

      await queryRunner(
        `
          UPDATE holiday_dates
          SET
            holiday_date = ?,
            name = ?,
            repeat_unit = ?
          WHERE id = ?
        `,
        [holidayDate, name, repeatUnit, normalizedHolidayId],
      );

      return createCustomHolidayItem({
        holidayDate,
        id: normalizedHolidayId,
        isPaidHoliday: 1,
        name,
        repeatUnit,
      });
    });
  }

  async function deleteCustomHoliday(organizationId, holidayId) {
    const normalizedHolidayId = String(holidayId || "").trim();

    if (!normalizedHolidayId) {
      throw createHttpError(400, "삭제할 지정 공휴일을 찾을 수 없습니다.", "HOLIDAY_CUSTOM_ID_REQUIRED");
    }

    return withTransaction(async (connection) => {
      const queryRunner = connection.query.bind(connection);
      await holidayStore.ensureOrganizationExists(queryRunner, organizationId);
      const targetHoliday = await holidayStore.findCustomHolidayById(queryRunner, organizationId, normalizedHolidayId);

      if (!targetHoliday) {
        throw createHttpError(404, "지정 공휴일을 찾을 수 없습니다.", "HOLIDAY_CUSTOM_NOT_FOUND");
      }

      await queryRunner(
        `
          DELETE FROM holiday_dates
          WHERE id = ?
        `,
        [normalizedHolidayId],
      );

      return {
        deleted: true,
        holidayDate: String(targetHoliday.holidayDate || "").trim(),
        id: normalizedHolidayId,
      };
    });
  }

  return Object.freeze({
    createCustomHoliday,
    deleteCustomHoliday,
    updateCustomHoliday,
  });
}

module.exports = {
  createCustomHolidayActions,
};
