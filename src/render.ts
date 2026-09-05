import { App, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownRenderer, TFile } from "obsidian";
import { buildQueryContext } from "./context";
import { shieldDataviewInlineCodeFalsePositive } from "./dataviewCoexist";
import {
	classifyOutput,
	isPqFragments,
	isPqStyled,
	valueToPlainString,
	valueToStyleItems,
} from "./coerce";
import { durationformat } from "./dates";
import { evaluateExpressionSafe } from "./eval";
import { highlightExpressionHtml, splitPrefixExpression } from "./highlight";
import { renderStyledValue } from "./renderStyles";
import type { PropertyQuerySettings, Value } from "./types";

class QueryResultRenderer extends MarkdownRenderChild {
	constructor(
		container: HTMLElement,
		private app: App,
		private body: string,
		private sourcePath: string,
	) {
		super(container);
	}

	onload(): void {
		void MarkdownRenderer.render(this.app, this.body, this.containerEl, this.sourcePath, this);
	}
}

function renderError(container: HTMLElement, message: string): void {
	container.empty();
	container.addClass("pq-error");
	container.setText(message);
}

function renderPlain(container: HTMLElement, text: string): void {
	container.empty();
	container.addClass("pq-result");
	container.setText(text);
}

function renderHtml(container: HTMLElement, html: string): void {
	container.empty();
	container.addClass("pq-result");
	container.innerHTML = html;
}

function renderMarkdownValue(
	app: App,
	container: HTMLElement,
	text: string,
	sourcePath: string,
	ctx: MarkdownPostProcessorContext,
): void {
	container.empty();
	container.addClass("pq-result");
	const child = new QueryResultRenderer(container, app, text, sourcePath);
	ctx.addChild(child);
}

export function renderValue(
	app: App,
	container: HTMLElement,
	value: Value,
	sourcePath: string,
	ctx: MarkdownPostProcessorContext,
): void {
	const kind = classifyOutput(value);
	if (kind === "empty") {
		container.empty();
		container.addClass("pq-result");
		return;
	}

	let text = valueToPlainString(value);
	if (typeof value === "object" && value !== null && "__pqDuration" in value) {
		text = durationformat(value);
	}

	switch (kind) {
		case "html":
			renderHtml(container, text);
			break;
		case "markdown":
			renderMarkdownValue(app, container, text, sourcePath, ctx);
			break;
		default:
			renderPlain(container, text);
	}
}

function renderFragmentPart(
	app: App,
	host: HTMLElement,
	value: Value,
	sourcePath: string,
	ctx: MarkdownPostProcessorContext,
	linkOpenBehavior: PropertyQuerySettings["linkOpenBehavior"],
): void {
	if (isPqStyled(value)) {
		const wrap = host.createSpan({ cls: "grim-fragment grim-fragment-styled" });
		renderStyledValue(
			wrap,
			value.style,
			valueToStyleItems(value.value),
			app,
			sourcePath,
			linkOpenBehavior,
		);
		return;
	}

	const text = valueToPlainString(value);
	if (!text) return;

	const wrap = host.createSpan({ cls: "grim-fragment grim-fragment-plain" });
	const kind = classifyOutput(typeof value === "string" ? value : text);
	if (kind === "html") {
		wrap.innerHTML = text;
	} else if (kind === "markdown") {
		const child = new QueryResultRenderer(wrap, app, text, sourcePath);
		ctx.addChild(child);
	} else {
		wrap.setText(text);
	}
}

function renderQueryResult(
	app: App,
	host: HTMLElement,
	value: Value,
	sourcePath: string,
	ctx: MarkdownPostProcessorContext,
	settings: PropertyQuerySettings,
): void {
	if (isPqStyled(value)) {
		renderStyledValue(
			host,
			value.style,
			valueToStyleItems(value.value),
			app,
			sourcePath,
			settings.linkOpenBehavior,
		);
		return;
	}

	if (isPqFragments(value)) {
		host.empty();
		host.addClass("pq-result");
		host.addClass("grim-fragments");
		for (const part of value.parts) {
			renderFragmentPart(app, host, part, sourcePath, ctx, settings.linkOpenBehavior);
		}
		return;
	}

	renderValue(app, host, value, sourcePath, ctx);
}

function extractExpression(codeText: string, prefix: string): string | null {
	const trimmed = codeText.trim();
	if (!trimmed.startsWith(prefix)) return null;
	return trimmed.slice(prefix.length).trim();
}

function processInlineCodeElement(
	app: App,
	codeEl: HTMLElement,
	sourcePath: string,
	prefix: string,
	ctx: MarkdownPostProcessorContext,
	settings: PropertyQuerySettings,
): void {
	if (codeEl.dataset.pqProcessed === "1") return;
	if (codeEl.closest("pre")) return;

	const expr = extractExpression(codeEl.innerText ?? "", prefix);
	if (expr === null) return;

	const file = app.vault.getAbstractFileByPath(sourcePath);
	if (!(file instanceof TFile)) return;

	codeEl.dataset.pqProcessed = "1";

	const queryCtx = buildQueryContext(app, file);
	const result = evaluateExpressionSafe(expr, queryCtx);

	const host = document.createElement("span");
	host.className = "pq-inline";
	codeEl.replaceWith(host);

	if (!result.ok) {
		renderError(host, settings.debugMode ? result.error : "Grimoire error");
		return;
	}
	renderQueryResult(app, host, result.value, sourcePath, ctx, settings);
}

function highlightInlineCodeElement(codeEl: HTMLElement, prefix: string): void {
	if (codeEl.dataset.pqHighlighted === "1" || codeEl.dataset.pqProcessed === "1") return;
	if (codeEl.closest("pre")) return;

	const codeText = codeEl.innerText ?? "";
	const split = splitPrefixExpression(codeText, prefix);
	if (!split) return;

	codeEl.addClass("pq-query-source");
	codeEl.innerHTML = highlightExpressionHtml(split.prefixPart, split.expr);
	codeEl.dataset.pqHighlighted = "1";
}

export function processPropertyQueriesInElement(
	app: App,
	element: HTMLElement,
	ctx: MarkdownPostProcessorContext,
	settings: PropertyQuerySettings,
): void {
	if (!settings.enableInReadingView && !settings.enableSyntaxHighlight) return;

	const prefix = settings.inlinePrefix;
	for (const codeEl of element.findAll("code")) {
		if (codeEl.closest("pre")) continue;
		if (shieldDataviewInlineCodeFalsePositive(codeEl, prefix)) continue;

		if (settings.enableInReadingView) {
			processInlineCodeElement(app, codeEl, ctx.sourcePath, prefix, ctx, settings);
		} else if (settings.enableSyntaxHighlight) {
			highlightInlineCodeElement(codeEl, prefix);
		}
	}
}
