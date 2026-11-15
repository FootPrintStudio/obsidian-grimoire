import type { App } from "obsidian";

/** Minimal Epochs API surface used by Grimoire (duck-typed). */
export interface EpochsDateApi {
	parseDate(value: unknown): { ms: number; calendarId: string } | null;
	formatDate(ms: number, calendarId: string, format?: string): string;
	formatDuration(ms: number, calendarId: string, format?: string): string;
	addDuration(
		ms: number,
		calendarId: string,
		parts: ReadonlyArray<{ amount: number; unit: string }>,
		sign?: 1 | -1,
	): number;
	getCalendar?(id: string): unknown;
}

let appRef: App | null = null;
/** Test-only override; production always resolves via `plugins.epochs.api`. */
let testApiOverride: EpochsDateApi | null | undefined;

export function setGrimoireApp(app: App | null): void {
	appRef = app;
}

/** Inject or clear a duck-typed Epochs API for unit/E2E tests. Pass `undefined` to clear. */
export function setEpochsApiForTests(api: EpochsDateApi | null | undefined): void {
	testApiOverride = api;
}

export function getEpochsApi(): EpochsDateApi | null {
	if (testApiOverride !== undefined) return testApiOverride;
	if (!appRef) return null;
	const plugins = (
		appRef as App & {
			plugins?: { plugins?: Record<string, { api?: EpochsDateApi }> };
		}
	).plugins?.plugins;
	const epochs = plugins?.epochs;
	const api = epochs?.api;
	if (
		!api ||
		typeof api.parseDate !== "function" ||
		typeof api.formatDate !== "function" ||
		typeof api.formatDuration !== "function" ||
		typeof api.addDuration !== "function"
	) {
		return null;
	}
	return api;
}
