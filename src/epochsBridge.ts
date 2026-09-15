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

export function setGrimoireApp(app: App): void {
	appRef = app;
}

export function getEpochsApi(): EpochsDateApi | null {
	if (!appRef) return null;
	const plugins = (
		appRef as App & {
			plugins?: { plugins?: Record<string, { api?: EpochsDateApi }> };
		}
	).plugins?.plugins;
	const epochs = plugins?.epochs;
	const api = epochs?.api;
	if (!api || typeof api.parseDate !== "function" || typeof api.formatDate !== "function") {
		return null;
	}
	return api;
}
