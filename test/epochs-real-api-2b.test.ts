/**
 * Case 2b reproduction against the real EpochsApi (sibling repo), not the mock.
 * Smoke expression: durationformat(date("aether:314-Greentide-4") - birthDate, "y' years'")
 */
import { afterEach, describe, expect, it } from "vitest";
import { EpochsApi } from "../../obsidian-epochs/src/api";
import type { CalendarDef } from "../../obsidian-epochs/src/types";
import { setEpochsApiForTests } from "../src/epochsBridge";
import { coerceYamlDate, durationformat, pqDuration } from "../src/dates";
import { createTestContext, evaluateExpression } from "../src/eval";

class MemoryIndex {
	private byId = new Map<string, CalendarDef>();
	set(cal: CalendarDef): void {
		this.byId.set(cal.id, cal);
	}
	get(id: string): CalendarDef | null {
		return this.byId.get(id) ?? null;
	}
	list(): CalendarDef[] {
		return [...this.byId.values()];
	}
}

function smokeAether(): CalendarDef {
	return {
		id: "aether",
		name: "Aether",
		epochMs: 0,
		dayLengthHours: 24,
		year: { lengthDays: 90 },
		months: [
			{ name: "Frostmere", days: 30 },
			{ name: "Greentide", days: 30 },
			{ name: "Highsun", days: 30 },
		],
		weeks: {
			lengthDays: 6,
			weekdays: ["Moonday", "Twoday", "Thirdday", "Fourthday", "Fifthday", "Sixthday"],
		},
		eras: [{ id: "flame", name: "Age of Flame", startYear: 1 }],
		lunar: null,
		defaultFormat: "MMMM d, y G",
		path: "Epoch Calendars/Aether.md",
	};
}

afterEach(() => {
	setEpochsApiForTests(undefined);
});

describe("Case 2b with real EpochsApi", () => {
	it("durationformat years is 2 not 0 for aether 314−312 Greentide", () => {
		const index = new MemoryIndex();
		index.set(smokeAether());
		const api = new EpochsApi(index);
		setEpochsApiForTests(api);

		const birth = {
			calendar: "aether",
			year: 312,
			month: "Greentide",
			day: 4,
		};
		const ctx = createTestContext({ fields: { birthDate: coerceYamlDate(birth) } });

		expect(evaluateExpression('dateformat(date(birthDate) + dur(2, "years"), "y")', ctx)).toBe(
			"314",
		);

		expect(
			evaluateExpression(
				'durationformat(date("aether:314-Greentide-4") - date(birthDate), "y")',
				ctx,
			),
		).toBe("2");
		expect(
			evaluateExpression(
				'durationformat(date("aether:314-Greentide-4") - date(birthDate))',
				ctx,
			),
		).toBe("2 years");

		// Same ms without calendarId → Gregorian y component is 0 (Carl's failure mode)
		const a = api.parseDate("aether:314-Greentide-4")!;
		const b = api.parseDate(birth)!;
		const spanMs = a.ms - b.ms;
		expect(spanMs / 86400000).toBe(180);
		setEpochsApiForTests(null);
		expect(durationformat(pqDuration(spanMs), "y")).toBe("0");
	});
});
