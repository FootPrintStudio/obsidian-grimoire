import { isPqDate, isPqDuration } from "./dates";
import { getEpochsApi } from "./epochsBridge";
import type { OutputKind, PqFragments, PqStyled, Value } from "./types";
import type { RenderStyle } from "./renderStyle";

const HTML_TAG = /<[^>]+>/;
const MARKDOWN_HINT = /(\*\*|__|\*|_|!\[|\[\[|^#+\s)/m;

export function isPqStyled(value: Value): value is PqStyled {
	return typeof value === "object" && value !== null && "__pqStyled" in value && value.__pqStyled === true;
}

export function isPqFragments(value: Value): value is PqFragments {
	return (
		typeof value === "object" && value !== null && "__pqFragments" in value && value.__pqFragments === true
	);
}

export function pqStyled(value: Value, style: RenderStyle): PqStyled {
	return { __pqStyled: true, value, style };
}

export function pqFragments(parts: Value[]): PqFragments {
	return { __pqFragments: true, parts };
}

/** Unwrap styled/fragments wrappers for truthiness and comparisons. */
export function unwrapForTruthiness(value: Value): Value {
	if (isPqStyled(value)) return unwrapForTruthiness(value.value);
	if (isPqFragments(value)) {
		const texts = value.parts.map((part) => valueToPlainString(unwrapForTruthiness(part))).join("");
		return texts;
	}
	return value;
}

export function listToDisplay(list: Value[], separator = ", "): string {
	return list
		.map((item) => valueToPlainString(item))
		.filter((s) => s.length > 0)
		.join(separator);
}

export function valueToPlainString(value: Value): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number") return String(value);
	if (typeof value === "string") return value;
	if (isPqDate(value)) {
		if (value.calendarId) {
			const api = getEpochsApi();
			const formatted = api?.formatDate(value.ms, value.calendarId);
			if (formatted) return formatted;
			return "";
		}
		return new Date(value.ms).toISOString();
	}
	if (isPqDuration(value)) return `${value.ms}ms`;
	if (isPqStyled(value)) return valueToPlainString(value.value);
	if (isPqFragments(value)) return value.parts.map((part) => valueToPlainString(part)).join("");
	if (Array.isArray(value)) return listToDisplay(value);
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

export function containsHtmlTag(text: string): boolean {
	return HTML_TAG.test(text);
}

export function valueToStyleItems(value: Value): string[] {
	if (value === null || value === undefined) return [];
	if (isPqStyled(value)) return valueToStyleItems(value.value);
	if (isPqFragments(value)) {
		return value.parts.flatMap((part) => valueToStyleItems(part)).filter((s) => s.length > 0);
	}
	if (Array.isArray(value)) {
		return value.flatMap((item) => valueToStyleItems(item)).filter((s) => s.length > 0);
	}
	const text = valueToPlainString(value).trim();
	if (!text) return [];
	return [text];
}

export function classifyOutput(value: Value): OutputKind {
	if (value === null) return "empty";
	if (isPqStyled(value) || isPqFragments(value)) return "text";
	const text = valueToPlainString(value);
	if (!text) return "empty";
	// Prefer Markdown when both MD markers and HTML tags are present.
	// MarkdownRenderer accepts inline HTML (e.g. <br>), so "**Parent**<br>" stays bold.
	if (MARKDOWN_HINT.test(text)) return "markdown";
	if (typeof value === "string" && (text.includes("[[") || text.includes("!["))) return "markdown";
	if (HTML_TAG.test(text)) return "html";
	return "text";
}

export function coerceForConcat(value: Value): string {
	if (Array.isArray(value)) return listToDisplay(value, ", ");
	return valueToPlainString(value);
}

/** Flatten fragment/styled leaves for mixed concat. */
export function flattenFragmentParts(value: Value): Value[] {
	if (isPqFragments(value)) return value.parts.flatMap((part) => flattenFragmentParts(part));
	return [value];
}

export function valuesEqual(a: Value, b: Value): boolean {
	if (a === b) return true;
	const ua = unwrapForTruthiness(a);
	const ub = unwrapForTruthiness(b);
	if (isPqDate(ua) && isPqDate(ub)) return ua.ms === ub.ms;
	if (isPqDuration(ua) && isPqDuration(ub)) return ua.ms === ub.ms;
	const na = Number(ua);
	const nb = Number(ub);
	if (!Number.isNaN(na) && !Number.isNaN(nb) && String(ua).trim() !== "" && String(ub).trim() !== "") {
		return na === nb;
	}
	return String(ua ?? "") === String(ub ?? "");
}

export function isWildcardKey(key: Value): boolean {
	return key === "*" || key === "default" || key === "_";
}
