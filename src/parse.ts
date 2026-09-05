import { parseRenderStyleName } from "./renderStyle";
import type { AstNode, PqDate, PqDuration, Value } from "./types";

type Token =
	| { type: "number"; value: number }
	| { type: "string"; value: string }
	| { type: "ident"; value: string }
	| { type: "op"; value: string }
	| { type: "lparen" }
	| { type: "rparen" }
	| { type: "lbrace" }
	| { type: "rbrace" }
	| { type: "lbracket" }
	| { type: "rbracket" }
	| { type: "comma" }
	| { type: "dot" }
	| { type: "eof" };

function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	const isIdentStart = (c: string): boolean => /[A-Za-z_]/.test(c);
	const isIdentPart = (c: string): boolean => /[A-Za-z0-9_]/.test(c);

	while (i < input.length) {
		const c = input[i]!;
		if (/\s/.test(c)) {
			i++;
			continue;
		}

		if (c === '"' || c === "'") {
			const quote = c;
			i++;
			let value = "";
			while (i < input.length && input[i] !== quote) {
				if (input[i] === "\\" && i + 1 < input.length) {
					value += input[i + 1];
					i += 2;
					continue;
				}
				value += input[i];
				i++;
			}
			i++;
			tokens.push({ type: "string", value });
			continue;
		}

		if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(input[i + 1] ?? ""))) {
			let num = c;
			i++;
			while (i < input.length && /[0-9.]/.test(input[i]!)) {
				num += input[i];
				i++;
			}
			tokens.push({ type: "number", value: Number(num) });
			continue;
		}

		if (isIdentStart(c)) {
			let ident = c;
			i++;
			while (i < input.length && isIdentPart(input[i]!)) {
				ident += input[i];
				i++;
			}
			tokens.push({ type: "ident", value: ident });
			continue;
		}

		const two = input.slice(i, i + 2);
		if (["==", "!=", "<=", ">=", "&&", "||"].includes(two)) {
			tokens.push({ type: "op", value: two });
			i += 2;
			continue;
		}

		if (c === "(") {
			tokens.push({ type: "lparen" });
			i++;
			continue;
		}
		if (c === ")") {
			tokens.push({ type: "rparen" });
			i++;
			continue;
		}
		if (c === "{") {
			tokens.push({ type: "lbrace" });
			i++;
			continue;
		}
		if (c === "}") {
			tokens.push({ type: "rbrace" });
			i++;
			continue;
		}
		if (c === "[") {
			tokens.push({ type: "lbracket" });
			i++;
			continue;
		}
		if (c === "]") {
			tokens.push({ type: "rbracket" });
			i++;
			continue;
		}
		if (c === ",") {
			tokens.push({ type: "comma" });
			i++;
			continue;
		}
		if (c === ".") {
			tokens.push({ type: "dot" });
			i++;
			continue;
		}
		if ("+-*/<>=/%".includes(c)) {
			tokens.push({ type: "op", value: c });
			i++;
			continue;
		}

		throw new Error(`Unexpected character "${c}" at position ${i + 1}`);
	}

	tokens.push({ type: "eof" });
	return tokens;
}

class Parser {
	private pos = 0;

	constructor(private tokens: Token[]) {}

	parseExpression(): AstNode {
		let node = this.parseOr();
		if (this.matchIdent("as")) {
			const style = parseRenderStyleName(this.parseStyleToken());
			node = { kind: "styled", expr: node, style };
		}
		return node;
	}

	private parseOr(): AstNode {
		let node = this.parseAnd();
		while (this.matchIdent("or") || this.matchOp("||")) {
			node = { kind: "binary", op: "or", left: node, right: this.parseAnd() };
		}
		return node;
	}

	private parseAnd(): AstNode {
		let node = this.parseCompare();
		while (this.matchIdent("and") || this.matchOp("&&")) {
			node = { kind: "binary", op: "and", left: node, right: this.parseCompare() };
		}
		return node;
	}

	private parseCompare(): AstNode {
		let node = this.parseAdd();
		while (true) {
			const t = this.peek();
			if (t.type === "op" && ["==", "!=", "<", ">", "<=", ">="].includes(t.value)) {
				const op = t.value;
				this.advance();
				node = { kind: "binary", op, left: node, right: this.parseAdd() };
				continue;
			}
			break;
		}
		return node;
	}

	private parseAdd(): AstNode {
		let node = this.parseMul();
		while (true) {
			const t = this.peek();
			if (t.type === "op" && (t.value === "+" || t.value === "-")) {
				const op = t.value;
				this.advance();
				node = { kind: "binary", op, left: node, right: this.parseMul() };
				continue;
			}
			break;
		}
		return node;
	}

	private parseMul(): AstNode {
		let node = this.parseUnary();
		while (true) {
			const t = this.peek();
			if (t.type === "op" && (t.value === "*" || t.value === "/" || t.value === "%")) {
				const op = t.value;
				this.advance();
				node = { kind: "binary", op, left: node, right: this.parseUnary() };
				continue;
			}
			break;
		}
		return node;
	}

	private parseUnary(): AstNode {
		if (this.matchIdent("not")) {
			return { kind: "unary", op: "not", arg: this.parseUnary() };
		}
		const t = this.peek();
		if (t.type === "op" && t.value === "-") {
			this.advance();
			return { kind: "unary", op: "-", arg: this.parseUnary() };
		}
		return this.parsePostfix();
	}

	private parsePostfix(): AstNode {
		let node = this.parsePrimary();
		while (true) {
			if (this.match({ type: "dot" })) {
				const prop = this.expectIdent();
				node = { kind: "member", object: node, property: prop };
				continue;
			}
			if (this.match({ type: "lbracket" })) {
				const index = this.parseExpression();
				this.expect({ type: "rbracket" });
				node = { kind: "index", object: node, index };
				continue;
			}
			if (this.match({ type: "lparen" })) {
				if (node.kind !== "ident") {
					throw new Error("Invalid function call");
				}
				const args: AstNode[] = [];
				if (!this.match({ type: "rparen" })) {
					do {
						args.push(this.parseExpression());
					} while (this.match({ type: "comma" }));
					this.expect({ type: "rparen" });
				}
				node = { kind: "call", callee: node.name, args };
				continue;
			}
			break;
		}
		return node;
	}

	private parsePrimary(): AstNode {
		const t = this.peek();
		if (t.type === "number") {
			this.advance();
			return { kind: "literal", value: t.value };
		}
		if (t.type === "string") {
			this.advance();
			return { kind: "literal", value: t.value };
		}
		if (t.type === "ident") {
			this.advance();
			const lower = t.value.toLowerCase();
			if (lower === "true") return { kind: "literal", value: true };
			if (lower === "false") return { kind: "literal", value: false };
			if (lower === "null" || lower === "none") return { kind: "literal", value: null };
			return { kind: "ident", name: t.value };
		}
		if (t.type === "op" && t.value === "*") {
			this.advance();
			return { kind: "literal", value: "*" };
		}
		if (this.match({ type: "lbrace" })) {
			const key = this.parseExpression();
			this.expect({ type: "comma" });
			const value = this.parseExpression();
			this.expect({ type: "rbrace" });
			return { kind: "pair", key, value };
		}
		if (this.match({ type: "lparen" })) {
			const expr = this.parseExpression();
			this.expect({ type: "rparen" });
			return expr;
		}
		throw new Error(`Unexpected token in expression near position ${this.pos}`);
	}

	private peek(): Token {
		return this.tokens[this.pos] ?? { type: "eof" };
	}

	private advance(): Token {
		return this.tokens[this.pos++] ?? { type: "eof" };
	}

	private match(partial: Partial<Token>): boolean {
		const t = this.peek();
		for (const [k, v] of Object.entries(partial)) {
			if ((t as Record<string, unknown>)[k] !== v) return false;
		}
		this.advance();
		return true;
	}

	private matchOp(...ops: string[]): boolean {
		const t = this.peek();
		if (t.type === "op" && ops.includes(t.value)) {
			this.advance();
			return true;
		}
		return false;
	}

	private matchIdent(value: string): boolean {
		const t = this.peek();
		if (t.type === "ident" && t.value.toLowerCase() === value.toLowerCase()) {
			this.advance();
			return true;
		}
		return false;
	}

	private expect(partial: Partial<Token>): void {
		if (!this.match(partial)) throw new Error("Unexpected token");
	}

	private expectIdent(): string {
		const t = this.peek();
		if (t.type !== "ident") throw new Error("Expected identifier");
		this.advance();
		return t.value;
	}

	private parseStyleToken(): string {
		const first = this.expectIdent();
		let name = first;
		while (this.matchOp("-")) {
			name += "-" + this.expectIdent();
		}
		return name;
	}

	parseQuery(): AstNode {
		const ast = this.parseExpression();
		if (this.peek().type !== "eof") {
			throw new Error("Unexpected token after expression");
		}
		return ast;
	}
}

export function parseExpression(source: string): AstNode {
	const trimmed = source.trim();
	if (!trimmed) throw new Error("Empty expression");
	const parser = new Parser(tokenize(trimmed));
	return parser.parseExpression();
}

export function parseQuery(source: string): AstNode {
	const trimmed = source.trim();
	if (!trimmed) throw new Error("Empty expression");
	const parser = new Parser(tokenize(trimmed));
	return parser.parseQuery();
}

export function literalString(value: Value): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return value.map(literalString).join(", ");
	if (typeof value === "object") {
		if (value !== null && "__pqDate" in value && (value as PqDate).__pqDate === true) {
			return new Date((value as PqDate).ms).toISOString();
		}
		if (value !== null && "__pqDuration" in value && (value as PqDuration).__pqDuration === true) {
			return `${(value as PqDuration).ms}ms`;
		}
		return JSON.stringify(value);
	}
	return String(value);
}
