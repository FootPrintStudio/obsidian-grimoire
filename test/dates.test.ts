import { describe, expect, it } from "vitest";
import { moment } from "obsidian";
import {
	addDateDuration,
	addDurations,
	dateformat,
	fnAge,
	fnDate,
	fnDur,
	formatDurationWithTokens,
	numberformat,
	pqDate,
	resolveDateKeyword,
} from "../src/dates";

describe("calendar date arithmetic", () => {
	it("adds dur(n, years) as calendar years not fixed milliseconds", () => {
		const birth = fnDate("2000-01-01")!;
		const twentyFiveYears = fnDur([25, "years"])!;
		expect(twentyFiveYears.calendar).toEqual([{ amount: 25, unit: "years" }]);
		const result = addDateDuration(birth, twentyFiveYears);
		expect(dateformat(result, "yyyy")).toBe("2025");
		expect(dateformat(result, "yyyy-MM-dd")).toBe("2025-01-01");
	});

	it("merges calendar parts when adding durations", () => {
		const merged = addDurations(fnDur([1, "year"])!, fnDur([10, "days"])!);
		const result = addDateDuration(fnDate("2000-01-01")!, merged);
		expect(dateformat(result, "yyyy-MM-dd")).toBe("2001-01-11");
	});
});

describe("date keywords", () => {
	it("resolves now and today keywords", () => {
		const now = resolveDateKeyword("now")!;
		const today = resolveDateKeyword("today")!;
		expect(dateformat(now, "yyyy-MM-dd")).toBe(moment().format("YYYY-MM-DD"));
		expect(dateformat(today, "yyyy-MM-dd")).toBe(moment().startOf("day").format("YYYY-MM-DD"));
	});

	it("parses quoted keywords via fnDate", () => {
		expect(dateformat(fnDate("today")!, "yyyy-MM-dd")).toBe(moment().startOf("day").format("YYYY-MM-DD"));
		expect(dateformat(fnDate("now")!, "yyyy-MM-dd")).toBe(moment().format("YYYY-MM-DD"));
	});
});

describe("ordinals", () => {
	it("formats day ordinals with O in dateformat", () => {
		const d = fnDate("2003-10-03")!;
		expect(dateformat(d, "MMMM ddO, yyyy")).toBe("October 3rd, 2003");
		expect(dateformat(fnDate("2003-10-01")!, "dO")).toBe("1st");
		expect(dateformat(fnDate("2003-10-02")!, "dO")).toBe("2nd");
		expect(dateformat(fnDate("2003-10-11")!, "dO")).toBe("11th");
	});

	it("formats ordinals in durationformat", () => {
		const threeDays = moment.duration(3, "days").asMilliseconds();
		const twoHours = moment.duration(2, "hours").asMilliseconds();
		expect(formatDurationWithTokens(threeDays, "dO")).toBe("3rd");
		expect(formatDurationWithTokens(twoHours, "hO")).toBe("2nd");
	});
});

describe("age", () => {
	it("defaults to whole years", () => {
		const birth = pqDate(moment().subtract(24, "years").subtract(3, "months").valueOf());
		expect(fnAge(birth)).toBe(24);
	});

	it("formats months and days with duration tokens", () => {
		const birth = pqDate(moment().subtract(2, "months").subtract(5, "days").valueOf());
		expect(Number(fnAge(birth, "MM"))).toBeGreaterThanOrEqual(2);
		expect(Number(fnAge(birth, "dd"))).toBeGreaterThanOrEqual(0);
	});
});

describe("numberformat", () => {
	it("formats decimals and percents", () => {
		expect(numberformat(12.345, "0.0")).toBe("12.3");
		expect(numberformat(0.256, "0.0%")).toBe("25.6%");
		expect(numberformat(1234.5, "0,0.0")).toBe("1,234.5");
	});
});
