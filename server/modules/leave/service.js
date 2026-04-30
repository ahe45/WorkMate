const { createLeaveAccrualRuleCommands } = require("./accrual-rule-commands");
const { createLeaveAccrualRunner } = require("./accrual-runner");
const { createLeaveGroupCommands } = require("./group-commands");
const { createManualLeaveGrantCommands } = require("./manual-grant-commands");
const { createLeaveReadModels } = require("./read-models");

function createLeaveService({ query, withTransaction }) {
  if (typeof query !== "function" || typeof withTransaction !== "function") {
    throw new Error("createLeaveService requires query and withTransaction dependencies.");
  }

  const {
    listLeaveAccrualEntries,
    listLeaveAccrualRules,
    listLeaveBalances,
    listLeaveGroups,
    listLeaveRequests,
    listLeaveRequestsInRange,
    listLeaveTypes,
  } = createLeaveReadModels({ query });
  const {
    createLeaveGroup,
    deleteLeaveGroup,
    updateLeaveGroup,
  } = createLeaveGroupCommands({ withTransaction });
  const {
    createManualLeaveGrant,
  } = createManualLeaveGrantCommands({ withTransaction });
  const {
    createLeaveAccrualRule,
    deleteLeaveAccrualRuleSet,
    updateLeaveAccrualRuleSet,
  } = createLeaveAccrualRuleCommands({ withTransaction });
  const {
    runDueLeaveAccrualRules,
    runLeaveAccrualRule,
  } = createLeaveAccrualRunner({ query, withTransaction });

  return {
    createLeaveAccrualRule,
    createLeaveGroup,
    createManualLeaveGrant,
    deleteLeaveAccrualRuleSet,
    deleteLeaveGroup,
    listLeaveAccrualEntries,
    listLeaveAccrualRules,
    listLeaveBalances,
    listLeaveGroups,
    listLeaveRequests,
    listLeaveRequestsInRange,
    listLeaveTypes,
    runDueLeaveAccrualRules,
    runLeaveAccrualRule,
    updateLeaveAccrualRuleSet,
    updateLeaveGroup,
  };
}

module.exports = {
  createLeaveService,
};
