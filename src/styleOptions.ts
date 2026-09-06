import type { PropertyQuerySettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

function parseTriggerList(raw: string): string[] {
	return raw
		.split(/[,;\n]+/)
		.map((part) => part.trim().toLowerCase())
		.filter(Boolean);
}

function textMatchesTrigger(text: string, keyword: string): boolean {
	if (!keyword) return false;
	const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	// Word boundaries so "dead" does not match "undead".
	return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

/** Maps badge/pill text to a tone class using settings triggers. */
export function resolveBadgeToneClass(text: string, settings: PropertyQuerySettings): string {
	const lower = text.trim().toLowerCase();
	const matches = (raw: string) =>
		parseTriggerList(raw).some((keyword) => textMatchesTrigger(lower, keyword));
	if (matches(settings.badgeDangerTriggers || DEFAULT_SETTINGS.badgeDangerTriggers)) {
		return "grim-badge-danger";
	}
	if (matches(settings.badgeWarnTriggers || DEFAULT_SETTINGS.badgeWarnTriggers)) {
		return "grim-badge-warn";
	}
	if (matches(settings.badgeSuccessTriggers || DEFAULT_SETTINGS.badgeSuccessTriggers)) {
		return "grim-badge-success";
	}
	return "grim-badge-muted";
}

export function meterGlyph(raw: string, fallback: string): string {
	const trimmed = raw.trim();
	if (!trimmed) return fallback;
	return Array.from(trimmed)[0] ?? fallback;
}

export function resolveMeterGlyphs(settings: PropertyQuerySettings): {
	filled: string;
	empty: string;
} {
	return {
		filled: meterGlyph(settings.meterFilledChar, DEFAULT_SETTINGS.meterFilledChar),
		empty: meterGlyph(settings.meterEmptyChar, DEFAULT_SETTINGS.meterEmptyChar),
	};
}
