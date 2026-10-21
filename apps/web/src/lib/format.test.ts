import { describe, expect, it } from "vitest";

import { dayDiff, formatMoney, formatRelative, initials, pluralize } from "./format";

describe("formatMoney", () => {
  it("formats decimal strings", () => {
    expect(formatMoney("12500.00")).toBe("$12,500");
  });
  it("supports compact notation", () => {
    expect(formatMoney("1250000", "USD", { compact: true })).toBe("$1.3M");
  });
  it("treats bad input as zero", () => {
    expect(formatMoney("abc")).toBe("$0");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-05-20T12:00:00");
  it("handles minutes, days and calendar edges", () => {
    expect(formatRelative(new Date("2026-05-20T11:30:00"), now)).toBe("30m ago");
    expect(formatRelative(new Date("2026-05-19T09:00:00"), now)).toBe("yesterday");
    expect(formatRelative(new Date("2026-05-23T09:00:00"), now)).toBe("in 3d");
    expect(formatRelative(new Date("2026-05-10T09:00:00"), now)).toBe("10d ago");
  });
  it("dayDiff uses calendar days", () => {
    expect(dayDiff(new Date("2026-05-21T00:30:00"), now)).toBe(1);
  });
});

describe("initials", () => {
  it("takes first and last word", () => {
    expect(initials("Maya van der Berg")).toBe("MB");
    expect(initials("Acme Analytics")).toBe("AA");
    expect(initials("Zed")).toBe("ZE");
    expect(initials("")).toBe("?");
  });
});

it("pluralizes", () => {
  expect(pluralize(1, "deal")).toBe("1 deal");
  expect(pluralize(3, "company", "companies")).toBe("3 companies");
});
