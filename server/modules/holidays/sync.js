const { generateId } = require("../common/ids");
const {
  HOLIDAY_SOURCE,
  buildHolidaySummary,
  expandCustomHolidayOccurrences,
  generateKoreanPublicHolidays,
  mergeHolidayItems,
  normalizeYear,
} = require("./calendar");

function createHolidaySyncService({ holidayStore, withTransaction }) {
  async function syncHolidayCalendarYear(organizationId, yearValue) {
    const year = normalizeYear(yearValue);

    return withTransaction(async (connection) => {
      const queryRunner = connection.query.bind(connection);
      await holidayStore.ensureOrganizationExists(queryRunner, organizationId);
      const calendar = await holidayStore.findOrCreateDefaultCalendar(queryRunner, organizationId);
      const generated = generateKoreanPublicHolidays(year);
      const dateFrom = `${year}-01-01`;
      const dateTo = `${year}-12-31`;

      await queryRunner(
        `
          DELETE FROM holiday_dates
          WHERE holiday_calendar_id = ?
            AND holiday_source = ?
            AND holiday_date BETWEEN ? AND ?
        `,
        [calendar.id, HOLIDAY_SOURCE.SYSTEM, dateFrom, dateTo],
      );

      for (const item of generated.items) {
        await queryRunner(
          `
            INSERT INTO holiday_dates (
              id,
              holiday_calendar_id,
              holiday_date,
              name,
              is_paid_holiday,
              holiday_source
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            generateId(),
            calendar.id,
            item.date,
            item.name,
            item.isPaidHoliday ? 1 : 0,
            HOLIDAY_SOURCE.SYSTEM,
          ],
        );
      }

      const customItems = (await holidayStore.listCustomHolidayRowsByYear(queryRunner, calendar.id, year))
        .flatMap((row) => expandCustomHolidayOccurrences(row, year));

      return {
        calendarCode: calendar.code,
        calendarId: calendar.id,
        calendarName: calendar.name,
        items: mergeHolidayItems(generated.items, customItems),
        notices: generated.notices,
        summary: buildHolidaySummary(generated, customItems),
        timezone: calendar.timezone,
        year,
      };
    });
  }

  return Object.freeze({
    syncHolidayCalendarYear,
  });
}

module.exports = {
  createHolidaySyncService,
};
