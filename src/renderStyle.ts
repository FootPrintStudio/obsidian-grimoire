export type RenderStyle =
	| "cards"
	| "tags"
	| "button"
	| "cards-code"
	| "inline"
	| "list"
	| "badge"
	| "callout"
	| "progress"
	| "meter"
	| "image"
	| "wiki";

export type LinkOpenBehavior = "default" | "current" | "tab" | "split" | "window";

const STYLE_ALIASES: Record<string, RenderStyle> = {
	card: "cards",
	cards: "cards",
	tag: "tags",
	tags: "tags",
	button: "button",
	buttons: "button",
	"cards-code": "cards-code",
	code: "cards-code",
	"code-card": "cards-code",
	codecard: "cards-code",
	inline: "inline",
	list: "list",
	badge: "badge",
	pill: "badge",
	callout: "callout",
	progress: "progress",
	meter: "meter",
	stars: "meter",
	image: "image",
	img: "image",
	wiki: "wiki",
	wikilink: "wiki",
};

export const RENDER_STYLE_NAMES = [
	"card",
	"tag",
	"button",
	"cards-code",
	"inline",
	"list",
	"badge",
	"callout",
	"progress",
	"meter",
	"image",
	"wiki",
] as const;

export function parseRenderStyleName(raw: string): RenderStyle {
	const key = raw.trim().toLowerCase();
	const resolved = STYLE_ALIASES[key];
	if (!resolved) {
		throw new Error(
			`Unknown style "${raw}". Use AS card, tag, button, cards-code, inline, list, badge, callout, progress, meter, image, or wiki.`,
		);
	}
	return resolved;
}
