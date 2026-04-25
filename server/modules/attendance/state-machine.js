const TRANSITIONS = Object.freeze({
  OFF_DUTY: Object.freeze({
    CLOCK_IN: "WORKING",
    WFH_START: "WFH_WORKING",
  }),
  WORKING: Object.freeze({
    GO_OUT: "OFFSITE",
    BREAK_START: "BREAK",
    CLOCK_OUT: "OFF_DUTY",
  }),
  OFFSITE: Object.freeze({
    RETURN: "WORKING",
    CLOCK_OUT: "OFF_DUTY",
  }),
  BREAK: Object.freeze({
    BREAK_END: "WORKING",
    CLOCK_OUT: "OFF_DUTY",
  }),
  WFH_WORKING: Object.freeze({
    BREAK_START: "BREAK",
    WFH_END: "OFF_DUTY",
    CLOCK_OUT: "OFF_DUTY",
  }),
});

function getNextState(currentState, eventType) {
  return TRANSITIONS[currentState]?.[eventType] || "";
}

function assertTransitionAllowed(currentState, eventType) {
  const nextState = getNextState(currentState, eventType);

  if (!nextState) {
    const error = new Error(`Transition not allowed: ${currentState} -> ${eventType}`);
    error.code = "CLOCK_TRANSITION_INVALID";
    throw error;
  }

  return nextState;
}

module.exports = {
  assertTransitionAllowed,
  getNextState,
};
