import { moment } from "obsidian";
import { getEpochsApi } from "./epochsBridge";
import type { PqDate, PqDuration, Value } from "./types";

export function isPqDate(value: Value): value is PqDate {
	return typeof value === "object" && value !== null && "__pqDate" in value && value.__pqDate === true;
}

export function isPqDuration(value: Value): value is PqDuration {
	return typeof value === "object" && value !== null && "__pqDuration" in value && value.__pqDuration === true;
}

export function pqDate(ms: number, calendarId?: string): PqDate {
	if (calendarId) return { __pqDate: true, ms, calendarId };
	return { __pqDate: true, ms };
}

export function pqDuration(
	ms: number,
	calendar?: ReadonlyArray<{ amount: number; unit: string }>,
): PqDuration {
	if (calendar?.length) return { __pqDuration: true, ms, calendar };
	return { __pqDuration: true, ms };
}

function applyDurationToMoment(m: moment.Moment, dur: PqDuration, sign: 1 | -1): moment.Moment {
	if (dur.calendar?.length) {
		let result = m;
		for (const part of dur.calendar) {
			result =
				sign === 1
					? result.add(part.amount, part.unit as moment.unitOfTime.DurationConstructor)
					: result.subtract(part.amount, part.unit as moment.unitOfTime.DurationConstructor);
		}
		return result;
	}
	return sign === 1 ? m.add(dur.ms, "milliseconds") : m.subtract(dur.ms, "milliseconds");
}

export function toMoment(value: Value): moment.Moment | null {
	if (isPqDate(value)) return moment(value.ms);
	if (value instanceof Date) return moment(value);
	if (typeof value === "string" && value.trim()) {
		const trimmed = value.trim();
		if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed) && !/^\d{10,}$/.test(trimmed)) {
			return null;
		}
		const m = moment(trimmed);
		return m.isValid() ? m : null;
	}
	return null;
}

export function toPqDate(value: Value): PqDate | null {
	if (isPqDate(value)) return value;
	const m = toMoment(value);
	return m ? pqDate(m.valueOf()) : null;
}

export function toPqDuration(value: Value): PqDuration | null {
	if (isPqDuration(value)) return value;
	return null;
}

/** English ordinal suffix for a whole number (1 → st, 2 → nd, …). */
export function ordinalSuffix(n: number): string {
	const v = Math.abs(Math.trunc(n)) % 100;
	if (v >= 11 && v <= 13) return "th";
	switch (v % 10) {
		case 1:
			return "st";
		case 2:
			return "nd";
		case 3:
			return "rd";
		default:
			return "th";
	}
}

/**
 * Map Luxon-style tokens to moment format tokens.
 * Day + `O` (e.g. `ddO`, `dO`) becomes moment `Do` (ordinal day).
 */
export function normalizeFormatTokens(format: string): string {
	return format
		.replace(/(dd|DD|d|D)O/g, "Do")
		.replace(/yyyy/g, "YYYY")
		.replace(/yy(?![y])/g, "YY")
		.replace(/dd/g, "DD")
		.replace(/d(?![dDo])/g, "D")
		.replace(/HH/g, "HH")
		.replace(/mm/g, "mm")
		.replace(/ss/g, "ss");
}

export function dateformat(value: Value, format: string): string {
	if (isPqDate(value) && value.calendarId) {
		const api = getEpochsApi();
		if (api) {
			const out = api.formatDate(value.ms, value.calendarId, format);
			if (out) return out;
		}
		return "";
	}
	const m = toMoment(value);
	if (!m) return "";
	return m.format(normalizeFormatTokens(format));
}

interface DurationComponents {
	years: number;
	months: number;
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
	milliseconds: number;
}

function durationComponents(ms: number): DurationComponents {
	const d = moment.duration(ms);
	return {
		years: d.years(),
		months: d.months(),
		days: d.days(),
		hours: d.hours(),
		minutes: d.minutes(),
		seconds: d.seconds(),
		milliseconds: d.milliseconds(),
	};
}

function padDuration(n: number, width: number): string {
	return String(Math.trunc(n)).padStart(width, "0");
}

/** Luxon/Dataview-style duration tokens (not the same as dateformat date tokens). */
export function formatDurationWithTokens(ms: number, format: string): string {
	const p = durationComponents(ms);
	const tokenRe =
		/yyyyO|yyO|yO|MMMM|MMM|SSS|SS|MMO|MO|mmO|mO|ddO|dO|HHO|hhO|hO|ssO|sO|yyyy|yy|MM|mm|dd|HH|hh|ss|y|M|d|h|m|s|S/g;

	const withOrdinal = (n: number, padded: string, ordinal: boolean): string =>
		ordinal ? `${padded}${ordinalSuffix(n)}` : padded;

	const monthName = (width: "MMMM" | "MMM"): string => {
		const idx = ((p.months % 12) + 12) % 12;
		return width === "MMMM" ? moment.months(idx) : moment.monthsShort(idx);
	};

	const replaceTokens = (segment: string): string =>
		segment.replace(tokenRe, (token) => {
			switch (token) {
				case "yyyyO":
					return withOrdinal(p.years, padDuration(p.years, 4), true);
				case "yyyy":
					return padDuration(p.years, 4);
				case "yyO":
					return withOrdinal(p.years % 100, padDuration(p.years % 100, 2), true);
				case "yy":
					return padDuration(p.years % 100, 2);
				case "yO":
					return withOrdinal(p.years, String(p.years), true);
				case "y":
					return String(p.years);
				case "MMMM":
					return monthName("MMMM");
				case "MMM":
					return monthName("MMM");
				case "MMO":
					return withOrdinal(p.months, padDuration(p.months, 2), true);
				case "MM":
					return padDuration(p.months, 2);
				case "MO":
					return withOrdinal(p.months, String(p.months), true);
				case "M":
					return String(p.months);
				case "ddO":
					return withOrdinal(p.days, padDuration(p.days, 2), true);
				case "dd":
					return padDuration(p.days, 2);
				case "dO":
					return withOrdinal(p.days, String(p.days), true);
				case "d":
					return String(p.days);
				case "HHO":
				case "hhO":
					return withOrdinal(p.hours, padDuration(p.hours, 2), true);
				case "HH":
				case "hh":
					return padDuration(p.hours, 2);
				case "hO":
					return withOrdinal(p.hours, String(p.hours), true);
				case "h":
					return String(p.hours);
				case "mmO":
					return withOrdinal(p.minutes, padDuration(p.minutes, 2), true);
				case "mm":
					return padDuration(p.minutes, 2);
				case "mO":
					return withOrdinal(p.minutes, String(p.minutes), true);
				case "m":
					return String(p.minutes);
				case "ssO":
					return withOrdinal(p.seconds, padDuration(p.seconds, 2), true);
				case "ss":
					return padDuration(p.seconds, 2);
				case "sO":
					return withOrdinal(p.seconds, String(p.seconds), true);
				case "s":
					return String(p.seconds);
				case "SSS":
					return padDuration(p.milliseconds, 3);
				case "SS":
					return padDuration(Math.floor(p.milliseconds / 10), 2);
				case "S":
					return String(p.milliseconds);
				default:
					return token;
			}
		});

	let result = "";
	let i = 0;
	while (i < format.length) {
		if (format[i] === "'") {
			i++;
			while (i < format.length) {
				if (format[i] === "'") {
					if (format[i + 1] === "'") {
						result += "'";
						i += 2;
					} else {
						i++;
						break;
					}
				} else {
					result += format[i++];
				}
			}
		} else {
			const nextQuote = format.indexOf("'", i);
			const segment =
				nextQuote === -1 ? format.slice(i) : format.slice(i, nextQuote);
			result += replaceTokens(segment);
			i = nextQuote === -1 ? format.length : nextQuote;
		}
	}
	return result;
}

function durationformatHuman(ms: number): string {
	const dur = moment.duration(ms);
	const parts: string[] = [];
	const days = Math.floor(dur.asDays());
	const hours = dur.hours();
	const minutes = dur.minutes();
	if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
	if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
	if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
	if (parts.length === 0) {
		const seconds = Math.round(dur.asSeconds());
		return `${seconds} second${seconds === 1 ? "" : "s"}`;
	}
	return parts.join(", ");
}

export function durationformat(value: Value, format?: string): string {
	if (!isPqDuration(value)) return "";
	// Fantasy duration display when calendar parts carry a calendar hint via last date — not available here.
	// Callers with calendar context use Epochs directly; keep Gregorian human/token path.
	if (format) return formatDurationWithTokens(value.ms, format);
	return durationformatHuman(value.ms);
}

export function resolveDateKeyword(keyword: string): PqDate | null {
	const lower = keyword.trim().toLowerCase();
	if (lower === "now") return pqDate(moment().valueOf());
	if (lower === "today") return pqDate(moment().startOf("day").valueOf());
	return null;
}

export function fnDate(value: Value): PqDate | null {
	if (typeof value === "string") {
		const keyword = resolveDateKeyword(value);
		if (keyword) return keyword;
		const api = getEpochsApi();
		const fantasy = api?.parseDate(value);
		if (fantasy) return pqDate(fantasy.ms, fantasy.calendarId);
	}
	if (value && typeof value === "object" && !isPqDate(value) && !Array.isArray(value)) {
		const api = getEpochsApi();
		const fantasy = api?.parseDate(value);
		if (fantasy) return pqDate(fantasy.ms, fantasy.calendarId);
	}
	return toPqDate(value);
}

export function fnDur(args: Value[]): PqDuration | null {
	if (args.length === 1 && typeof args[0] === "string") {
		const d = moment.duration(args[0]);
		return d.isValid() ? pqDuration(d.asMilliseconds()) : null;
	}
	if (args.length >= 2) {
		const amount = Number(args[0]);
		const unit = String(args[1] ?? "").toLowerCase();
		if (Number.isNaN(amount) || !unit) return null;
		const d = moment.duration(amount, unit as moment.unitOfTime.DurationConstructor);
		return d.isValid()
			? pqDuration(d.asMilliseconds(), [{ amount, unit }])
			: null;
	}
	return null;
}

export function addDateDuration(date: PqDate, dur: PqDuration): PqDate {
	if (date.calendarId && dur.calendar?.length) {
		const api = getEpochsApi();
		if (api) {
			const ms = api.addDuration(date.ms, date.calendarId, dur.calendar, 1);
			return pqDate(ms, date.calendarId);
		}
	}
	return pqDate(
		applyDurationToMoment(moment(date.ms), dur, 1).valueOf(),
		date.calendarId,
	);
}

export function subtractDateDuration(date: PqDate, dur: PqDuration): PqDate {
	if (date.calendarId && dur.calendar?.length) {
		const api = getEpochsApi();
		if (api) {
			const ms = api.addDuration(date.ms, date.calendarId, dur.calendar, -1);
			return pqDate(ms, date.calendarId);
		}
	}
	return pqDate(
		applyDurationToMoment(moment(date.ms), dur, -1).valueOf(),
		date.calendarId,
	);
}

export function subtractDates(a: PqDate, b: PqDate): PqDuration {
	return pqDuration(moment(a.ms).diff(moment(b.ms)));
}

export function addDurations(a: PqDuration, b: PqDuration): PqDuration {
	const calendar = [...(a.calendar ?? []), ...(b.calendar ?? [])];
	return pqDuration(a.ms + b.ms, calendar.length ? calendar : undefined);
}

export function subtractDurations(a: PqDuration, b: PqDuration): PqDuration {
	return pqDuration(a.ms - b.ms);
}

export function scaleDuration(dur: PqDuration, factor: number): PqDuration {
	return pqDuration(dur.ms * factor);
}

export function compareValues(a: Value, b: Value): number {
	const da = toPqDate(a);
	const db = toPqDate(b);
	if (da && db) return da.ms - db.ms;
	const dura = toPqDuration(a);
	const durb = toPqDuration(b);
	if (dura && durb) return dura.ms - durb.ms;
	if (typeof a === "number" && typeof b === "number") return a - b;
	return String(a ?? "").localeCompare(String(b ?? ""));
}

export function coerceYamlDate(value: unknown): Value {
	if (value === null || value === undefined) return null;

	const api = getEpochsApi();
	if (api) {
		if (typeof value === "string" && value.includes(":")) {
			const fantasy = api.parseDate(value);
			if (fantasy) return pqDate(fantasy.ms, fantasy.calendarId);
		}
		if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
			const fantasy = api.parseDate(value);
			if (fantasy) return pqDate(fantasy.ms, fantasy.calendarId);
		}
	}

	if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
		const m = moment(value);
		if (m.isValid()) return pqDate(m.valueOf());
	}
	if (value instanceof Date) return pqDate(value.getTime());
	return null;
}

/**
 * Age from `date` until now.
 * - No format → whole years (number).
 * - With format → duration/date token pipeline via `formatDurationWithTokens`
 *   (e.g. `"MM"` months, `"dd"` days, `"MMMM dd, yyyy"` calendar-style components).
 */
export function fnAge(value: Value, format?: string): Value {
	const birth = toMoment(value);
	if (!birth) return null;
	const now = moment();
	if (!format) return now.diff(birth, "years");
	const ms = Math.max(0, now.diff(birth));
	return formatDurationWithTokens(ms, format);
}

/** Format a number with a simple 0/0.00/% pattern (moment-adjacent stats formatting). */
export function numberformat(value: Value, pattern: string): string {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n)) return "";
	const raw = pattern.trim() || "0";
	const percent = raw.includes("%");
	const amount = percent ? n * 100 : n;
	const core = raw.replace(/%/g, "");
	const decimalMatch = core.match(/\.0+/);
	const decimals = decimalMatch ? decimalMatch[0].length - 1 : 0;
	const fixed = amount.toFixed(decimals);
	const withGroup = /0,0|,0/.test(core)
		? Number(fixed).toLocaleString("en-US", {
				minimumFractionDigits: decimals,
				maximumFractionDigits: decimals,
			})
		: fixed;
	return percent ? `${withGroup}%` : withGroup;
}
