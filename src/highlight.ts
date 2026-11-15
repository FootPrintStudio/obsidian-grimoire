/** Token span for syntax highlighting (lenient — never throws on partial input). */
export interface HighlightSegment {
	type: HighlightClass;
	start: number;
	end: number;
	text: string;
}

export type HighlightClass =
	| "prefix"
	| "kw"
	| "string"
	| "number"
	| "ident"
	| "fn"
	| "op"
	| "punct"
	| "text";

const KEYWORDS = new Set(["true", "false", "null", "none", "and", "or", "not", "as"]);

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function isIdentStart(c: string): boolean {
	return /[A-Za-z_]/.test(c);
}

function isIdentPart(c: string): boolean {
	return /[A-Za-z0-9_]/.test(c);
}

function punctClass(char: string): HighlightClass {
	return "punct";
}

/** Lenient tokenizer with source spans for highlight / editor decorations. */
export function tokenizeForHighlight(input: string): HighlightSegment[] {
	const segments: HighlightSegment[] = [];
	let i = 0;

	const push = (type: HighlightClass, start: number, end: number) => {
		if (end <= start) return;
		segments.push({ type, start, end, text: input.slice(start, end) });
	};

	while (i < input.length) {
		const start = i;
		const c = input[i]!;

		if (/\s/.test(c)) {
			i++;
			while (i < input.length && /\s/.test(input[i]!)) i++;
			push("text", start, i);
			continue;
		}

		if (c === '"' || c === "'") {
			const quote = c;
			i++;
			while (i < input.length) {
				if (input[i] === "\\" && i + 1 < input.length) {
					i += 2;
					continue;
				}
				if (input[i] === quote) {
					i++;
					break;
				}
				i++;
			}
			push("string", start, i);
			continue;
		}

		// Bare wiki primary `[[…]]` — highlight as string-like.
		if (c === "[" && input[i + 1] === "[") {
			i += 2;
			while (i < input.length) {
				if (input[i] === "]" && input[i + 1] === "]") {
					i += 2;
					break;
				}
				i++;
			}
			push("string", start, i);
			continue;
		}

		if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(input[i + 1] ?? ""))) {
			i++;
			while (i < input.length && /[0-9.]/.test(input[i]!)) i++;
			push("number", start, i);
			continue;
		}

		if (isIdentStart(c)) {
			i++;
			while (i < input.length && isIdentPart(input[i]!)) i++;
			const text = input.slice(start, i);
			const lower = text.toLowerCase();
			push(KEYWORDS.has(lower) ? "kw" : "ident", start, i);
			continue;
		}

		const two = input.slice(i, i + 2);
		if (["==", "!=", "<=", ">=", "&&", "||"].includes(two)) {
			push("op", i, i + 2);
			i += 2;
			continue;
		}

		if (c === "!" || c === "@") {
			push("op", i, i + 1);
			i++;
			continue;
		}

		if ("(){}[],".includes(c)) {
			push(punctClass(c), i, i + 1);
			i++;
			continue;
		}

		if ("+-*/<>=/%".includes(c)) {
			push("op", i, i + 1);
			i++;
			continue;
		}

		// Unknown character — keep as plain text
		i++;
		push("text", start, i);
	}

	markFunctionCalls(segments, input);
	return segments;
}

function nextNonTextIndex(segments: HighlightSegment[], from: number): number {
	for (let j = from + 1; j < segments.length; j++) {
		const s = segments[j]!;
		if (s.type !== "text") return j;
	}
	return -1;
}

function markFunctionCalls(segments: HighlightSegment[], input: string): void {
	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i]!;
		if (seg.type !== "ident") continue;
		const nextIdx = nextNonTextIndex(segments, i);
		if (nextIdx === -1) continue;
		if (segments[nextIdx]!.text === "(") {
			seg.type = "fn";
		}
	}
}

export function cssClassForHighlight(type: HighlightClass): string {
	return `pq-hl-${type}`;
}

export function highlightExpressionHtml(prefix: string, expr: string): string {
	const prefixHtml = `<span class="${cssClassForHighlight("prefix")}">${escapeHtml(prefix)}</span>`;
	if (!expr.trim()) return prefixHtml;

	const segments = tokenizeForHighlight(expr);
	let html = prefixHtml;
	for (const seg of segments) {
		html += `<span class="${cssClassForHighlight(seg.type)}">${escapeHtml(seg.text)}</span>`;
	}
	return html;
}

export interface TokenDecoration {
	from: number;
	to: number;
	className: string;
}

/** Build CM6 mark decorations for expression text starting at docOffset. */
export function getExpressionDecorations(
	expr: string,
	docOffset: number,
): TokenDecoration[] {
	const out: TokenDecoration[] = [];
	for (const seg of tokenizeForHighlight(expr)) {
		out.push({
			from: docOffset + seg.start,
			to: docOffset + seg.end,
			className: cssClassForHighlight(seg.type),
		});
	}
	return out;
}

/** Prefix decoration span before expression body. */
export function getPrefixDecoration(
	prefix: string,
	docOffset: number,
): TokenDecoration {
	return {
		from: docOffset,
		to: docOffset + prefix.length,
		className: cssClassForHighlight("prefix"),
	};
}

export function splitPrefixExpression(
	codeText: string,
	prefix: string,
): { prefixPart: string; expr: string; exprStart: number } | null {
	const trimmed = codeText.trim();
	if (!trimmed.startsWith(prefix)) return null;
	const leadWs = codeText.length - codeText.trimStart().length;
	const prefixStart = leadWs;
	const exprStart = prefixStart + prefix.length;
	const expr = codeText.slice(exprStart);
	return { prefixPart: prefix, expr, exprStart };
}

/** Alias matching plan/docs naming for the lenient highlight tokenizer. */
export const tokenizeExpression = tokenizeForHighlight;
