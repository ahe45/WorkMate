(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementLeaveRuleModels = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(deps = {}) {
    const {
      formatDateValue,
      formatLeaveAmount,
      formatMonthDayValue,
      formatNumber,
      getMonthlyAccrualMethod,
      toArray,
    } = deps;

    function formatRuleSummary(rule = {}) {
      const frequency = String(rule?.frequency || "").toUpperCase();
      const isMonthly = String(rule?.frequency || "").toUpperCase() === "MONTHLY";
      const tenureMonths = Number(rule?.tenureMonths || 0);
      const tenureYears = Number(rule?.tenureYears || 0);

      if (frequency === "IMMEDIATE") {
        return "입사 즉시";
      }

      if (isMonthly && tenureMonths > 0) {
        return `근속 ${formatNumber(tenureMonths)}개월`;
      }

      if (!isMonthly && tenureYears > 0) {
        return `근속 ${formatNumber(tenureYears)}년`;
      }

      return isMonthly
        ? `매월 ${formatNumber(rule?.monthlyDay || 1)}일`
        : `매년 ${formatNumber(rule?.annualMonth || 1)}월 ${formatNumber(rule?.annualDay || 1)}일`;
    }

    function formatRuleBasis(rule = {}) {
      const frequency = String(rule?.frequency || "").toUpperCase();
      const isMonthly = String(rule?.frequency || "").toUpperCase() === "MONTHLY";

      if (frequency === "IMMEDIATE") {
        return String(rule?.immediateAccrualType || "").toUpperCase() === "PRORATED"
          ? "연간 기준 비례 계산"
          : "고정 일수 지급";
      }

      if (isMonthly) {
        const monthlyAccrualMethod = getMonthlyAccrualMethod(rule);

        if (monthlyAccrualMethod === "CONTRACTUAL_HOURS") {
          return "소정근로시간 비례";
        }

        if (monthlyAccrualMethod === "ATTENDANCE_RATE") {
          return "출근율 기반 발생";
        }
      }

      if (Number(rule?.tenureMonths || 0) > 0 || Number(rule?.tenureYears || 0) > 0) {
        return isMonthly ? "월 기준 발생" : "연 기준 발생";
      }

      return rule?.basisDateType === "HIRE_DATE" ? "입사일 기준" : "회계연도 기준";
    }

    function formatRulePeriod(rule = {}) {
      const frequency = String(rule?.frequency || "").toUpperCase();
      const isMonthly = String(rule?.frequency || "").toUpperCase() === "MONTHLY";
      const expiresAfterMonths = Number(rule?.expiresAfterMonths || 0);

      if (frequency === "IMMEDIATE") {
        if (String(rule?.immediateAccrualType || "").toUpperCase() === "PRORATED") {
          const basis = String(rule?.prorationBasis || "").toUpperCase() === "HIRE_YEAR" ? "입사일 기준 1년" : "회계연도 기준";
          const unit = String(rule?.prorationUnit || "").toUpperCase() === "REMAINING_MONTHS" ? "잔여 월수" : "잔여 일수";

          return `${basis} · ${unit} · 소멸 ${formatMonthDayValue(rule?.effectiveTo || "12-31")}`;
        }

        if (formatMonthDayValue(rule?.effectiveTo || "") !== "-") {
          return `소멸 ${formatMonthDayValue(rule?.effectiveTo)}`;
        }

        return expiresAfterMonths > 0 ? `유효 ${formatNumber(expiresAfterMonths)}개월` : "입사일 1회 지급";
      }

      if (isMonthly && expiresAfterMonths > 0) {
        const monthlyAccrualMethod = getMonthlyAccrualMethod(rule);
        const suffix = monthlyAccrualMethod === "CONTRACTUAL_HOURS"
          ? ` · 기준 ${formatNumber(Math.round((Number(rule?.referenceDailyMinutes || 480) / 60 + Number.EPSILON) * 100) / 100)}시간`
          : monthlyAccrualMethod === "ATTENDANCE_RATE"
            ? ` · 기준 ${formatNumber(rule?.attendanceRateThreshold || 80)}%`
            : "";

        return `유효 ${formatNumber(expiresAfterMonths)}개월${suffix}`;
      }

      if (!isMonthly && Number(rule?.tenureYears || 0) > 0) {
        return `발생 ${formatMonthDayValue(rule?.effectiveFrom)} / 소멸 ${formatMonthDayValue(rule?.effectiveTo)}`;
      }

      return `${formatDateValue(rule?.effectiveFrom)} ~ ${formatDateValue(rule?.effectiveTo)}`;
    }

    function normalizeLeaveRuleSetName(ruleOrName = "") {
      const rule = ruleOrName && typeof ruleOrName === "object" ? ruleOrName : null;
      const explicitRuleSetName = String(rule?.ruleSetName || "").trim();

      if (explicitRuleSetName) {
        return explicitRuleSetName;
      }

      const normalizedName = String(rule ? rule.name : ruleOrName || "").trim();
      const hasTenureSegmentSuffix = Boolean(rule)
        && (Number(rule?.tenureMonths || 0) > 0 || Number(rule?.tenureYears || 0) > 0)
        && normalizedName.includes(" - ");
      const genericBaseName = hasTenureSegmentSuffix
        ? normalizedName.replace(/\s+-\s+[^-]+$/, "").trim()
        : "";
      const baseName = normalizedName.replace(/\s+-\s+근속\s+\d+(?:\.\d+)?(?:개월|년)\s*$/u, "").trim();

      return genericBaseName || baseName || normalizedName || "휴가 발생 규칙";
    }

    function getLeaveRuleCreatedBucket(rule = {}) {
      return String(rule?.createdAt || "").trim().slice(0, 19);
    }

    function getLeaveRuleRecordKey(rule = {}) {
      const explicitSetId = String(rule?.ruleSetId || rule?.ruleGroupId || "").trim();

      if (explicitSetId) {
        return `set:${explicitSetId}`;
      }

      const baseName = normalizeLeaveRuleSetName(rule);
      const originalName = String(rule?.name || "").trim();
      const isSegmentRule = baseName && originalName && baseName !== originalName;
      const createdBucket = isSegmentRule
        ? String(rule?.createdAt || "").trim().slice(0, 13)
        : getLeaveRuleCreatedBucket(rule);

      return [
        String(rule?.leaveGroupId || "").trim(),
        String(rule?.leaveTypeId || "").trim(),
        String(rule?.frequency || "").trim().toUpperCase(),
        baseName,
        createdBucket,
      ].join("|");
    }

    function sortLeaveRuleSegments(segments = []) {
      return toArray(segments)
        .slice()
        .sort((left, right) => {
          const leftFrequency = String(left?.frequency || "").toUpperCase();
          const rightFrequency = String(right?.frequency || "").toUpperCase();

          if (leftFrequency !== rightFrequency) {
            return leftFrequency.localeCompare(rightFrequency);
          }

          const leftTenure = leftFrequency === "MONTHLY"
            ? Number(left?.tenureMonths || 0)
            : Number(left?.tenureYears || 0);
          const rightTenure = rightFrequency === "MONTHLY"
            ? Number(right?.tenureMonths || 0)
            : Number(right?.tenureYears || 0);

          if (leftTenure !== rightTenure) {
            return leftTenure - rightTenure;
          }

          return String(left?.createdAt || left?.id || "").localeCompare(String(right?.createdAt || right?.id || ""));
        });
    }

    function buildLeaveRuleRecordModels(rules = []) {
      const recordByKey = new Map();

      toArray(rules).forEach((rule) => {
        const ruleId = String(rule?.id || "").trim();
        const recordKey = getLeaveRuleRecordKey(rule);
        const segment = {
          ...rule,
          name: normalizeLeaveRuleSetName(rule),
        };

        if (!recordByKey.has(recordKey)) {
          recordByKey.set(recordKey, {
            ...segment,
            id: ruleId,
            name: normalizeLeaveRuleSetName(rule),
            ruleIds: ruleId ? [ruleId] : [],
            segments: [],
          });
        }

        const record = recordByKey.get(recordKey);

        if (ruleId && !record.ruleIds.includes(ruleId)) {
          record.ruleIds.push(ruleId);
        }

        record.segments.push(segment);

        if (String(rule?.status || "").toUpperCase() === "ACTIVE") {
          record.status = "ACTIVE";
        }
      });

      return Array.from(recordByKey.values()).map((record) => {
        const segments = sortLeaveRuleSegments(record.segments);
        const ruleIds = segments
          .map((segment) => String(segment?.id || "").trim())
          .filter(Boolean);

        return {
          ...record,
          amountDays: segments[0]?.amountDays,
          attendanceAccrualMethod: segments[0]?.attendanceAccrualMethod,
          attendanceRateThreshold: segments[0]?.attendanceRateThreshold,
          effectiveFrom: segments[0]?.effectiveFrom,
          effectiveTo: segments[0]?.effectiveTo,
          expiresAfterMonths: segments[0]?.expiresAfterMonths,
          monthlyAccrualMethod: segments[0]?.monthlyAccrualMethod,
          referenceDailyMinutes: segments[0]?.referenceDailyMinutes,
          id: ruleIds.join(",") || record.id,
          ruleIds,
          segments,
        };
      });
    }

    function formatLeaveRuleSegmentLine(segment = {}) {
      return `${formatRuleSummary(segment)} · ${formatLeaveAmount(segment?.amountDays || 0)} · ${formatRulePeriod(segment)}`;
    }

    return Object.freeze({
      buildLeaveRuleRecordModels,
      formatLeaveRuleSegmentLine,
      formatRuleBasis,
      formatRuleSummary,
      sortLeaveRuleSegments,
    });
  }

  return Object.freeze({ create });
});
