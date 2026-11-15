import { describe, expect, it } from "vitest";
import { moment } from "obsidian";
import { isPqFragments, isPqStyled } from "../src/coerce";
import { pqDate } from "../src/dates";
import { createTestContext, evaluateExpression, evaluateExpressionSafe } from "../src/eval";
import { parseExpression } from "../src/parse";

describe("parse", () => {
	it("parses braced pair literals", () => {
		const ast = parseExpression('select(1, {1, "A"}, {2, "B"})');
		expect(ast.kind).toBe("call");
		if (ast.kind === "call") {
			expect(ast.args[1]?.kind).toBe("pair");
		}
	});

	it("parses file.member access", () => {
		const ast = parseExpression("file.mtime");
		expect(ast.kind).toBe("member");
	});
});

describe("eval core functions", () => {
	const ctx = createTestContext({
		fields: {
			title: "Hello",
			tags: ["a", "b"],
			pageColour: "Blue",
			description: "",
			parent: "[[Someone]]",
		},
	});

	it("resolves bare frontmatter fields", () => {
		expect(evaluateExpression("title", ctx)).toBe("Hello");
	});

	it("resolves this alias", () => {
		expect(evaluateExpression("this.title", ctx)).toBe("Hello");
	});

	it("default uses fallback for empty string", () => {
		expect(evaluateExpression('default(description, "fallback")', ctx)).toBe("fallback");
	});

	it("choice branches on any() single arg", () => {
		expect(evaluateExpression('choice(any(tags), "yes", "no")', ctx)).toBe("yes");
		expect(evaluateExpression("any(emptyField)", createTestContext({ fields: { emptyField: "" } }))).toBe(
			false,
		);
	});

	it("choice accepts brace branches and true-only singleton", () => {
		expect(evaluateExpression('choice(true, {"yes", "no"})', createTestContext())).toBe("yes");
		expect(evaluateExpression('choice(false, {"yes", "no"})', createTestContext())).toBe("no");
		expect(evaluateExpression('choice(true, {"only"})', createTestContext())).toBe("only");
		expect(evaluateExpression('choice(false, {"only"})', createTestContext())).toBe("");
	});

	it("exists is true for non-empty values", () => {
		expect(evaluateExpression("exists(tags)", ctx)).toBe(true);
		expect(evaluateExpression("exists(emptyField)", createTestContext({ fields: { emptyField: "" } }))).toBe(
			false,
		);
		expect(evaluateExpression("exists(missing)", createTestContext({ fields: {} }))).toBe(false);
	});

	it("exists self-branches with brace arms", () => {
		expect(evaluateExpression('exists(tags, {tags, "none"})', ctx)).toEqual(["a", "b"]);
		expect(evaluateExpression('exists(description, {description, "No description"})', ctx)).toBe(
			"No description",
		);
		expect(evaluateExpression('exists(tags, {tags})', ctx)).toEqual(["a", "b"]);
		expect(evaluateExpression('exists(description, {description})', ctx)).toBe("");
	});

	it("any multi-arg checks containment in property", () => {
		const bodyCtx = createTestContext({
			fields: { bodyParts: ["Hand", "Feet", "Knees", "Toes"] },
		});
		expect(evaluateExpression("any(bodyParts)", bodyCtx)).toBe(true);
		expect(evaluateExpression('any(bodyParts, "Feet", "Elbows")', bodyCtx)).toBe(true);
		expect(evaluateExpression('any(bodyParts, "Nose", "Elbows", "Legs")', bodyCtx)).toBe(false);
	});

	it("any self-branches with trailing brace arms", () => {
		expect(evaluateExpression('any(tags, {tags, "no tags"})', ctx)).toEqual(["a", "b"]);
		expect(evaluateExpression('any(description, {"*"+description+"*", "No description"})', ctx)).toBe(
			"No description",
		);
		const bodyCtx = createTestContext({
			fields: { bodyParts: ["Hand", "Feet", "Knees", "Toes"] },
		});
		expect(evaluateExpression('any(bodyParts, "Feet", "Elbows", {"found", "not found"})', bodyCtx)).toBe(
			"found",
		);
		expect(evaluateExpression('any(bodyParts, "Nose", {"found", "not found"})', bodyCtx)).toBe("not found");
		expect(evaluateExpression('any(parent, {"**Parent:** " + parent})', ctx)).toBe("**Parent:** [[Someone]]");
		expect(
			evaluateExpression('any(missing, {"shown"})', createTestContext({ fields: {} })),
		).toBe("");
	});

	it("contains and econtains self-branch", () => {
		expect(evaluateExpression('contains({title, "ell"}, {"yes", "no"})', ctx)).toBe("yes");
		expect(evaluateExpression('contains({title, "xyz"}, {"yes", "no"})', ctx)).toBe("no");
		expect(evaluateExpression('contains(title, "ell", {"hit"})', ctx)).toBe("hit");
		expect(evaluateExpression('contains(title, "xyz", {"hit"})', ctx)).toBe("");
		expect(evaluateExpression('contains(title, "ell")', ctx)).toBe(true);

		const epochCtx = createTestContext({
			fields: { epochTitles: ["Alpha", "", "Gamma"] },
		});
		expect(
			evaluateExpression(
				'econtains({slice(epochTitles, 0, 1), ""}, {None, slice(epochTitles, 0, 1)})',
				epochCtx,
			),
		).toEqual(["Alpha"]);
		expect(
			evaluateExpression(
				'econtains({slice(epochTitles, 1, 2), ""}, {None, slice(epochTitles, 1, 2)})',
				epochCtx,
			),
		).toBe(null);
		expect(evaluateExpression('econtains(tags, "a")', ctx)).toBe(true);
	});

	it("select matches numeric keys", () => {
		expect(evaluateExpression('select(2, {1, "A"}, {2, "B"})', ctx)).toBe("B");
	});

	it("select resolves property values", () => {
		expect(evaluateExpression("select(3, {1, \"Red\"}, {3, pageColour})", ctx)).toBe("Blue");
	});

	it("select uses wildcard fallback", () => {
		expect(evaluateExpression('select(9, {1, "A"}, {*, "none"})', ctx)).toBe("none");
	});

	it("slice and econtains for epoch pattern", () => {
		const epochCtx = createTestContext({
			fields: { epochTitles: ["Alpha", "", "Gamma"] },
		});
		const expr =
			'choice(econtains(slice(epochTitles, 0, 1), ""), None, slice(epochTitles, 0, 1))';
		expect(evaluateExpression(expr, epochCtx)).toEqual(["Alpha"]);
	});

	it("concatenates strings with properties", () => {
		expect(evaluateExpression('"**Parent:** " + parent', ctx)).toBe("**Parent:** [[Someone]]");
	});

	it("adds numeric frontmatter fields as numbers", () => {
		const numCtx = createTestContext({ fields: { numA: 10, numB: 3 } });
		expect(evaluateExpression("numA + numB", numCtx)).toBe(13);
		expect(evaluateExpression("numA - numB", numCtx)).toBe(7);
		expect(evaluateExpression("numA * numB", numCtx)).toBe(30);
	});

	it("evaluates or and and logical operators", () => {
		expect(evaluateExpression('choice(false or true, "yes", "no")', createTestContext())).toBe("yes");
		expect(evaluateExpression('choice(false and true, "yes", "no")', createTestContext())).toBe("no");
		expect(evaluateExpression('choice(false && true, "yes", "no")', createTestContext())).toBe("no");
		expect(evaluateExpression("choice((numA == 0) or (numB == 3), \"ok\", \"fail\")", createTestContext({ fields: { numA: 10, numB: 3 } }))).toBe("ok");
	});
});

describe("date and duration", () => {
	it("formats dates with Luxon-style tokens", () => {
		const ctx = createTestContext({
			file: {
				name: "Test",
				path: "Test.md",
				folder: "",
				mtime: pqDate(new Date("2024-06-15T14:30:00").getTime()),
				ctime: pqDate(new Date("2024-06-15T14:30:00").getTime()),
				size: 1,
				tags: [],
			},
		});
		const out = evaluateExpression('dateformat(file.mtime, "yyyy-MM-dd")', ctx);
		expect(out).toBe("2024-06-15");
	});

	it("subtracts dates to duration", () => {
		const a = pqDate(new Date("2024-06-15").getTime());
		const b = pqDate(new Date("2024-06-10").getTime());
		const ctx = createTestContext({ fields: { a, b } });
		const dur = evaluateExpression("a - b", ctx);
		expect(typeof dur).toBe("object");
		if (dur && typeof dur === "object" && "__pqDuration" in dur) {
			expect(dur.ms).toBe(5 * 24 * 60 * 60 * 1000);
		}
	});

	it("adds duration to date", () => {
		const start = pqDate(new Date("2024-01-01").getTime());
		const ctx = createTestContext({ fields: { start } });
		const result = evaluateExpression('start + dur(7, "days")', ctx);
		expect(typeof result).toBe("object");
		if (result && typeof result === "object" && "__pqDate" in result) {
			expect(new Date(result.ms).toISOString().slice(0, 10)).toBe("2024-01-08");
		}
	});

	it("adds calendar years to a date", () => {
		const ctx = createTestContext({ fields: { birthDate: "2000-01-01" } });
		const out = evaluateExpression('dateformat(date(birthDate) + dur(25, "years"), "yyyy")', ctx);
		expect(out).toBe("2025");
	});

	it("parses date(now) and date(today)", () => {
		expect(evaluateExpression('dateformat(date(today), "yyyy-MM-dd")', createTestContext())).toBe(
			moment().startOf("day").format("YYYY-MM-DD"),
		);
		expect(evaluateExpression('dateformat(date("now"), "yyyy-MM-dd")', createTestContext())).toBe(
			moment().format("YYYY-MM-DD"),
		);
	});

	it("formats durations with Luxon-style tokens", () => {
		const ctx = createTestContext();
		expect(evaluateExpression('durationformat(dur(90, "minutes"), "h:mm")', ctx)).toBe("1:30");
		expect(evaluateExpression('durationformat(dur(1, "day"), "d\' days\'")', ctx)).toBe("1 days");
		expect(evaluateExpression('durationformat(dur(5, "days") - dur(2, "days"), "d")', ctx)).toBe("3");
	});

	it("formats long date differences as duration", () => {
		const birth = pqDate(new Date("2000-01-01").getTime());
		const now = pqDate(new Date("2024-06-15").getTime());
		const ageCtx = createTestContext({ fields: { birth, now } });
		const formatted = evaluateExpression('durationformat(now - birth, "y\' years\'")', ageCtx);
		expect(formatted).toMatch(/^24 years$/);
	});
});

describe("evaluateExpressionSafe styles", () => {
	it("returns a styled value from a trailing AS clause", () => {
		const ctx = createTestContext({ fields: { characterStatus: "" } });
		const result = evaluateExpressionSafe(
			'default(characterStatus, "<font color=\\"#595959\\">Alive, Dead, Undead.</font>") AS card',
			ctx,
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(isPqStyled(result.value)).toBe(true);
			if (isPqStyled(result.value)) {
				expect(result.value.style).toBe("cards");
				expect(String(result.value.value)).toContain("Alive");
			}
		}
	});

	it("returns tags style from AS tag", () => {
		const ctx = createTestContext({ fields: { tags: ["alpha", "beta"] } });
		const result = evaluateExpressionSafe("tags AS tag", ctx);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(isPqStyled(result.value)).toBe(true);
			if (isPqStyled(result.value)) expect(result.value.style).toBe("tags");
		}
	});

	it("returns plain value without AS", () => {
		const result = evaluateExpressionSafe("title", createTestContext({ fields: { title: "Hello" } }));
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(isPqStyled(result.value)).toBe(false);
			expect(result.value).toBe("Hello");
		}
	});

	it("styles only the location branch inside default", () => {
		const withLoc = evaluateExpressionSafe(
			'default(location AS card, "*Unknown*")',
			createTestContext({ fields: { location: "Hall" } }),
		);
		expect(withLoc.ok).toBe(true);
		if (withLoc.ok) {
			expect(isPqStyled(withLoc.value)).toBe(true);
			if (isPqStyled(withLoc.value)) {
				expect(withLoc.value.style).toBe("cards");
				expect(withLoc.value.value).toBe("Hall");
			}
		}

		const missing = evaluateExpressionSafe(
			'default(location AS card, "*Unknown*")',
			createTestContext({ fields: { location: "" } }),
		);
		expect(missing.ok).toBe(true);
		if (missing.ok) {
			expect(isPqStyled(missing.value)).toBe(false);
			expect(missing.value).toBe("*Unknown*");
		}
	});

	it("builds fragments when concatenating a styled subexpression", () => {
		const result = evaluateExpressionSafe(
			'"**Location:** " + (location AS card) + " <br>"',
			createTestContext({ fields: { location: "Hall" } }),
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(isPqFragments(result.value)).toBe(true);
			if (isPqFragments(result.value)) {
				expect(result.value.parts).toHaveLength(3);
				expect(result.value.parts[0]).toBe("**Location:** ");
				expect(isPqStyled(result.value.parts[1]!)).toBe(true);
				expect(result.value.parts[2]).toBe(" <br>");
			}
		}
	});

	it("preserves styled values through choice", () => {
		const result = evaluateExpressionSafe(
			'choice(true, location AS card, "")',
			createTestContext({ fields: { location: "Hall" } }),
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(isPqStyled(result.value)).toBe(true);
			if (isPqStyled(result.value)) expect(result.value.value).toBe("Hall");
		}
	});
});

describe("cross-note wiki and link auto-pass", () => {
	const alice = createTestContext({
		fields: { title: "Alice Title", birthDate: "2000-01-01", status: "active" },
		file: {
			name: "Alice",
			path: "Characters/Alice.md",
			folder: "Characters",
			mtime: pqDate(1_700_000_000_000),
			ctime: pqDate(1_600_000_000_000),
			size: 42,
			tags: ["ally"],
		},
	});
	const bob = createTestContext({
		fields: { title: "Bob Title" },
		file: {
			name: "Bob",
			path: "Characters/Bob.md",
			folder: "Characters",
			mtime: pqDate(1_700_000_000_000),
			ctime: pqDate(1_600_000_000_000),
			size: 10,
			tags: [],
		},
	});

	function vaultCtx(fields: Record<string, unknown> = {}) {
		const deps = new Set<string>();
		return createTestContext({
			fields: fields as Record<string, import("../src/types").Value>,
			deps,
			resolveNote: (linkpath) => {
				const key = linkpath.replace(/\.md$/i, "");
				if (key === "Alice" || key === "Characters/Alice") return alice;
				if (key === "Bob" || key === "Characters/Bob") return bob;
				return null;
			},
		});
	}

	it("evaluates bare [[Alice]] to a wiki string when the note resolves", () => {
		expect(evaluateExpression("[[Alice]]", vaultCtx())).toBe("[[Alice]]");
	});

	it("reads [[Alice]].title and nested file.mtime", () => {
		const ctx = vaultCtx();
		expect(evaluateExpression("[[Alice]].title", ctx)).toBe("Alice Title");
		expect(evaluateExpression("[[Alice]].file.name", ctx)).toBe("Alice");
		const mtime = evaluateExpression("[[Alice]].file.mtime", ctx);
		expect(mtime).toEqual(alice.file.mtime);
	});

	it("returns null for missing notes and missing fields", () => {
		const ctx = vaultCtx();
		expect(evaluateExpression("[[Missing]].title", ctx)).toBeNull();
		expect(evaluateExpression("[[Alice]].nope", ctx)).toBeNull();
		expect(evaluateExpression('default([[Missing]].title, "unknown")', ctx)).toBe("unknown");
	});

	it("auto-passes link-valued parent.title", () => {
		const ctx = vaultCtx({ parent: "[[Alice]]" });
		expect(evaluateExpression("parent.title", ctx)).toBe("Alice Title");
		expect(evaluateExpression("parent.status", ctx)).toBe("active");
	});

	it("maps list-of-links .field to a list and supports multi-index", () => {
		const ctx = vaultCtx({
			linksProperty: ["[[Alice]]", "[[Bob]]", "[[Missing]]", "[[Alice]]", "[[Bob]]", "[[Alice]]"],
		});
		expect(evaluateExpression("linksProperty.title", ctx)).toEqual([
			"Alice Title",
			"Bob Title",
			null,
			"Alice Title",
			"Bob Title",
			"Alice Title",
		]);
		expect(evaluateExpression("linksProperty.title[0]", ctx)).toBe("Alice Title");
		expect(evaluateExpression("linksProperty.title[0,4,5]", ctx)).toEqual([
			"Alice Title",
			"Bob Title",
			"Alice Title",
		]);
	});

	it("records dependency paths during resolve", () => {
		const ctx = vaultCtx({ parent: "[[Alice]]" });
		evaluateExpression("parent.title", ctx);
		evaluateExpression("[[Bob]].title", ctx);
		expect(ctx.deps?.has("Characters/Alice.md")).toBe(true);
		expect(ctx.deps?.has("Characters/Bob.md")).toBe(true);
	});

	it("leaves nested object fields without links unchanged", () => {
		const ctx = vaultCtx({
			profile: { title: "Local", nested: { x: 1 } },
		});
		expect(evaluateExpression("profile.title", ctx)).toBe("Local");
		expect(evaluateExpression("profile.nested.x", ctx)).toBe(1);
	});
});

describe("@ multi-note query", () => {
	const alice = createTestContext({
		fields: { title: "Alice Title", workStatus: "retired", emailAddress: "a@ex.com" },
		file: {
			name: "Alice",
			path: "Employees/Management/Alice.md",
			folder: "Employees/Management",
			mtime: pqDate(1),
			ctime: pqDate(1),
			size: 1,
			tags: [],
		},
	});
	const bob = createTestContext({
		fields: { title: "Bob Title", workStatus: "Fired", emailAddress: "" },
		file: {
			name: "Bob",
			path: "Employees/Management/Bob.md",
			folder: "Employees/Management",
			mtime: pqDate(1),
			ctime: pqDate(1),
			size: 1,
			tags: [],
		},
	});
	const carol = createTestContext({
		fields: { title: "Carol Title", workStatus: "active", emailAddress: "c@ex.com" },
		file: {
			name: "Carol",
			path: "Employees/Staff/Carol.md",
			folder: "Employees/Staff",
			mtime: pqDate(1),
			ctime: pqDate(1),
			size: 1,
			tags: [],
		},
	});
	const roster = createTestContext({
		fields: { title: "Roster", workStatus: "meta" },
		file: {
			name: "Roster",
			path: "Employees/Management/Roster.md",
			folder: "Employees/Management",
			mtime: pqDate(1),
			ctime: pqDate(1),
			size: 1,
			tags: [],
		},
	});
	const allNotes = [alice, bob, carol, roster];

	function sourceCtx() {
		const deps = new Set<string>();
		return createTestContext({
			fields: roster.fields,
			file: roster.file,
			deps,
			listNotes: (fromArg) => {
				if (fromArg === "*") return allNotes;
				const folder = fromArg.replace(/\/$/, "");
				return allNotes.filter(
					(n) => n.file.folder === folder || n.file.path.startsWith(`${folder}/`),
				);
			},
		});
	}

	it("lists pages from a folder scope", () => {
		const ctx = sourceCtx();
		const listed = evaluateExpression('@({from("Employees/Management")})', ctx) as string[];
		expect(listed).toEqual(["[[Alice]]", "[[Bob]]", "[[Roster]]"]);
	});

	it("filters with where brace and ! negates / !this.file", () => {
		const ctx = sourceCtx();
		expect(
			evaluateExpression(
				'@({from("Employees/Management")}, {!this.file, !contains(workStatus, "Fired")})',
				ctx,
			),
		).toEqual(["[[Alice]]"]);
	});

	it("maps with this = source note", () => {
		const ctx = sourceCtx();
		expect(
			evaluateExpression(
				'@({from("Employees/Management")}, {!this.file, contains(workStatus, "retired")}, {this.file.name + " → " + title})',
				ctx,
			),
		).toEqual(["Roster → Alice Title"]);
	});

	it("ANDs where predicates", () => {
		const ctx = sourceCtx();
		expect(
			evaluateExpression(
				'@({from("*")}, {contains(workStatus, "retired"), any(emailAddress)}, {title})',
				ctx,
			),
		).toEqual(["Alice Title"]);
	});

	it("returns empty when over hard cap", () => {
		const many = Array.from({ length: 251 }, (_, i) =>
			createTestContext({
				fields: { title: `N${i}` },
				file: {
					name: `N${i}`,
					path: `Bulk/N${i}.md`,
					folder: "Bulk",
					mtime: pqDate(1),
					ctime: pqDate(1),
					size: 1,
					tags: [],
				},
			}),
		);
		const ctx = createTestContext({
			listNotes: () => many,
		});
		expect(evaluateExpression('@({from("Bulk")})', ctx)).toEqual([]);
	});

	it("maps with AS styles (paren and bare)", () => {
		const ctx = sourceCtx();
		const paren = evaluateExpressionSafe(
			'@({from("Employees/Management")}, {any(workStatus)}, {(workStatus AS pill)})',
			ctx,
		);
		expect(paren.ok).toBe(true);
		if (paren.ok) {
			expect(Array.isArray(paren.value)).toBe(true);
			const list = paren.value as import("../src/types").Value[];
			expect(list.length).toBeGreaterThan(0);
			expect(isPqStyled(list[0]!)).toBe(true);
			if (isPqStyled(list[0]!)) {
				expect(list[0].style).toBe("badge");
				expect(list[0].value).toBe("retired");
			}
		}

		const bare = evaluateExpression(
			'@({from("Employees/Management")}, {contains(workStatus, "retired")}, {workStatus AS pill})',
			ctx,
		);
		expect(Array.isArray(bare)).toBe(true);
		expect(isPqStyled((bare as import("../src/types").Value[])[0]!)).toBe(true);
	});
});
