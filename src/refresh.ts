import { App, MarkdownView, TFile } from "obsidian";

/** sourcePath → target note paths read during cross-note eval. */
const crossNoteDeps = new Map<string, Set<string>>();

/** Record that `sourcePath` evaluated a cross-note read of `targetPath`. */
export function registerCrossNoteDeps(sourcePath: string, targetPaths: Iterable<string>): void {
	if (!sourcePath) return;
	let set = crossNoteDeps.get(sourcePath);
	if (!set) {
		set = new Set();
		crossNoteDeps.set(sourcePath, set);
	}
	for (const t of targetPaths) {
		if (t) set.add(t);
	}
}

/** Sources that listed `targetPath` as a cross-note dependency. */
export function sourcesDependingOn(targetPath: string): string[] {
	const out: string[] = [];
	for (const [source, targets] of crossNoteDeps) {
		if (targets.has(targetPath)) out.push(source);
	}
	return out;
}

/** Test helper — clear registry. */
export function clearCrossNoteDeps(): void {
	crossNoteDeps.clear();
}

/** Rerender every open markdown preview so post-processors re-run (e.g. after settings change). */
export function rerenderAllMarkdownViews(app: App): void {
	for (const leaf of app.workspace.getLeavesOfType("markdown")) {
		const view = leaf.view;
		if (view instanceof MarkdownView) {
			void view.previewMode?.rerender(true);
		}
	}
}

/** Rerender open markdown views that display, embed, or cross-note-depend on the changed file. */
export function rerenderViewsForFile(app: App, changedFile: TFile): void {
	const changedPath = changedFile.path;
	const pathsToRefresh = new Set<string>([changedPath]);

	for (const depSource of sourcesDependingOn(changedPath)) {
		pathsToRefresh.add(depSource);
	}

	for (const leaf of app.workspace.getLeavesOfType("markdown")) {
		const view = leaf.view;
		if (!(view instanceof MarkdownView) || !view.file) continue;
		const openPath = view.file.path;
		if (openPath === changedPath) {
			pathsToRefresh.add(openPath);
			continue;
		}
		const cache = app.metadataCache.getFileCache(view.file);
		const embeds = cache?.embeds ?? [];
		if (embeds.some((e) => e.link === changedPath || e.link.endsWith(`/${changedFile.name}`))) {
			pathsToRefresh.add(openPath);
		}
	}

	for (const leaf of app.workspace.getLeavesOfType("markdown")) {
		const view = leaf.view;
		if (!(view instanceof MarkdownView) || !view.file) continue;
		if (pathsToRefresh.has(view.file.path)) {
			void view.previewMode?.rerender(true);
		}
	}
}
