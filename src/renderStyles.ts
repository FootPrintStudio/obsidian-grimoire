import type { App } from "obsidian";
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
	}
}
