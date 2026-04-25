const { createCustomHolidayActions } = require("./custom-actions");
const { createHolidayStore } = require("./store");
const { createHolidaySyncService } = require("./sync");

function createHolidaysService({ query, withTransaction }) {
  const holidayStore = createHolidayStore();
  const syncService = createHolidaySyncService({
    holidayStore,
    withTransaction,
  });
  const customHolidayActions = createCustomHolidayActions({
    holidayStore,
    withTransaction,
  });

  return {
    ...customHolidayActions,
    syncHolidayCalendarYear: syncService.syncHolidayCalendarYear,
  };
}

module.exports = {
  createHolidaysService,
};
