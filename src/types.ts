import type { LinkOpenBehavior, RenderStyle } from "./renderStyle";

export interface PropertyQuerySettings {
	inlinePrefix: string;
	enableInReadingView: boolean;
	enableSyntaxHighlight: boolean;
	debugMode: boolean;
	refreshOnMetadataChange: boolean;
	linkOpenBehavior: LinkOpenBehavior;
	/** Comma-separated substrings that map AS badge/pill text to success tone. */
	badgeSuccessTriggers: string;
	/** Comma-separated substrings that map AS badge/pill text to warn tone. */
	badgeWarnTriggers: string;
	/** Comma-separated substrings that map AS badge/pill text to danger tone. */
	badgeDangerTriggers: string;
	/** Glyph for filled AS meter / stars slots. */
	meterFilledChar: string;
	/** Glyph for empty AS meter / stars slots. */
	meterEmptyChar: string;
}

export const DEFAULT_SETTINGS: PropertyQuerySettings = {
	inlinePrefix: "q=",
	enableInReadingView: true,
	enableSyntaxHighlight: true,
	debugMode: false,
	refreshOnMetadataChange: false,
	linkOpenBehavior: "default",
	badgeSuccessTriggers: "alive, ok, success, active, complete, done",
	badgeWarnTriggers: "warn, warning, undead, pending, unknown",
	badgeDangerTriggers: "dead, error, fail, danger, critical, missing",
	meterFilledChar: "★",
	meterEmptyChar: "☆",
};

/** Branded date value (epoch ms, interpreted via Obsidian moment). */
export interface PqDate {
	readonly __pqDate: true;
	readonly ms: number;
}

/** Branded duration value (length in milliseconds). */
export interface PqDuration {
	readonly __pqDuration: true;
	readonly ms: number;
	/** When present, date +/- uses calendar units (years, months, …) not fixed ms. */
	readonly calendar?: ReadonlyArray<{ readonly amount: number; readonly unit: string }>;
}

/** Value wrapped with an `AS <style>` postfix. */
export interface PqStyled {
	readonly __pqStyled: true;
	readonly value: Value;
	readonly style: RenderStyle;
}

/** Mixed plain + styled parts from concatenating styled subexpressions. */
export interface PqFragments {
	readonly __pqFragments: true;
	readonly parts: Value[];
}

export type OutputKind = "empty" | "markdown" | "html" | "text";

export type Value =
	| null
	| boolean
	| number
	| string
	| PqDate
	| PqDuration
	| PqStyled
	| PqFragments
	| Value[]
	| { [key: string]: Value };

export interface FileMeta {
	name: string;
	path: string;
	folder: string;
	mtime: PqDate;
	ctime: PqDate;
	size: number;
	tags: string[];
}

/** Evaluation context: frontmatter fields + reserved file metadata. */
export interface QueryContext {
	fields: Record<string, Value>;
	file: FileMeta;
}

export type AstNode =
	| { kind: "literal"; value: Value }
	| { kind: "ident"; name: string }
	| { kind: "member"; object: AstNode; property: string }
	| { kind: "index"; object: AstNode; index: AstNode }
	| { kind: "pair"; key: AstNode; value: AstNode }
	| { kind: "unary"; op: string; arg: AstNode }
	| { kind: "binary"; op: string; left: AstNode; right: AstNode }
	| { kind: "call"; callee: string; args: AstNode[] }
	| { kind: "styled"; expr: AstNode; style: RenderStyle };
