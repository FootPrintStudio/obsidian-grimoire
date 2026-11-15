import type { CachedMetadata } from "obsidian";
import { App, TFile } from "obsidian";
import { coerceYamlDate, pqDate } from "./dates";
import type { FileMeta, QueryContext, Value } from "./types";

function normalizeTag(tag: string): string {
	return tag.replace(/^#+/, "").trim();
}

function mergeTags(fm: Record<string, unknown>, cache: CachedMetadata | null): string[] {
	const fromYaml = toStringList(fm.tags);
	const fromInline = (cache?.tags ?? []).map((t) => normalizeTag(t.tag));
	const seen = new Set<string>();
	const merged: string[] = [];
	for (const tag of [...fromYaml, ...fromInline]) {
		const norm = normalizeTag(tag);
		if (!norm) continue;
		const key = norm.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		merged.push(norm);
	}
	return merged;
}

function toStringList(raw: unknown): string[] {
	if (raw === null || raw === undefined) return [];
	if (Array.isArray(raw)) return raw.flatMap((v) => toStringList(v));
	const str = String(raw).trim();
	return str ? [str] : [];
}

function cloneValue(value: unknown): Value {
	if (value === null || value === undefined) return null;
	const asDate = coerceYamlDate(value);
	if (asDate) return asDate;
	if (Array.isArray(value)) return value.map((v) => cloneValue(v));
	if (typeof value === "object") {
		const out: Record<string, Value> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = cloneValue(v);
		}
		return out;
	}
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return value;
	}
	return String(value);
}

export function buildFileMeta(file: TFile, cache: CachedMetadata | null): FileMeta {
	return {
		name: file.basename.replace(/\.md$/i, ""),
		path: file.path,
		folder: file.parent?.path ?? "",
		mtime: pqDate(file.stat.mtime),
		ctime: pqDate(file.stat.ctime),
		size: file.stat.size,
		tags: mergeTags((cache?.frontmatter as Record<string, unknown>) ?? {}, cache),
	};
}

export function buildQueryContext(app: App, file: TFile): QueryContext {
	const cache = app.metadataCache.getFileCache(file);
	const fm = cache?.frontmatter ?? {};
	const fields = cloneValue(fm) as Record<string, Value>;
	const fileMeta = buildFileMeta(file, cache ?? null);
	return { fields, file: fileMeta };
}

export function getFileField(file: FileMeta, property: string): Value {
	switch (property) {
		case "name":
			return file.name;
		case "path":
			return file.path;
		case "folder":
			return file.folder;
		case "mtime":
			return file.mtime;
		case "ctime":
			return file.ctime;
		case "size":
			return file.size;
		case "tags":
			return file.tags;
		default:
			return null;
	}
}

export function getMemberValue(base: Value, property: string): Value {
	if (base === null || base === undefined) return null;
	if (Array.isArray(base)) {
		const index = Number(property);
		if (!Number.isNaN(index)) return base[index] ?? null;
		return null;
	}
	if (typeof base === "object" && !("__pqDate" in base) && !("__pqDuration" in base)) {
		return (base as Record<string, Value>)[property] ?? null;
	}
	return null;
}

export function resolveIdent(name: string, ctx: QueryContext): Value {
	if (name === "this") {
		// Inside `@` map/where, `this` is the authoring source note.
		if (ctx.sourceCtx) return ctx.sourceCtx.fields;
		return ctx.fields;
	}
	return ctx.fields[name] ?? null;
}
