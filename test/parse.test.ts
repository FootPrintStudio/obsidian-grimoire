import { describe, expect, it } from "vitest";
import { parseExpression, parseQuery } from "../src/parse";
import { parseRenderStyleName } from "../src/renderStyle";

describe("parse logical operators", () => {
	it("parses or as a keyword", () => {
		const ast = parseExpression("false or true");
		expect(ast.kind).toBe("binary");
		if (ast.kind === "binary") {
			expect(ast.op).toBe("or");
		}
	});

	it("parses and as a keyword", () => {
		const ast = parseExpression("false and true");
		expect(ast.kind).toBe("binary");
		if (ast.kind === "binary") {
			expect(ast.op).toBe("and");
		}
	});

	it("parses || as an operator token", () => {
		const ast = parseExpression("false || true");
		expect(ast.kind).toBe("binary");
		if (ast.kind === "binary") {
			expect(ast.op).toBe("or");
		}
	});
});

describe("parseQuery AS style", () => {
	it("returns plain AST when AS is omitted", () => {
		const ast = parseQuery("title");
		expect(ast.kind).toBe("ident");
	});

	it("parses AS card after an expression as a styled node", () => {
		const ast = parseQuery(
			'default(characterStatus, "<font color=\\"#595959\\">Alive, Dead, Undead.</font>") AS card',
		);
		expect(ast.kind).toBe("styled");
		if (ast.kind === "styled") {
			expect(ast.style).toBe("cards");
			expect(ast.expr.kind).toBe("call");
		}
	});

	it("accepts cards, tags, button, hyphenated cards-code, inline, and list", () => {
		const expectStyled = (source: string, style: string) => {
			const ast = parseQuery(source);
			expect(ast.kind).toBe("styled");
			if (ast.kind === "styled") expect(ast.style).toBe(style);
		};
		expectStyled("tags AS cards", "cards");
		expectStyled("file.tags AS tag", "tags");
		expectStyled("file.tags AS tags", "tags");
		expectStyled("parent AS button", "button");
		expectStyled("cssclasses AS cards-code", "cards-code");
		expectStyled("tags AS code", "cards-code");
		expectStyled("tags AS inline", "inline");
		expectStyled("bodyParts AS list", "list");
	});

	it("treats as as an identifier when followed by AS card", () => {
		const ast = parseQuery("as AS card");
		expect(ast.kind).toBe("styled");
		if (ast.kind === "styled") {
			expect(ast.style).toBe("cards");
			expect(ast.expr.kind).toBe("ident");
			if (ast.expr.kind === "ident") expect(ast.expr.name).toBe("as");
		}
	});

	it("is case-insensitive for AS", () => {
		const ast = parseQuery("title as CARD");
		expect(ast.kind).toBe("styled");
		if (ast.kind === "styled") expect(ast.style).toBe("cards");
	});

	it("parses AS inside call arguments and parentheses", () => {
		const nested = parseExpression('default(location AS card, "*Unknown*")');
		expect(nested.kind).toBe("call");
		if (nested.kind === "call") {
			expect(nested.args[0]?.kind).toBe("styled");
			if (nested.args[0]?.kind === "styled") expect(nested.args[0].style).toBe("cards");
			expect(nested.args[1]?.kind).toBe("literal");
		}

		const paren = parseExpression('"At: " + (location AS card)');
		expect(paren.kind).toBe("binary");
		if (paren.kind === "binary") {
			expect(paren.right.kind).toBe("styled");
			if (paren.right.kind === "styled") expect(paren.right.style).toBe("cards");
		}
	});

	it("rejects unknown styles and leftover tokens", () => {
		expect(() => parseQuery("title AS banana")).toThrow(/Unknown style/);
		expect(() => parseQuery("title extra")).toThrow(/Unexpected token/);
		expect(() => parseQuery("title AS")).toThrow(/Expected identifier/);
	});
});

describe("parseRenderStyleName", () => {
	it("maps aliases", () => {
		expect(parseRenderStyleName("card")).toBe("cards");
		expect(parseRenderStyleName("tag")).toBe("tags");
		expect(parseRenderStyleName("tags")).toBe("tags");
		expect(parseRenderStyleName("buttons")).toBe("button");
		expect(parseRenderStyleName("codecard")).toBe("cards-code");
	});
});
