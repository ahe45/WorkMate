const mysql = require("mysql2/promise");

const { getDbConfig } = require("../db");
const {
  buildTodayContext,
  parseArgs,
  resolveScheduleRange,
} = require("./lib/demo-workforce-models");
const {
  ensureDemoUsers,
  ensureLeaveBalances,
  ensureLeaveTypes,
  ensureRootUnit,
  ensureScheduleTemplates,
  ensureSites,
  ensureUnits,
  getDefaultWorkPolicy,
  getTargetOrganization,
} = require("./lib/demo-workforce-foundation-seed");
const {
  clearAttendanceRangeDemoData,
  clearScheduleRangeDemoData,
  seedAttendanceRangeDemoData,
  seedScheduleRangeDemoData,
} = require("./lib/demo-workforce-range-seed");
const {
  clearTodayDemoData,
  seedTodayDemoData,
} = require("./lib/demo-workforce-today-seed");

async function main() {
  const { count, organizationCode, scheduleFrom, scheduleTo } = parseArgs();
  const connection = await mysql.createConnection(getDbConfig(true));

  try {
    await connection.beginTransaction();
    const organization = await getTargetOrganization(connection, organizationCode);

    if (!organization) {
      throw new Error("대상 조직을 찾을 수 없습니다.");
    }

    const workPolicy = await getDefaultWorkPolicy(connection, organization.id);

    if (!workPolicy) {
      throw new Error(`${organization.code} 조직의 기본 근무 정책을 찾을 수 없습니다.`);
    }

    const rootUnit = await ensureRootUnit(connection, organization.id);
    const unitList = await ensureUnits(connection, organization.id, rootUnit);
    const siteMap = await ensureSites(connection, organization.id, rootUnit.id);
    const leaveTypeMap = await ensureLeaveTypes(connection, organization.id);
    const templateMap = await ensureScheduleTemplates(connection, organization.id, workPolicy.id, siteMap);
    const demoUsers = await ensureDemoUsers(connection, organization, workPolicy.id, unitList, siteMap, count);
    const demoUserIds = demoUsers.map((user) => user.id);
    const todayContext = buildTodayContext();
    const leaveBalanceCount = await ensureLeaveBalances(
      connection,
      organization.id,
      demoUsers,
      leaveTypeMap,
      Number(todayContext.date.slice(0, 4)),
    );
    const scheduleRange = resolveScheduleRange(todayContext.date, scheduleFrom, scheduleTo);

    await clearTodayDemoData(connection, organization.id, demoUserIds, todayContext.date);
    await seedTodayDemoData(connection, organization, demoUsers, siteMap, templateMap, leaveTypeMap, workPolicy.id, todayContext);

    const deletedAttendanceSessions = await clearAttendanceRangeDemoData(
      connection,
      organization.id,
      demoUserIds,
      scheduleRange.dateFrom,
      scheduleRange.dateTo,
      todayContext.date,
    );
    const deletedScheduleInstances = await clearScheduleRangeDemoData(
      connection,
      organization.id,
      demoUserIds,
      scheduleRange.dateFrom,
      scheduleRange.dateTo,
      todayContext.date,
    );
    const scheduleSeedResult = await seedScheduleRangeDemoData(
      connection,
      organization,
      demoUsers,
      siteMap,
      templateMap,
      workPolicy.id,
      scheduleRange.dateFrom,
      scheduleRange.dateTo,
      todayContext.date,
    );
    const attendanceSeedResult = await seedAttendanceRangeDemoData(
      connection,
      organization,
      demoUsers,
      workPolicy.id,
      scheduleRange.dateFrom,
      scheduleRange.dateTo,
      todayContext.date,
    );

    await connection.commit();
    console.log(JSON.stringify({
      addedUsers: demoUsers.length,
      attendanceRange: {
        dateFrom: scheduleRange.dateFrom,
        dateTo: scheduleRange.dateTo,
        deletedSessions: deletedAttendanceSessions,
        insertedSessions: attendanceSeedResult.insertedCount,
        skippedExistingSessions: attendanceSeedResult.skippedExistingCount,
      },
      leaveBalances: leaveBalanceCount,
      organizationCode: organization.code,
      organizationName: organization.name,
      scheduleRange: {
        dateFrom: scheduleRange.dateFrom,
        dateTo: scheduleRange.dateTo,
        deletedInstances: deletedScheduleInstances,
        insertedInstances: scheduleSeedResult.insertedCount,
        skippedExistingInstances: scheduleSeedResult.skippedExistingCount,
      },
      targetDate: todayContext.date,
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Failed to seed demo workforce.");
  console.error(error.message || error);
  process.exitCode = 1;
});
