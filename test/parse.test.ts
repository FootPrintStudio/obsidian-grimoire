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

	it("accepts cards, tags, badge, and other styles", () => {
		const expectStyled = (source: string, style: string) => {
			const ast = parseQuery(source);
			expect(ast.kind).toBe("styled");
			if (ast.kind === "styled") expect(ast.style).toBe(style);
		};
		expectStyled("tags AS cards", "cards");
		expectStyled("file.tags AS tag", "tags");
		expectStyled("file.tags AS tags", "tags");
		expectStyled("status AS badge", "badge");
		expectStyled("status AS pill", "badge");
		expectStyled("note AS callout", "callout");
		expectStyled("ratio AS progress", "progress");
		expectStyled("rating AS meter", "meter");
		expectStyled("rating AS stars", "meter");
		expectStyled("pageImage AS image", "image");
		expectStyled("pageImage AS img", "image");
		expectStyled("parent AS wiki", "wiki");
		expectStyled("parent AS wikilink", "wiki");
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

describe("brace groups", () => {
	it("parses singleton {Value} as pair with empty false arm", () => {
		const ast = parseExpression('choice(true, {"only"})');
		expect(ast.kind).toBe("call");
		if (ast.kind === "call") {
			expect(ast.args[1]?.kind).toBe("pair");
			if (ast.args[1]?.kind === "pair") {
				expect(ast.args[1].key.kind).toBe("literal");
				expect(ast.args[1].value.kind).toBe("literal");
				if (ast.args[1].value.kind === "literal") expect(ast.args[1].value.value).toBe("");
			}
		}
	});

	it("parses {a, b} as pair and {a, b, c} as tuple", () => {
		const pairAst = parseExpression('choice(true, {"a", "b"})');
		expect(pairAst.kind).toBe("call");
		if (pairAst.kind === "call") expect(pairAst.args[1]?.kind).toBe("pair");

		const tupleAst = parseExpression('inRange({1, 2, 3}, {"a", "b", "c"})');
		expect(tupleAst.kind).toBe("call");
		if (tupleAst.kind === "call") {
			expect(tupleAst.args[0]?.kind).toBe("tuple");
			expect(tupleAst.args[1]?.kind).toBe("tuple");
		}
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

describe("bare wiki and multi-index", () => {
	it("parses [[Note]] as a wiki primary", () => {
		const ast = parseExpression("[[Alice]]");
		expect(ast).toEqual({ kind: "wiki", path: "Alice" });
	});

	it("parses [[folder/Note]].field member chains", () => {
		const ast = parseExpression("[[Characters/Alice]].title");
		expect(ast.kind).toBe("member");
		if (ast.kind === "member") {
			expect(ast.property).toBe("title");
			expect(ast.object).toEqual({ kind: "wiki", path: "Characters/Alice" });
		}
	});

	it("strips wiki display alias before the pipe", () => {
		const ast = parseExpression("[[Alice|Ally]].title");
		expect(ast.kind).toBe("member");
		if (ast.kind === "member" && ast.object.kind === "wiki") {
			expect(ast.object.path).toBe("Alice");
		}
	});

	it("parses multi-index [0,4,5] as an index over a tuple", () => {
		const ast = parseExpression("items[0, 4, 5]");
		expect(ast.kind).toBe("index");
		if (ast.kind === "index") {
			expect(ast.index.kind).toBe("tuple");
			if (ast.index.kind === "tuple") expect(ast.index.elements).toHaveLength(3);
		}
	});
});
