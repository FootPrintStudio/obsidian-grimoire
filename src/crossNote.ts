import type { App } from "obsidian";
import { TFile } from "obsidian";
import { buildQueryContext, getFileField, resolveIdent } from "./context";
import { parseLink } from "./parseLink";
import type { QueryContext, Value } from "./types";

/** Extract a vault linkpath from a wiki/markdown/path string, or null if not link-like. */
export function linkpathFromValue(value: Value): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed || /[\n\r]/.test(trimmed) || trimmed.length > 260) return null;

	const hasWiki = trimmed.includes("[[");
	const mdLink = /^\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
	if (hasWiki || mdLink) {
		const parsed = parseLink(trimmed);
		if (parsed.isUrl) return null;
		const path = parsed.cleanedValue.trim();
		return path || null;
	}

	// Path-shaped link fields without brackets (folder/note or *.md).
	if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("#")) {
		return null;
	}
	if (trimmed.includes("/") || /\.md$/i.test(trimmed)) {
		return trimmed.replace(/\.md$/i, "");
	}
	return null;
}

export function trackDep(ctx: QueryContext, targetPath: string): void {
	if (!ctx.deps || !targetPath) return;
	ctx.deps.add(targetPath);
}

/** Resolve a linkpath relative to the source note into a QueryContext, or null. */
export function resolveNoteContext(ctx: QueryContext, linkpath: string): QueryContext | null {
	if (!linkpath) return null;

	if (ctx.resolveNote) {
		const resolved = ctx.resolveNote(linkpath);
		if (resolved) {
			trackDep(ctx, resolved.file.path);
			return resolved;
		}
		return null;
	}

	const app = ctx.app;
	const sourcePath = ctx.sourcePath ?? ctx.file.path;
	if (!app || !sourcePath) return null;

	const file = app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
	if (!(file instanceof TFile)) return null;
	if (file.extension !== "md") return null;

	trackDep(ctx, file.path);
	const child = buildQueryContext(app, file);
	child.app = app;
	child.sourcePath = file.path;
	child.deps = ctx.deps;
	child.resolveNote = ctx.resolveNote;
	return child;
}

/** Read a property from a value, resolving link-valued strings / list-of-links. */
export function readCrossMember(base: Value, property: string, ctx: QueryContext): Value {
	if (base === null || base === undefined) return null;

	if (Array.isArray(base)) {
		const asIndex = Number(property);
		if (!Number.isNaN(asIndex) && String(asIndex) === property) {
			return base[asIndex] ?? null;
		}
		// List-of-links (or list of objects): map → list of field values.
		return base.map((el) => readCrossMember(el, property, ctx));
	}

	const linkpath = linkpathFromValue(base);
	if (linkpath) {
		const noteCtx = resolveNoteContext(ctx, linkpath);
		if (!noteCtx) return null;
		if (property === "file") return noteCtx.file as unknown as Value;
		return resolveIdent(property, noteCtx);
	}

	if (typeof base === "object" && !("__pqDate" in base) && !("__pqDuration" in base) && !("__pqStyled" in base) && !("__pqFragments" in base)) {
		// FileMeta-shaped object from a prior `.file` cross-note read.
		if ("mtime" in base && "path" in base && "name" in base && !("fields" in base)) {
			const fromFile = getFileField(base as unknown as Parameters<typeof getFileField>[0], property);
			if (fromFile !== null || property in (base as object)) {
				return fromFile;
			}
		}
		return (base as Record<string, Value>)[property] ?? null;
	}

	return null;
}

/** Attach App/sourcePath onto a context built for the current note. */
export function attachVaultBridge(
	ctx: QueryContext,
	app: App,
	sourcePath: string,
	deps?: Set<string>,
): QueryContext {
	ctx.app = app;
	ctx.sourcePath = sourcePath;
	if (deps) ctx.deps = deps;
	return ctx;
}
