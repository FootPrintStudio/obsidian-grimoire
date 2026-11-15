import { describe, expect, it } from "vitest";
import { classifyInRange, formatFtIn, fnConv, fnInRange, fnInRangeTernary } from "../src/units";
import { createTestContext, evaluateExpression } from "../src/eval";
import { fnDate, fnDur, pqDate, pqDuration } from "../src/dates";
import { parseExpression } from "../src/parse";

describe("conv", () => {
	it("converts length to inches", () => {
		const inches = fnConv(180, "cm", "in") as number;
		expect(inches).toBeCloseTo(70.866, 2);
	});

	it("formats ftin from cm", () => {
		expect(fnConv(180, "cm", "ftin")).toBe("5' 11\"");
		expect(fnConv(183, "cm", "ftin")).toBe("6' 0\"");
	});

	it("converts mass kg to lb", () => {
		expect(fnConv(100, "kg", "lb")).toBeCloseTo(220.462, 2);
	});

	it("converts temperature", () => {
		expect(fnConv(32, "f", "c")).toBeCloseTo(0, 5);
		expect(fnConv(0, "c", "f")).toBeCloseTo(32, 5);
		expect(fnConv(0, "c", "k")).toBeCloseTo(273.15, 2);
	});

	it("rejects cross-category conversion", () => {
		expect(() => fnConv(10, "cm", "lb")).toThrow(/Cannot convert/);
	});

	it("returns null for non-numeric value", () => {
		expect(fnConv("", "cm", "in")).toBeNull();
	});
});

describe("formatFtIn", () => {
	it("rounds inches and carries to feet", () => {
		expect(formatFtIn(71.4)).toBe("5' 11\"");
		expect(formatFtIn(72)).toBe("6' 0\"");
	});
});

describe("inRange", () => {
	it("is inclusive on bounds (boolean)", () => {
		expect(fnInRange(5, 1, 10)).toBe(true);
		expect(fnInRange(1, 1, 10)).toBe(true);
		expect(fnInRange(10, 1, 10)).toBe(true);
		expect(fnInRange(0, 1, 10)).toBe(false);
		expect(fnInRange(11, 1, 10)).toBe(false);
	});

	it("returns false for non-comparable operands (boolean)", () => {
		expect(fnInRange("", 1, 10)).toBe(false);
		expect(fnInRange(5, null, 10)).toBe(false);
		expect(fnInRange(5, pqDate(0), 10)).toBe(false);
	});

	it("classifies below / in / above", () => {
		expect(classifyInRange(0, 1, 10)).toBe("below");
		expect(classifyInRange(1, 1, 10)).toBe("in");
		expect(classifyInRange(5, 1, 10)).toBe("in");
		expect(classifyInRange(10, 1, 10)).toBe("in");
		expect(classifyInRange(11, 1, 10)).toBe("above");
		expect(classifyInRange("", 1, 10)).toBeNull();
	});

	it("classifies dates inclusively by ms order", () => {
		const lo = fnDate("2000-01-01")!;
		const mid = fnDate("2005-06-15")!;
		const hi = fnDate("2010-12-31")!;
		const before = fnDate("1999-12-31")!;
		const after = fnDate("2011-01-01")!;
		expect(classifyInRange(before, lo, hi)).toBe("below");
		expect(classifyInRange(lo, lo, hi)).toBe("in");
		expect(classifyInRange(mid, lo, hi)).toBe("in");
		expect(classifyInRange(hi, lo, hi)).toBe("in");
		expect(classifyInRange(after, lo, hi)).toBe("above");
		expect(fnInRange(mid, lo, hi)).toBe(true);
		expect(fnInRange(before, lo, hi)).toBe(false);
	});

	it("classifies durations inclusively by ms order", () => {
		const lo = fnDur([1, "day"])!;
		const mid = fnDur([3, "days"])!;
		const hi = fnDur([1, "week"])!;
		const short = pqDuration(lo.ms - 1);
		const long = pqDuration(hi.ms + 1);
		expect(classifyInRange(short, lo, hi)).toBe("below");
		expect(classifyInRange(lo, lo, hi)).toBe("in");
		expect(classifyInRange(mid, lo, hi)).toBe("in");
		expect(classifyInRange(hi, lo, hi)).toBe("in");
		expect(classifyInRange(long, lo, hi)).toBe("above");
	});

	it("returns null for mixed / non-comparable types", () => {
		expect(classifyInRange(5, fnDate("2000-01-01")!, 10)).toBeNull();
		expect(classifyInRange(fnDate("2000-01-01")!, 1, 10)).toBeNull();
		expect(classifyInRange(fnDur([1, "day"])!, 1, 10)).toBeNull();
		expect(classifyInRange(fnDate("2000-01-01")!, fnDur([1, "day"])!, fnDate("2010-01-01")!)).toBeNull();
	});

	it("ternary picks the matching branch", () => {
		expect(fnInRangeTernary(0, 1, 10, "lo", "mid", "hi")).toBe("lo");
		expect(fnInRangeTernary(5, 1, 10, "lo", "mid", "hi")).toBe("mid");
		expect(fnInRangeTernary(11, 1, 10, "lo", "mid", "hi")).toBe("hi");
		expect(fnInRangeTernary(null, 1, 10, "lo", "mid", "hi")).toBeNull();
		const lo = fnDate("2000-01-01")!;
		const hi = fnDate("2010-12-31")!;
		expect(fnInRangeTernary(fnDate("1990-01-01")!, lo, hi, "lo", "mid", "hi")).toBe("lo");
		expect(fnInRangeTernary(fnDate("2005-01-01")!, lo, hi, "lo", "mid", "hi")).toBe("mid");
		expect(fnInRangeTernary(fnDate("2020-01-01")!, lo, hi, "lo", "mid", "hi")).toBe("hi");
	});
});

describe("eval integration", () => {
	it("parses ternary brace groups as tuples", () => {
		const ast = parseExpression('inRange({height, 150, 190}, {"lo", "ok", "hi"})');
		expect(ast.kind).toBe("call");
		if (ast.kind === "call") {
			expect(ast.args[0]?.kind).toBe("tuple");
			expect(ast.args[1]?.kind).toBe("tuple");
		}
	});

	it("ternary inRange returns below / in / above branches", () => {
		const ctx = createTestContext({ fields: { height: 175, minHeight: 150, maxHeight: 190 } });
		expect(
			evaluateExpression('inRange({height, 150, 190}, {"short", "OK", "tall"})', ctx),
		).toBe("OK");
		expect(
			evaluateExpression('inRange({height, minHeight, maxHeight}, {"short", "OK", "tall"})', ctx),
		).toBe("OK");
		expect(
			evaluateExpression('inRange({120, 150, 190}, {"short", "OK", "tall"})', ctx),
		).toBe("short");
		expect(
			evaluateExpression('inRange({200, 150, 190}, {"short", "OK", "tall"})', ctx),
		).toBe("tall");
	});

	it("legacy boolean inRange still works with choice", () => {
		const ctx = createTestContext({ fields: { height: 175, minHeight: 150, maxHeight: 190 } });
		expect(evaluateExpression('choice(inRange(height, 150, 190), "OK", "fail")', ctx)).toBe("OK");
		expect(evaluateExpression('choice(inRange(height, minHeight, maxHeight), "OK", "fail")', ctx)).toBe(
			"OK",
		);
		expect(evaluateExpression('choice(inRange(height, 200, 220), "OK", "fail")', ctx)).toBe("fail");
	});

	it("ternary inRange classifies dates and durations", () => {
		const ctx = createTestContext();
		expect(
			evaluateExpression(
				'inRange({date("2005-06-15"), date("2000-01-01"), date("2010-12-31")}, {"before", "in", "after"})',
				ctx,
			),
		).toBe("in");
		expect(
			evaluateExpression(
				'inRange({date("1990-01-01"), date("2000-01-01"), date("2010-12-31")}, {"before", "in", "after"})',
				ctx,
			),
		).toBe("before");
		expect(
			evaluateExpression(
				'inRange({date("2020-01-01"), date("2000-01-01"), date("2010-12-31")}, {"before", "in", "after"})',
				ctx,
			),
		).toBe("after");
		expect(
			evaluateExpression(
				'inRange({dur(3, "days"), dur(1, "day"), dur(1, "week")}, {"short", "ok", "long"})',
				ctx,
			),
		).toBe("ok");
		expect(
			evaluateExpression(
				'inRange({dur(1, "hour"), dur(1, "day"), dur(1, "week")}, {"short", "ok", "long"})',
				ctx,
			),
		).toBe("short");
		expect(
			evaluateExpression(
				'inRange({age(date("2000-01-01")), 18, 65}, {"young", "working", "senior"})',
				ctx,
			),
		).toBe("working");
	});

	it("ternary inRange returns empty for mixed types", () => {
		const ctx = createTestContext({ fields: { height: 175 } });
		expect(
			evaluateExpression(
				'inRange({height, date("2000-01-01"), date("2010-01-01")}, {"a", "b", "c"})',
				ctx,
			),
		).toBeNull();
		expect(
			evaluateExpression('choice(inRange(height, date("2000-01-01"), 10), "OK", "fail")', ctx),
		).toBe("fail");
	});

	it("evaluates conv in expressions", () => {
		expect(evaluateExpression('conv(180, "cm", "ftin")', createTestContext())).toBe('5\' 11"');
		expect(evaluateExpression("conv(180, cm, ftin)", createTestContext())).toBe('5\' 11"');
	});
});
