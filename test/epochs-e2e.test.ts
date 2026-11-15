import { afterEach, describe, expect, it } from "vitest";
import {
	dateformat,
	durationformat,
	fnDate,
	fnDur,
	addDateDuration,
	subtractDates,
	coerceYamlDate,
} from "../src/dates";
import { setEpochsApiForTests, type EpochsDateApi } from "../src/epochsBridge";
import { evaluateExpression, createTestContext } from "../src/eval";
import { isPqDate, isPqDuration } from "../src/dates";

/**
 * Lightweight duck-typed Epochs API for Grimoire bridge E2E.
 * Mirrors the real contract: parseDate / formatDate / formatDuration / addDuration.
 */
function makeMockEpochs(opts?: { missing?: boolean }): EpochsDateApi | null {
	if (opts?.missing) return null;

	const DAY = 24 * 3600 * 1000;
	const YLEN = 90; // Frostmere+Greentide+Highsun
	const months = ["Frostmere", "Greentide", "Highsun"];

	const dayIndexToParts = (dayIndex: number) => {
		const year = Math.floor(dayIndex / YLEN) + 1;
		let dayOfYear = (dayIndex % YLEN) + 1;
		let month = 1;
		let day = dayOfYear;
		for (let i = 0; i < months.length; i++) {
			const len = 30;
			if (dayOfYear <= len) {
				month = i + 1;
				day = dayOfYear;
				break;
			}
			dayOfYear -= len;
		}
		return { year, month, day, monthName: months[month - 1]! };
	};

	const partsToMs = (year: number, month: number, day: number) => {
		let dayOfYear = day;
		for (let i = 0; i < month - 1; i++) dayOfYear += 30;
		const dayIndex = (year - 1) * YLEN + (dayOfYear - 1);
		return dayIndex * DAY;
	};

	return {
		parseDate(value: unknown) {
			if (typeof value === "string") {
				const m = /^aether:(\d+)-([A-Za-z]+)-(\d+)$/.exec(value.trim());
				if (!m) {
					const doy = /^spiral:(\d+)-(\d+)$/.exec(value.trim());
					if (!doy) return null;
					const year = Number(doy[1]);
					const day = Number(doy[2]);
					if (day < 1 || day > 400) return null;
					return { ms: ((year - 1) * 400 + (day - 1)) * DAY, calendarId: "spiral" };
				}
				const year = Number(m[1]);
				const monthName = m[2]!;
				const day = Number(m[3]);
				const month = months.findIndex((n) => n === monthName) + 1;
				if (month < 1) return null;
				return { ms: partsToMs(year, month, day), calendarId: "aether" };
			}
			if (value && typeof value === "object" && !Array.isArray(value)) {
				const rec = value as Record<string, unknown>;
				const calendar = String(rec.calendar ?? "");
				const year = Number(rec.year);
				const day = Number(rec.day);
				if (calendar === "spiral") {
					if (!Number.isFinite(year) || !Number.isFinite(day) || day < 1 || day > 400) {
						return null;
					}
					return { ms: ((year - 1) * 400 + (day - 1)) * DAY, calendarId: "spiral" };
				}
				if (calendar !== "aether") return null;
				const monthRaw = rec.month;
				let month = 1;
				if (typeof monthRaw === "number") month = monthRaw;
				else if (typeof monthRaw === "string") {
					month = months.findIndex((n) => n.toLowerCase() === monthRaw.toLowerCase()) + 1;
				}
				if (month < 1 || !Number.isFinite(year) || !Number.isFinite(day)) return null;
				return { ms: partsToMs(year, month, day), calendarId: "aether" };
			}
			return null;
		},
		formatDate(ms: number, calendarId: string, format?: string) {
			// Sentinels avoid re-matching era/month text as format tokens.
			const apply = (
				fmt: string,
				vals: { y: number; d: number; MMMM: string; M: string; G: string },
			) =>
				fmt
					.replace(/MMMM/g, "\uE001")
					.replace(/M/g, "\uE002")
					.replace(/yyyy/g, "\uE003")
					.replace(/dd/g, "\uE004")
					.replace(/y/g, "\uE005")
					.replace(/d/g, "\uE006")
					.replace(/G/g, "\uE007")
					.replace(/\uE001/g, vals.MMMM)
					.replace(/\uE002/g, vals.M)
					.replace(/\uE003/g, String(vals.y).padStart(4, "0"))
					.replace(/\uE004/g, String(vals.d).padStart(2, "0"))
					.replace(/\uE005/g, String(vals.y))
					.replace(/\uE006/g, String(vals.d))
					.replace(/\uE007/g, vals.G);

			if (calendarId === "spiral") {
				const dayIndex = Math.floor(ms / DAY);
				const year = Math.floor(dayIndex / 400) + 1;
				const day = (dayIndex % 400) + 1;
				return apply(format ?? "d, y", {
					y: year,
					d: day,
					MMMM: "",
					M: "",
					G: "Spiral Age",
				});
			}
			if (calendarId !== "aether") return "";
			const parts = dayIndexToParts(Math.floor(ms / DAY));
			return apply(format ?? "MMMM d, y G", {
				y: parts.year,
				d: parts.day,
				MMMM: parts.monthName,
				M: String(parts.month),
				G: "Age of Flame",
			});
		},
		formatDuration(ms: number, calendarId: string, format?: string) {
			const yLen = calendarId === "spiral" ? 400 : YLEN;
			const years = Math.floor(Math.abs(ms) / (yLen * DAY));
			const days = Math.floor((Math.abs(ms) % (yLen * DAY)) / DAY);
			if (!format) {
				const parts: string[] = [];
				if (years) parts.push(`${years} year${years === 1 ? "" : "s"}`);
				if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
				return parts.join(", ") || "0 days";
			}
			// Strip Luxon-style quotes around literals
			let i = 0;
			let out = "";
			while (i < format.length) {
				if (format[i] === "'") {
					i++;
					while (i < format.length && format[i] !== "'") out += format[i++];
					if (format[i] === "'") i++;
				} else {
					const next = format.indexOf("'", i);
					const seg = next === -1 ? format.slice(i) : format.slice(i, next);
					out += seg
						.replace(/yyyy/g, String(years).padStart(4, "0"))
						.replace(/y/g, String(years))
						.replace(/dd/g, String(days).padStart(2, "0"))
						.replace(/d/g, String(days));
					i = next === -1 ? format.length : next;
				}
			}
			return out;
		},
		addDuration(ms, calendarId, parts, sign = 1) {
			const yLen = calendarId === "spiral" ? 400 : YLEN;
			let dayIndex = Math.floor(ms / DAY);
			for (const part of parts) {
				const amount = part.amount * sign;
				const unit = part.unit.toLowerCase().replace(/s$/, "");
				if (unit === "year" || unit === "y") dayIndex += amount * yLen;
				else if (unit === "day" || unit === "d") dayIndex += amount;
			}
			return dayIndex * DAY;
		},
	};
}

afterEach(() => {
	setEpochsApiForTests(undefined);
});

describe("P3 case 1 — Gregorian-only (Epochs unused)", () => {
	it("formats ISO dates without Epochs", () => {
		setEpochsApiForTests(null);
		const d = fnDate("2003-10-03")!;
		expect(d.calendarId).toBeUndefined();
		expect(dateformat(d, "MMMM ddO, yyyy")).toBe("October 3rd, 2003");
		expect(durationformat(fnDur([2, "days"])!, "d' days'")).toBe("2 days");
	});
});

describe("P3 case 2 — calendar with months", () => {
	it("frontmatter object → date / dateformat / dur / durationformat", () => {
		setEpochsApiForTests(makeMockEpochs());
		const fm = { calendar: "aether", year: 312, month: "Greentide", day: 4 };
		const coerced = coerceYamlDate(fm);
		expect(isPqDate(coerced) && coerced.calendarId).toBe("aether");

		expect(dateformat(coerced, "MMMM d, y G")).toBe("Greentide 4, 312 Age of Flame");

		const fromStr = fnDate("aether:312-Greentide-4")!;
		expect(fromStr.ms).toBe((coerced as { ms: number }).ms);

		const later = addDateDuration(fromStr, fnDur([2, "years"])!);
		expect(dateformat(later, "y")).toBe("314");

		const span = subtractDates(later, fromStr);
		expect(isPqDuration(span) && span.calendarId).toBe("aether");
		expect(durationformat(span, "y' years'")).toBe("2 years");
		expect(durationformat(span)).toContain("2 year");
	});

	it("evaluates q= expressions via eval", () => {
		setEpochsApiForTests(makeMockEpochs());
		const ctx = createTestContext({
			fields: {
				birthDate: coerceYamlDate({
					calendar: "aether",
					year: 312,
					month: "Greentide",
					day: 4,
				}),
			},
		});
		expect(evaluateExpression('dateformat(birthDate, "MMMM d, y")', ctx)).toBe("Greentide 4, 312");
		expect(
			evaluateExpression('dateformat(date("aether:312-Greentide-4") + dur(1, "year"), "y")', ctx),
		).toBe("313");
		expect(
			evaluateExpression(
				'durationformat(date("aether:314-Greentide-4") - date("aether:312-Greentide-4"), "y\' years\'")',
				ctx,
			),
		).toBe("2 years");

		expect(
			evaluateExpression(
				'durationformat(date("aether:314-Greentide-4") - birthDate, "y\' years\'")',
				ctx,
			),
		).toBe("2 years");
		// Smoke Case 2b — bare y must be fantasy years (2), not Gregorian component (0)
		expect(
			evaluateExpression(
				'durationformat(date("aether:314-Greentide-4") - date(birthDate), "y")',
				ctx,
			),
		).toBe("2");
		expect(
			evaluateExpression(
				'durationformat(date("aether:314-Greentide-4") - date(birthDate))',
				ctx,
			),
		).toContain("2 year");
	});

	it("Case 2b: plain frontmatter object still tags calendarId on date−date", () => {
		setEpochsApiForTests(makeMockEpochs());
		const ctx = createTestContext({
			fields: {
				// Not pre-coerced — arithmetic must call fnDate / Epochs parse
				birthDate: {
					calendar: "aether",
					year: 312,
					month: "Greentide",
					day: 4,
				},
			},
		});
		expect(
			evaluateExpression(
				'durationformat(date("aether:314-Greentide-4") - birthDate, "y")',
				ctx,
			),
		).toBe("2");
	});
});

describe("P3 case 3 — monthless year-day", () => {
	it("parses spiral:year-day and formats without months", () => {
		setEpochsApiForTests(makeMockEpochs());
		const fm = coerceYamlDate({ calendar: "spiral", year: 50, day: 120 });
		expect(isPqDate(fm) && fm.calendarId).toBe("spiral");
		expect(dateformat(fm, "d, y G")).toBe("120, 50 Spiral Age");
		expect(dateformat(fnDate("spiral:50-120")!, "d, y")).toBe("120, 50");
		expect(dateformat(fm, "MMMM")).toBe("");
	});
});

describe("P3 case 4 — missing Epochs", () => {
	it("fantasy dates format empty; Gregorian still works", () => {
		setEpochsApiForTests(null);
		expect(fnDate("aether:312-Greentide-4")).toBeNull();
		expect(coerceYamlDate({ calendar: "aether", year: 312, month: "Greentide", day: 4 })).toBeNull();
		expect(dateformat(fnDate("2020-01-15")!, "yyyy-MM-dd")).toBe("2020-01-15");
	});
});
