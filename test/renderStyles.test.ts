import { describe, expect, it } from "vitest";
import { resolveBadgeToneClass, resolveMeterGlyphs } from "../src/styleOptions";
import { DEFAULT_SETTINGS, type PropertyQuerySettings } from "../src/types";

describe("badge tone settings", () => {
	it("uses default triggers", () => {
		expect(resolveBadgeToneClass("Alive", DEFAULT_SETTINGS)).toBe("grim-badge-success");
		expect(resolveBadgeToneClass("Undead", DEFAULT_SETTINGS)).toBe("grim-badge-warn");
		expect(resolveBadgeToneClass("Dead", DEFAULT_SETTINGS)).toBe("grim-badge-danger");
		expect(resolveBadgeToneClass("Idle", DEFAULT_SETTINGS)).toBe("grim-badge-muted");
	});

	it("prefers danger over success when both match", () => {
		const settings: PropertyQuerySettings = {
			...DEFAULT_SETTINGS,
			badgeSuccessTriggers: "status",
			badgeDangerTriggers: "dead",
		};
		expect(resolveBadgeToneClass("dead status", settings)).toBe("grim-badge-danger");
	});

	it("respects custom trigger lists", () => {
		const settings: PropertyQuerySettings = {
			...DEFAULT_SETTINGS,
			badgeSuccessTriggers: "heroic",
			badgeWarnTriggers: "tired",
			badgeDangerTriggers: "cursed",
		};
		expect(resolveBadgeToneClass("Heroic", settings)).toBe("grim-badge-success");
		expect(resolveBadgeToneClass("tired", settings)).toBe("grim-badge-warn");
		expect(resolveBadgeToneClass("cursed relic", settings)).toBe("grim-badge-danger");
		expect(resolveBadgeToneClass("Alive", settings)).toBe("grim-badge-muted");
	});
});

describe("meter glyph settings", () => {
	it("uses configured glyphs", () => {
		const settings: PropertyQuerySettings = {
			...DEFAULT_SETTINGS,
			meterFilledChar: "●",
			meterEmptyChar: "○",
		};
		expect(resolveMeterGlyphs(settings)).toEqual({ filled: "●", empty: "○" });
	});

	it("falls back when empty", () => {
		const settings: PropertyQuerySettings = {
			...DEFAULT_SETTINGS,
			meterFilledChar: "  ",
			meterEmptyChar: "",
		};
		expect(resolveMeterGlyphs(settings)).toEqual({ filled: "★", empty: "☆" });
	});
});
