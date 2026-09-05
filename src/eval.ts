import {
	coerceForConcat,
	flattenFragmentParts,
	isPqFragments,
	isPqStyled,
	isWildcardKey,
	pqFragments,
	pqStyled,
	unwrapForTruthiness,
	valueToPlainString,
	valuesEqual,
} from "./coerce";
import {
	addDateDuration,
	addDurations,
	compareValues,
	dateformat,
	durationformat,
	fnDate,
	fnDur,
	isPqDate,
	isPqDuration,
	pqDate,
	resolveDateKeyword,
	scaleDuration,
	subtractDateDuration,
	subtractDates,
	subtractDurations,
	toPqDate,
	toPqDuration,
} from "./dates";
import { getMemberValue, getFileField, resolveIdent } from "./context";
import { parseExpression, parseQuery } from "./parse";
import type { AstNode, FileMeta, QueryContext, Value } from "./types";

function isTruthy(value: Value): boolean {
	const inner = unwrapForTruthiness(value);
	if (inner === null || inner === undefined || inner === false) return false;
	if (inner === "") return false;
	if (Array.isArray(inner)) return inner.length > 0;
	return true;
}

function fnDefault(value: Value, fallback: Value): Value {
	if (!isTruthy(value)) return fallback;
	const inner = unwrapForTruthiness(value);
	if (Array.isArray(inner) && inner.length === 0) return fallback;
	return value;
}

function fnChoice(cond: Value, ifTrue: Value, ifFalse: Value): Value {
	return isTruthy(cond) ? ifTrue : ifFalse;
}

function fnAny(...args: Value[]): boolean {
	if (args.length === 0) return false;
	if (args.length === 1) return isTruthy(args[0]);
	const hay = args[0]!;
	const needles = args.slice(1);
	return needles.some((needle) => fnEcontains(hay, needle));
}

function fnContains(hay: Value, needle: Value): boolean {
	const h = unwrapForTruthiness(hay);
	const n = unwrapForTruthiness(needle);
	if (h === null || n === null) return false;
	if (typeof h === "string" && typeof n === "string") return h.includes(n);
	if (Array.isArray(h)) {
		return h.some((item) => {
			if (typeof item === "string" && typeof n === "string") return item.includes(n);
			return valuesEqual(item, n);
		});
	}
	return false;
}

function fnEcontains(hay: Value, needle: Value): boolean {
	const h = unwrapForTruthiness(hay);
	const n = unwrapForTruthiness(needle);
	if (h === null || n === null) return false;
	if (typeof h === "string" && typeof n === "string") return h.includes(n);
	if (Array.isArray(h)) return h.some((item) => valuesEqual(item, n));
	if (
		typeof h === "object" &&
		!isPqDate(h) &&
		!isPqDuration(h) &&
		!isPqStyled(h) &&
		!isPqFragments(h) &&
		typeof n === "string"
	) {
		return Object.prototype.hasOwnProperty.call(h, n);
	}
	return false;
}

function fnSlice(list: Value, start: Value, end?: Value): Value {
	const inner = unwrapForTruthiness(list);
	if (!Array.isArray(inner)) return [];
	const s = Number(start);
	const e = end === undefined ? inner.length : Number(end);
	return inner.slice(s, e);
}

function fnLength(value: Value): number {
	const inner = unwrapForTruthiness(value);
	if (inner === null) return 0;
	if (typeof inner === "string" || Array.isArray(inner)) return inner.length;
	return 0;
}

function fnCoalesce(...args: Value[]): Value {
	for (const arg of args) {
		if (isTruthy(arg)) return arg;
	}
	return null;
}

function fnJoin(list: Value, sep: Value): string {
	const inner = unwrapForTruthiness(list);
	if (!Array.isArray(inner)) return valueToPlainString(list);
	return inner.map((v) => coerceForConcat(v)).join(String(sep ?? ", "));
}

function evalSelect(args: AstNode[], ctx: QueryContext): Value {
	if (args.length < 2) throw new Error("select() requires a key and at least one {key, value} pair");
	const lookup = evalNode(args[0]!, ctx);
	let fallback: Value | null = null;

	for (let i = 1; i < args.length; i++) {
		const arg = args[i]!;
		if (arg.kind !== "pair") {
			throw new Error("select() arguments after the key must be {key, value} pairs");
		}
		const pairKey = evalNode(arg.key, ctx);
		const pairValue = evalNode(arg.value, ctx);
		if (isWildcardKey(unwrapForTruthiness(pairKey))) {
			fallback = pairValue;
			continue;
		}
		if (valuesEqual(pairKey, lookup)) return pairValue;
	}
	return fallback;
}

function resolveMemberNode(node: AstNode, ctx: QueryContext): Value {
	if (node.kind === "ident") {
		if (node.name === "file") return ctx.file as unknown as Value;
		return resolveIdent(node.name, ctx);
	}
	if (node.kind === "member") {
		if (node.object.kind === "ident" && node.object.name === "this" && node.property === "file") {
			return ctx.file as unknown as Value;
		}
		if (node.object.kind === "ident" && node.object.name === "file") {
			return getFileField(ctx.file, node.property);
		}
		if (
			node.object.kind === "member" &&
			node.object.object.kind === "ident" &&
			node.object.object.name === "this" &&
			node.object.property === "file"
		) {
			return getFileField(ctx.file, node.property);
		}
		const base = evalNode(node.object, ctx);
		return getMemberValue(base, node.property);
	}
	return evalNode(node, ctx);
}

function hasStyledOrFragments(value: Value): boolean {
	return isPqStyled(value) || isPqFragments(value);
}

function addValues(a: Value, b: Value): Value {
	if (hasStyledOrFragments(a) || hasStyledOrFragments(b)) {
		return pqFragments([...flattenFragmentParts(a), ...flattenFragmentParts(b)]);
	}

	const da = toPqDate(a);
	const db = toPqDate(b);
	const dura = toPqDuration(a);
	const durb = toPqDuration(b);

	if (da && durb) return addDateDuration(da, durb);
	if (dura && durb) return addDurations(dura, durb);
	if (typeof a === "string" || typeof b === "string") {
		return coerceForConcat(a) + coerceForConcat(b);
	}
	if (typeof a === "number" && typeof b === "number") return a + b;
	return coerceForConcat(a) + coerceForConcat(b);
}

function subtractValues(a: Value, b: Value): Value {
	const ua = unwrapForTruthiness(a);
	const ub = unwrapForTruthiness(b);
	const da = toPqDate(ua);
	const db = toPqDate(ub);
	const dura = toPqDuration(ua);
	const durb = toPqDuration(ub);

	if (da && db) return subtractDates(da, db);
	if (da && durb) return subtractDateDuration(da, durb);
	if (dura && durb) return subtractDurations(dura, durb);
	return (Number(ua) || 0) - (Number(ub) || 0);
}

function multiplyValues(a: Value, b: Value): Value {
	const ua = unwrapForTruthiness(a);
	const ub = unwrapForTruthiness(b);
	const dura = toPqDuration(ua);
	const durb = toPqDuration(ub);
	if (dura && typeof ub === "number") return scaleDuration(dura, ub);
	if (durb && typeof ua === "number") return scaleDuration(durb, ua);
	return (Number(ua) || 0) * (Number(ub) || 0);
}

function divideValues(a: Value, b: Value): Value {
	const ua = unwrapForTruthiness(a);
	const ub = unwrapForTruthiness(b);
	const dura = toPqDuration(ua);
	if (dura && typeof ub === "number" && ub !== 0) return scaleDuration(dura, 1 / ub);
	return (Number(ua) || 0) / (Number(ub) || 1);
}

function compareOp(op: string, left: Value, right: Value): Value {
	const cmp = compareValues(unwrapForTruthiness(left), unwrapForTruthiness(right));
	switch (op) {
		case "==":
			return valuesEqual(left, right);
		case "!=":
			return !valuesEqual(left, right);
		case "<":
			return cmp < 0;
		case ">":
			return cmp > 0;
		case "<=":
			return cmp <= 0;
		case ">=":
			return cmp >= 0;
		default:
			return false;
	}
}

function evalNode(node: AstNode, ctx: QueryContext): Value {
	switch (node.kind) {
		case "literal":
			return node.value;
		case "pair":
			return evalNode(node.value, ctx);
		case "ident":
			return resolveIdent(node.name, ctx);
		case "member":
			return resolveMemberNode(node, ctx);
		case "index": {
			const base = evalNode(node.object, ctx);
			const indexVal = evalNode(node.index, ctx);
			const inner = unwrapForTruthiness(base);
			if (Array.isArray(inner)) {
				const idx = Number(unwrapForTruthiness(indexVal));
				return !Number.isNaN(idx) ? (inner[idx] ?? null) : null;
			}
			return null;
		}
		case "styled":
			return pqStyled(evalNode(node.expr, ctx), node.style);
		case "unary": {
			const v = evalNode(node.arg, ctx);
			if (node.op === "not") return !isTruthy(v);
			if (node.op === "-") return -(Number(unwrapForTruthiness(v)) || 0);
			return null;
		}
		case "binary": {
			const left = evalNode(node.left, ctx);
			const right = evalNode(node.right, ctx);
			switch (node.op) {
				case "+":
					return addValues(left, right);
				case "-":
					return subtractValues(left, right);
				case "*":
					return multiplyValues(left, right);
				case "/":
					return divideValues(left, right);
				case "%":
					return (Number(unwrapForTruthiness(left)) || 0) % (Number(unwrapForTruthiness(right)) || 1);
				case "==":
				case "!=":
				case "<":
				case ">":
				case "<=":
				case ">=":
					return compareOp(node.op, left, right);
				case "and":
				case "&&":
					return isTruthy(left) && isTruthy(right);
				case "or":
				case "||":
					return isTruthy(left) || isTruthy(right);
				default:
					return null;
			}
		}
		case "call": {
			const name = node.callee.toLowerCase();
			if (name === "select") return evalSelect(node.args, ctx);
			const args = node.args.map((arg) => evalNode(arg, ctx));
			const fn = FUNCTION_MAP[name];
			if (!fn) throw new Error(`Unknown function "${node.callee}"`);
			return fn(args, node.args);
		}
		default:
			return null;
	}
}

type Fn = (args: Value[], rawArgs?: AstNode[]) => Value;

const FUNCTION_MAP: Record<string, Fn> = {
	default: ([a, b]) => fnDefault(a, b),
	choice: ([c, a, b]) => fnChoice(c, a, b),
	any: (args) => fnAny(...args),
	contains: ([a, b]) => fnContains(a, b),
	econtains: ([a, b]) => fnEcontains(a, b),
	slice: ([list, start, end]) => fnSlice(list, start, end),
	dateformat: ([d, fmt]) => dateformat(d, String(fmt ?? "")),
	durationformat: ([d, fmt]) => durationformat(d, fmt === undefined ? undefined : String(fmt)),
	length: ([v]) => fnLength(v),
	coalesce: (args) => fnCoalesce(...args),
	join: ([list, sep]) => fnJoin(list, sep),
	date: (args, rawArgs) => {
		const raw = rawArgs?.[0];
		if (raw?.kind === "ident") {
			const keyword = resolveDateKeyword(raw.name);
			if (keyword) return keyword;
		}
		return fnDate(args[0] ?? null) ?? null;
	},
	dur: (args) => fnDur(args) ?? null,
};

export function evaluateExpression(source: string, ctx: QueryContext): Value {
	return evalNode(parseExpression(source), ctx);
}

export function evaluateExpressionSafe(
	source: string,
	ctx: QueryContext,
): { ok: true; value: Value } | { ok: false; error: string } {
	try {
		const ast = parseQuery(source);
		return { ok: true, value: evalNode(ast, ctx) };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
}

export function createTestContext(
	overrides: Partial<QueryContext> & { fields?: Record<string, Value> } = {},
): QueryContext {
	const now = pqDate(Date.now());
	const file: FileMeta = {
		name: "Test",
		path: "Test.md",
		folder: "",
		mtime: now,
		ctime: now,
		size: 0,
		tags: [],
		...overrides.file,
	};
	return {
		fields: overrides.fields ?? {},
		file,
	};
}
