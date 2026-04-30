const fs = require("fs");
const path = require("path");

function ensureArtifactDir(artifactDir) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

async function saveShot(page, artifactDir, name) {
  const target = path.join(artifactDir, name);
  await page.screenshot({ path: target, fullPage: true });
  return target;
}

async function getScheduleEntryToneState(page, selector) {
  const entries = await page.locator(selector).evaluateAll((nodes) => nodes.map((node) => {
    const toneClass = Array.from(node.classList).find((className) => className.startsWith("tone-")) || "";
    const spans = Array.from(node.querySelectorAll("span"));
    const label = (spans.at(-1)?.textContent || node.querySelector("strong")?.textContent || "").trim();

    return {
      compact: node.classList.contains("compact"),
      hasUnifiedClass: node.classList.contains("workmate-schedule-entry"),
      height: Math.round(node.getBoundingClientRect().height),
      label,
      toneClass,
    };
  })).then((items) => items.filter((entry) => entry.label && entry.toneClass));

  const tonesByLabel = entries.reduce((map, entry) => {
    if (!map[entry.label]) {
      map[entry.label] = [];
    }

    if (!map[entry.label].includes(entry.toneClass)) {
      map[entry.label].push(entry.toneClass);
    }

    return map;
  }, {});

  return { entries, tonesByLabel };
}

function assertScheduleEntryToneConsistency(viewName, state, referenceTonesByLabel = {}) {
  const expectedToneByLabel = {
    "내근": "tone-sky",
    "외근": "tone-violet",
    "사업": "tone-salmon",
    "출장": "tone-salmon",
    "재택": "tone-lilac",
    "휴가": "tone-leave",
    "휴일": "tone-holiday",
  };
  const inconsistentLabels = Object.entries(state.tonesByLabel)
    .filter(([, tones]) => tones.length !== 1)
    .map(([label, tones]) => `${label}:${tones.join(",")}`);
  const mismatchedLabels = state.entries
    .filter((entry) => referenceTonesByLabel[entry.label]?.length === 1 && referenceTonesByLabel[entry.label][0] !== entry.toneClass)
    .map((entry) => `${entry.label}:${entry.toneClass}->${referenceTonesByLabel[entry.label][0]}`);
  const unexpectedLabels = state.entries
    .filter((entry) => expectedToneByLabel[entry.label] && expectedToneByLabel[entry.label] !== entry.toneClass)
    .map((entry) => `${entry.label}:${entry.toneClass}->${expectedToneByLabel[entry.label]}`);
  const nonUnifiedEntries = state.entries.filter((entry) => !entry.hasUnifiedClass || !entry.compact);

  if (inconsistentLabels.length > 0 || mismatchedLabels.length > 0 || unexpectedLabels.length > 0 || nonUnifiedEntries.length > 0) {
    throw new Error(`근무일정 ${viewName} 카드 tone/UI가 일관되지 않습니다. inconsistent=${inconsistentLabels.join("|")}, mismatched=${mismatchedLabels.join("|")}, unexpected=${unexpectedLabels.join("|")}, nonUnified=${JSON.stringify(nonUnifiedEntries.slice(0, 3))}`);
  }
}

async function assertScheduleMonthEntriesSortedByName(page) {
  const unsortedCells = await page.locator(".workmate-schedule-month-cell").evaluateAll((cells) => cells
    .map((cell, index) => {
      const names = Array.from(cell.querySelectorAll(".workmate-schedule-entry.compact strong"))
        .map((node) => node.textContent.trim())
        .filter(Boolean);
      const sortedNames = names.slice().sort((left, right) => left.localeCompare(right, "ko"));

      return {
        index,
        names,
        sorted: names.every((name, nameIndex) => name === sortedNames[nameIndex]),
      };
    })
    .filter((cell) => cell.names.length > 1 && !cell.sorted));

  if (unsortedCells.length > 0) {
    throw new Error(`월 단위 근무일정 카드가 직원 이름 오름차순이 아닙니다. cells=${JSON.stringify(unsortedCells.slice(0, 3))}`);
  }
}

async function findCompanyButton(page) {
  const preferred = page.locator('[data-company-open="TEST"]').first();

  if (await preferred.count()) {
    return preferred;
  }

  const seeded = page.locator('[data-company-open="WORKMATE"]').first();

  if (await seeded.count()) {
    return seeded;
  }

  const fallback = page.locator("[data-company-open]").first();

  if (!(await fallback.count())) {
    throw new Error("접속 가능한 워크스페이스 버튼을 찾지 못했습니다.");
  }

  return fallback;
}

module.exports = {
  assertScheduleEntryToneConsistency,
  assertScheduleMonthEntriesSortedByName,
  ensureArtifactDir,
  findCompanyButton,
  getScheduleEntryToneState,
  saveShot,
};
