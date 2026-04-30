const {
  DEFAULT_TIMEZONE,
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
      const organization = await holidayStore.ensureOrganizationExists(queryRunner, organizationId);
      const generated = generateKoreanPublicHolidays(year);
      const customItems = (await holidayStore.listCustomHolidayRowsByYear(queryRunner, organizationId, year))
        .flatMap((row) => expandCustomHolidayOccurrences(row, year));

      return {
        calendarCode: "CUSTOM",
        calendarId: organization.id,
        calendarName: `${String(organization.name || "회사").trim() || "회사"} 지정 공휴일`,
        items: mergeHolidayItems(generated.items, customItems),
        notices: generated.notices,
        summary: buildHolidaySummary(generated, customItems),
        timezone: organization.timezone || DEFAULT_TIMEZONE,
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
