import { describe, expect, it } from "vitest";
import { formatFtIn, fnConv, fnInRange } from "../src/units";
import { createTestContext, evaluateExpression } from "../src/eval";

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
	it("is inclusive on bounds", () => {
		expect(fnInRange(5, 1, 10)).toBe(true);
		expect(fnInRange(1, 1, 10)).toBe(true);
		expect(fnInRange(10, 1, 10)).toBe(true);
		expect(fnInRange(0, 1, 10)).toBe(false);
		expect(fnInRange(11, 1, 10)).toBe(false);
	});

	it("returns false for non-numeric operands", () => {
		expect(fnInRange("", 1, 10)).toBe(false);
		expect(fnInRange(5, null, 10)).toBe(false);
	});
});

describe("eval integration", () => {
	it("choice branches on inRange", () => {
		const ctx = createTestContext({ fields: { height: 175, minHeight: 150, maxHeight: 190 } });
		expect(evaluateExpression('choice(inRange(height, 150, 190), "OK", "fail")', ctx)).toBe("OK");
		expect(evaluateExpression('choice(inRange(height, minHeight, maxHeight), "OK", "fail")', ctx)).toBe(
			"OK",
		);
		expect(evaluateExpression('choice(inRange(height, 200, 220), "OK", "fail")', ctx)).toBe("fail");
	});

	it("evaluates conv in expressions", () => {
		expect(evaluateExpression('conv(180, "cm", "ftin")', createTestContext())).toBe('5\' 11"');
		expect(evaluateExpression("conv(180, cm, ftin)", createTestContext())).toBe('5\' 11"');
	});
});
