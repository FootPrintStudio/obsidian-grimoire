import { describe, expect, it } from "vitest";
import {
	cssClassForHighlight,
	getExpressionDecorations,
	highlightExpressionHtml,
	splitPrefixExpression,
	tokenizeForHighlight,
} from "../src/highlight";

describe("tokenizeForHighlight", () => {
	it("covers the full expression with contiguous spans", () => {
		const expr = 'choice(title, "Untitled")';
		const segments = tokenizeForHighlight(expr);
		const covered = segments.map((s) => expr.slice(s.start, s.end)).join("");
		expect(covered).toBe(expr);
	});

	it("classifies keywords and function calls", () => {
		const segments = tokenizeForHighlight('and choice(true, false)');
		expect(segments.find((s) => s.text === "and")?.type).toBe("kw");
		expect(segments.find((s) => s.text === "true")?.type).toBe("kw");
		expect(segments.find((s) => s.text === "choice")?.type).toBe("fn");
		expect(segments.find((s) => s.text === "false")?.type).toBe("kw");
	});

	it("classifies as as a keyword", () => {
		const segments = tokenizeForHighlight("title AS card");
		expect(segments.find((s) => s.text.toLowerCase() === "as")?.type).toBe("kw");
	});

	it("highlights bare [[wiki]] as a string span", () => {
		const expr = "[[Alice]].title";
		const segments = tokenizeForHighlight(expr);
		expect(segments.find((s) => s.text === "[[Alice]]")?.type).toBe("string");
		const covered = segments.map((s) => expr.slice(s.start, s.end)).join("");
		expect(covered).toBe(expr);
	});
});

describe("highlightExpressionHtml", () => {
	it("escapes HTML in strings and angle brackets", () => {
		const html = highlightExpressionHtml("q=", '"<tag>"');
		expect(html).toContain("&quot;&lt;tag&gt;&quot;");
		expect(html).not.toContain("<tag>");
		expect(html).toContain('class="pq-hl-prefix"');
		expect(html).toContain('class="pq-hl-string"');
	});

	it("wraps operators and punctuation", () => {
		const html = highlightExpressionHtml("q=", "numA == 10");
		expect(html).toContain('class="pq-hl-op"');
		expect(html).toContain("==");
	});
});

describe("getExpressionDecorations", () => {
	it("maps token spans to document offsets", () => {
		const decs = getExpressionDecorations("true", 100);
		expect(decs).toHaveLength(1);
		expect(decs[0]).toEqual({
			from: 100,
			to: 104,
			className: cssClassForHighlight("kw"),
		});
	});
});

describe("splitPrefixExpression", () => {
	it("splits prefix from expression body", () => {
		expect(splitPrefixExpression("q= title", "q=")).toEqual({
			prefixPart: "q=",
			expr: " title",
			exprStart: 2,
		});
	});

	it("returns null when prefix is missing", () => {
		expect(splitPrefixExpression("title", "q=")).toBeNull();
	});
});
