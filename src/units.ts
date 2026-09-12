import type { Value } from "./types";

type UnitCategory = "length" | "mass" | "temperature";

interface NormalizedUnit {
	category: UnitCategory;
	unit: string;
}

const LENGTH_ALIASES: Record<string, string> = {
	mm: "mm",
	millimeter: "mm",
	millimeters: "mm",
	cm: "cm",
	centimeter: "cm",
	centimeters: "cm",
	m: "m",
	meter: "m",
	meters: "m",
	metre: "m",
	metres: "m",
	in: "in",
	inch: "in",
	inches: "in",
	ft: "ft",
	foot: "ft",
	feet: "ft",
	ftin: "ftin",
};

const MASS_ALIASES: Record<string, string> = {
	g: "g",
	gram: "g",
	grams: "g",
	kg: "kg",
	kilogram: "kg",
	kilograms: "kg",
	lb: "lb",
	lbs: "lb",
	pound: "lb",
	pounds: "lb",
	oz: "oz",
	ounce: "oz",
	ounces: "oz",
};

const TEMP_ALIASES: Record<string, string> = {
	c: "c",
	celsius: "c",
	celcius: "c",
	f: "f",
	fahrenheit: "f",
	k: "k",
	kelvin: "k",
};

function normalizeUnit(raw: string): NormalizedUnit {
	const key = raw.trim().toLowerCase();
	if (key in LENGTH_ALIASES) {
		return { category: "length", unit: LENGTH_ALIASES[key]! };
	}
	if (key in MASS_ALIASES) {
		return { category: "mass", unit: MASS_ALIASES[key]! };
	}
	if (key in TEMP_ALIASES) {
		return { category: "temperature", unit: TEMP_ALIASES[key]! };
	}
	throw new Error(`Unknown unit "${raw.trim()}"`);
}

function toNumber(value: Value): number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "string" && value.trim() === "") return null;
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value === "boolean") return null;
	if (typeof value === "object") return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

/** Length → meters. */
function lengthToMeters(value: number, unit: string): number {
	switch (unit) {
		case "mm":
			return value / 1000;
		case "cm":
			return value / 100;
		case "m":
			return value;
		case "in":
			return value * 0.0254;
		case "ft":
			return value * 0.3048;
		case "ftin":
			throw new Error("Use a numeric length unit (cm, in, ft, …) as the source for conv()");
		default:
			throw new Error(`Unknown length unit "${unit}"`);
	}
}

/** Meters → target length unit (numeric). */
function metersToLength(meters: number, unit: string): number {
	switch (unit) {
		case "mm":
			return meters * 1000;
		case "cm":
			return meters * 100;
		case "m":
			return meters;
		case "in":
			return meters / 0.0254;
		case "ft":
			return meters / 0.3048;
		case "ftin":
			return meters / 0.0254;
		default:
			throw new Error(`Unknown length unit "${unit}"`);
	}
}

/** Format total inches as feet + rounded inches, e.g. 5' 11". */
export function formatFtIn(totalInches: number): string {
	const sign = totalInches < 0 ? -1 : 1;
	const absInches = Math.abs(totalInches);
	let feet = Math.floor(absInches / 12);
	let inches = Math.round(absInches - feet * 12);
	if (inches === 12) {
		feet += 1;
		inches = 0;
	}
	const prefix = sign < 0 ? "-" : "";
	return `${prefix}${feet}' ${inches}"`;
}

/** Mass → kilograms. */
function massToKg(value: number, unit: string): number {
	switch (unit) {
		case "g":
			return value / 1000;
		case "kg":
			return value;
		case "lb":
			return value * 0.45359237;
		case "oz":
			return value * 0.028349523125;
		default:
			throw new Error(`Unknown mass unit "${unit}"`);
	}
}

/** Kilograms → target mass unit. */
function kgToMass(kg: number, unit: string): number {
	switch (unit) {
		case "g":
			return kg * 1000;
		case "kg":
			return kg;
		case "lb":
			return kg / 0.45359237;
		case "oz":
			return kg / 0.028349523125;
		default:
			throw new Error(`Unknown mass unit "${unit}"`);
	}
}

/** Temperature → Celsius. */
function tempToCelsius(value: number, unit: string): number {
	switch (unit) {
		case "c":
			return value;
		case "f":
			return ((value - 32) * 5) / 9;
		case "k":
			return value - 273.15;
		default:
			throw new Error(`Unknown temperature unit "${unit}"`);
	}
}

/** Celsius → target temperature unit. */
function celsiusToTemp(celsius: number, unit: string): number {
	switch (unit) {
		case "c":
			return celsius;
		case "f":
			return (celsius * 9) / 5 + 32;
		case "k":
			return celsius + 273.15;
		default:
			throw new Error(`Unknown temperature unit "${unit}"`);
	}
}

export function fnConv(value: Value, fromRaw: string, toRaw: string): Value {
	const amount = toNumber(value);
	if (amount === null) return null;

	const from = normalizeUnit(fromRaw);
	const to = normalizeUnit(toRaw);

	if (from.category !== to.category) {
		throw new Error(`Cannot convert ${fromRaw.trim()} to ${toRaw.trim()}`);
	}

	switch (from.category) {
		case "length": {
			const meters = lengthToMeters(amount, from.unit);
			if (to.unit === "ftin") {
				const totalInches = metersToLength(meters, "in");
				return formatFtIn(totalInches);
			}
			return metersToLength(meters, to.unit);
		}
		case "mass": {
			const kg = massToKg(amount, from.unit);
			return kgToMass(kg, to.unit);
		}
		case "temperature": {
			const celsius = tempToCelsius(amount, from.unit);
			return celsiusToTemp(celsius, to.unit);
		}
	}
}

export function fnInRange(value: Value, low: Value, high: Value): boolean {
	const n = toNumber(value);
	const lo = toNumber(low);
	const hi = toNumber(high);
	if (n === null || lo === null || hi === null) return false;
	return lo <= n && n <= hi;
}
