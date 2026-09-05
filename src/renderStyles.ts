import type { App } from "obsidian";
import { TFile } from "obsidian";
import { containsHtmlTag } from "./coerce";
import {
	getHostname,
	getLinkDisplayText,
	normalizeHref,
	openInternalLink,
	parseLink,
	resolveOpenMode,
} from "./parseLink";
import type { LinkOpenBehavior, RenderStyle } from "./renderStyle";

function setRichText(el: HTMLElement, text: string): void {
	if (containsHtmlTag(text)) {
		el.innerHTML = text;
	} else {
		el.setText(text);
	}
}

async function openTagSearch(app: App, tag: string, newPane: boolean): Promise<void> {
	const query = `tag:#${tag.replace(/^#+/, "")}`;
	const leaf = newPane ? app.workspace.getLeaf("tab") : app.workspace.getLeaf(false);
	await leaf.setViewState({
		type: "search",
		state: { query },
		active: true,
	});
	const view = leaf.view as { setQuery?: (q: string) => void } | null;
	if (view?.setQuery) view.setQuery(query);
}

function renderCards(el: HTMLElement, values: string[]): void {
	const container = el.createSpan({ cls: "grim-card-container" });
	for (const value of values) {
		const card = container.createSpan({ cls: "grim-card grim-text-card" });
		const textEl = card.createEl("span", { cls: "grim-card-text" });
		setRichText(textEl, value);
	}
}

function renderTags(el: HTMLElement, values: string[], app: App): void {
	const container = el.createSpan({ cls: "grim-card-container" });
	for (const value of values) {
		const tagName = value.replace(/^#/, "").trim();
		if (!tagName) continue;
		const card = container.createSpan({
			cls: "grim-card grim-tag-card grim-clickable",
		});
		card.createEl("span", { cls: "grim-tag-hash", text: "#" });
		card.createEl("span", { cls: "grim-card-text", text: tagName });
		card.setAttr("title", `Search for #${tagName}`);
		card.addEventListener("click", (e) => {
			void openTagSearch(app, tagName, e.ctrlKey || e.metaKey);
		});
	}
}

function renderCardsCode(el: HTMLElement, values: string[]): void {
	const container = el.createSpan({ cls: "grim-card-container" });
	for (const value of values) {
		const card = container.createSpan({
			cls: "grim-card grim-code-card",
			attr: { title: "CSS class" },
		});
		card.createEl("span", { cls: "grim-code-dot", text: "." });
		card.createEl("span", { cls: "grim-card-text", text: value.replace(/^\./, "") });
	}
}

function renderInline(el: HTMLElement, values: string[]): void {
	const span = el.createEl("span", { cls: "grim-inline" });
	setRichText(span, values.join(", "));
}

function renderList(el: HTMLElement, values: string[]): void {
	const ul = el.createEl("ul", { cls: "grim-list" });
	for (const value of values) {
		const li = ul.createEl("li");
		setRichText(li, value);
	}
}

function badgeToneClass(text: string): string {
	const lower = text.trim().toLowerCase();
	if (/(dead|error|fail|danger|critical|missing)/.test(lower)) return "grim-badge-danger";
	if (/(warn|warning|undead|pending|unknown)/.test(lower)) return "grim-badge-warn";
	if (/(alive|ok|success|active|complete|done)/.test(lower)) return "grim-badge-success";
	return "grim-badge-muted";
}

function renderBadge(el: HTMLElement, values: string[]): void {
	const container = el.createSpan({ cls: "grim-card-container" });
	for (const value of values) {
		const text = value.trim();
		if (!text) continue;
		const badge = container.createSpan({
			cls: `grim-badge ${badgeToneClass(text)}`,
		});
		setRichText(badge, text);
	}
}

function calloutType(text: string): string {
	const lower = text.trim().toLowerCase();
	if (lower.startsWith("warning:") || lower.startsWith("warn:")) return "warning";
	if (lower.startsWith("tip:") || lower.startsWith("hint:")) return "tip";
	if (lower.startsWith("error:") || lower.startsWith("danger:")) return "error";
	if (lower.startsWith("info:") || lower.startsWith("note:")) return "note";
	return "note";
}

function stripCalloutPrefix(text: string): string {
	return text.replace(/^(warning|warn|tip|hint|error|danger|info|note)\s*:\s*/i, "").trim() || text;
}

function renderCallout(el: HTMLElement, values: string[]): void {
	for (const value of values) {
		const text = value.trim();
		if (!text) continue;
		const type = calloutType(text);
		const box = el.createDiv({ cls: `grim-callout grim-callout-${type}` });
		box.createDiv({ cls: "grim-callout-title", text: type });
		const body = box.createDiv({ cls: "grim-callout-body" });
		setRichText(body, stripCalloutPrefix(text));
	}
}

function parseProgress(value: string): { ratio: number; label: string } | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const fraction = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
	if (fraction) {
		const a = Number(fraction[1]);
		const b = Number(fraction[2]);
		if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
		return { ratio: Math.max(0, Math.min(1, a / b)), label: trimmed };
	}
	const n = Number(trimmed);
	if (!Number.isFinite(n)) return null;
	const ratio = n > 1 ? Math.max(0, Math.min(1, n / 100)) : Math.max(0, Math.min(1, n));
	return { ratio, label: `${Math.round(ratio * 100)}%` };
}

function renderProgress(el: HTMLElement, values: string[]): void {
	for (const value of values) {
		const parsed = parseProgress(value);
		if (!parsed) continue;
		const wrap = el.createSpan({ cls: "grim-progress" });
		const track = wrap.createSpan({ cls: "grim-progress-track" });
		const fill = track.createSpan({ cls: "grim-progress-fill" });
		fill.style.width = `${Math.round(parsed.ratio * 100)}%`;
		wrap.createSpan({ cls: "grim-progress-label", text: parsed.label });
	}
}

function parseMeter(value: string): number {
	const trimmed = value.trim();
	const fraction = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
	if (fraction) {
		const a = Number(fraction[1]);
		const b = Number(fraction[2]);
		if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
		return Math.max(0, Math.min(5, Math.round((a / b) * 5)));
	}
	const n = Number(trimmed);
	if (!Number.isFinite(n)) return 0;
	if (n <= 1) return Math.max(0, Math.min(5, Math.round(n * 5)));
	if (n <= 5) return Math.max(0, Math.min(5, Math.round(n)));
	return Math.max(0, Math.min(5, Math.round((n / 100) * 5)));
}

function renderMeter(el: HTMLElement, values: string[]): void {
	for (const value of values) {
		const filled = parseMeter(value);
		const wrap = el.createSpan({ cls: "grim-meter", attr: { title: `${filled}/5` } });
		for (let i = 1; i <= 5; i++) {
			wrap.createSpan({
				cls: i <= filled ? "grim-meter-star is-filled" : "grim-meter-star",
				text: i <= filled ? "★" : "☆",
			});
		}
	}
}

function resolveImageSrc(app: App, raw: string, sourcePath: string): string | null {
	let path = raw.trim();
	if (!path) return null;
	const md = path.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
	if (md) path = md[2]!.trim();
	path = path.replace(/^!\[\[(.*)\]\]$/, "$1").replace(/^\[\[(.*)\]\]$/, "$1");
	if (/^https?:\/\//i.test(path) || path.startsWith("app://") || path.startsWith("data:")) {
		return path;
	}
	const file = app.metadataCache.getFirstLinkpathDest(path, sourcePath);
	if (file instanceof TFile) return app.vault.getResourcePath(file);
	return null;
}

function renderImage(el: HTMLElement, values: string[], app: App, sourcePath: string): void {
	for (const value of values) {
		const src = resolveImageSrc(app, value, sourcePath);
		if (!src) continue;
		const img = el.createEl("img", {
			cls: "grim-image",
			attr: { src, alt: value.trim() },
		});
		img.addClass("grim-image");
	}
}

function renderWiki(
	el: HTMLElement,
	values: string[],
	app: App,
	sourcePath: string,
	linkOpenBehavior: LinkOpenBehavior,
): void {
	for (const v of values) {
		const { cleanedValue, displayText: initialDisplayText, isUrl } = parseLink(v);
		if (isUrl) {
			const a = el.createEl("a", {
				cls: "grim-wiki grim-wiki-external",
				text: initialDisplayText || getHostname(cleanedValue),
				attr: { href: normalizeHref(cleanedValue), target: "_blank", rel: "noopener noreferrer" },
			});
			void a;
			continue;
		}
		let displayText = initialDisplayText || cleanedValue;
		if (!initialDisplayText) {
			displayText = getLinkDisplayText(app, cleanedValue, sourcePath) || displayText;
		}
		const link = el.createEl("a", {
			cls: "grim-wiki internal-link",
			text: displayText,
			attr: { href: cleanedValue },
		});
		link.addEventListener("click", (e) => {
			e.preventDefault();
			const mode = resolveOpenMode(e, linkOpenBehavior);
			void openInternalLink(app, cleanedValue, sourcePath, mode);
		});
		link.addEventListener("auxclick", (e) => {
			if (e.button === 1) {
				e.preventDefault();
				void openInternalLink(app, cleanedValue, sourcePath, "tab");
			}
		});
	}
}

function renderButton(
	el: HTMLElement,
	values: string[],
	app: App,
	sourcePath: string,
	linkOpenBehavior: LinkOpenBehavior,
): void {
	for (const v of values) {
		const { cleanedValue, displayText: initialDisplayText, isUrl } = parseLink(v);
		let displayText = isUrl
			? initialDisplayText || getHostname(cleanedValue)
			: initialDisplayText || cleanedValue;

		if (!isUrl && !initialDisplayText) {
			displayText = getLinkDisplayText(app, cleanedValue, sourcePath) || displayText;
		}

		const button = el.createEl("a", {
			cls: `grim-button ${isUrl ? "grim-external-link" : "grim-internal-link"}`,
			text: displayText,
		});

		if (isUrl) {
			button.href = normalizeHref(cleanedValue);
			button.target = "_blank";
			button.rel = "noopener noreferrer";
		} else {
			button.href = cleanedValue;
			button.addEventListener("click", (e) => {
				e.preventDefault();
				const mode = resolveOpenMode(e, linkOpenBehavior);
				void openInternalLink(app, cleanedValue, sourcePath, mode);
			});
			button.addEventListener("auxclick", (e) => {
				if (e.button === 1) {
					e.preventDefault();
					void openInternalLink(app, cleanedValue, sourcePath, "tab");
				}
			});
		}
	}
}

export function renderStyledValue(
	el: HTMLElement,
	style: RenderStyle,
	values: string[],
	app: App,
	sourcePath: string,
	linkOpenBehavior: LinkOpenBehavior,
): void {
	el.empty();
	el.addClass("pq-result");
	el.addClass("grim-styled");

	if (values.length === 0) return;

	switch (style) {
		case "button":
			renderButton(el, values, app, sourcePath, linkOpenBehavior);
			break;
		case "cards":
			renderCards(el, values);
			break;
		case "tags":
			renderTags(el, values, app);
			break;
		case "cards-code":
			renderCardsCode(el, values);
			break;
		case "inline":
			renderInline(el, values);
			break;
		case "list":
			renderList(el, values);
			break;
		case "badge":
			renderBadge(el, values);
			break;
		case "callout":
			renderCallout(el, values);
			break;
		case "progress":
			renderProgress(el, values);
			break;
		case "meter":
			renderMeter(el, values);
			break;
		case "image":
			renderImage(el, values, app, sourcePath);
			break;
		case "wiki":
			renderWiki(el, values, app, sourcePath, linkOpenBehavior);
			break;
	}
}
