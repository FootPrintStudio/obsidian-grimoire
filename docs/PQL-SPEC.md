# Property Query Language (PQL) — Specification v0.4

Grimoire evaluates inline PQL expressions in Obsidian **Reading view** using the `q=` prefix (configurable).

```markdown
`q= default(title, "Untitled")`
```

## Scope

PQL is always scoped to the **current note** being rendered. It does not query other pages (cross-note lookup is a future extension).

## Context model

### Frontmatter fields

Bare identifiers read YAML frontmatter:

| Syntax | Meaning |
|--------|---------|
| `title` | Frontmatter field `title` |
| `this.title` | Same (optional alias) |

### Page metadata (`file.*`)

Reserved namespace for native file metadata:

| Field | Type | Source |
|-------|------|--------|
| `file.name` | string | Basename without extension |
| `file.path` | string | Vault path |
| `file.folder` | string | Parent folder |
| `file.ctime` | date | Creation time |
| `file.mtime` | date | Modification time |
| `file.size` | number | Bytes |
| `file.tags` | list | Merged YAML + inline `#tags` |

`this.file.*` is accepted as a deprecated alias for `file.*`.

A frontmatter field named `file` (without `.`) is still accessible as a bare identifier; only `file.<member>` uses the reserved namespace.

## Value types

| Type | Notes |
|------|-------|
| `null` | Empty/missing; `None` literal alias |
| `boolean`, `number`, `string` | |
| `date` | Internal ms epoch; formatted via Obsidian moment |
| `duration` | Internal ms length |
| `list` | YAML arrays |

## Operators

| Category | Operators |
|----------|-----------|
| Arithmetic | `+` `-` `*` `/` `%` |
| Comparison | `==` `!=` `<` `>` `<=` `>=` |
| Logical | `and`, `or`, `not`, `&&` |
| Grouping | `( )` |
| Member / index | `.property`, `[index]` |

### String concatenation

If either operand to `+` is a string, both sides coerce to string.

### Date and duration arithmetic

| Expression | Result |
|------------|--------|
| `date - date` | duration |
| `date + duration` | date |
| `date - duration` | date |
| `duration ± duration` | duration |
| `duration * number` | duration |
| `duration / number` | duration |

Duration literals: `dur(1, "day")`, `dur(3, "months")`, `dur("1 day 2 hours")`.

## Functions

### Tier 1 — core

| Function | Description |
|----------|-------------|
| `default(v, fallback)` | Return `v` if truthy/non-empty, else `fallback` |
| `choice(cond, a, b)` | Boolean branch |
| `select(key, {k,v}, …)` | Key lookup; `{*, fallback}` wildcard |
| `any(v, …candidates)` | One arg: non-empty; multi-arg: any candidate contained in property |
| `slice(list, start, end?)` | List slice |
| `contains(hay, needle)` | Substring / partial list match |
| `econtains(hay, needle)` | Exact element match |
| `dateformat(date, fmt)` | Format date (Luxon tokens aliased to moment) |

### Tier 2

| Function | Description |
|----------|-------------|
| `dur(n, unit)` / `dur(string)` | Duration value |
| `durationformat(dur, fmt?)` | Format duration; without `fmt`, human-readable. With `fmt`, Luxon/Dataview duration tokens (`y`, `M`, `d`, `h`, `m`, `s`, …). Literal text in single quotes. Not the same token set as `dateformat`. |
| `date(string \| now \| today)` | Parse ISO date string, or current time / start of today |
| `length(v)` | String/list length |
| `coalesce(a, b, …)` | First truthy value |
| `join(list, sep)` | Join list with separator |

## `select()` syntax

```markdown
`q= select(3, {1, "Red"}, {2, "Green"}, {3, pageColour}, {*, "Unknown"})`
```

- First argument: lookup key (string or number)
- Remaining arguments: braced `{ key, value }` pairs
- Keys compared with type-aware equality
- `{*, value}` or `{default, value}` or `{_, value}` — fallback when no key matches

## Query grammar

```
expression := orExpr [ "AS" style ]
query := expression
style := "card" | "cards" | "tag" | "tags" | "button" | "buttons" | "cards-code" | "code" | "inline" | "list" | …
```

`AS` is an expression postfix (available on call arguments and inside parentheses), not a binary operator. `as` as a field name is still an identifier (`as AS card`). Root `expr AS card` styles the whole result; `default(location AS card, "*Unknown*")` styles only the location branch. Concat mixes require parens: `"**Location:** " + (location AS card)`.

Hyphenated styles (`cards-code`) are a single style token.

## Output rendering

| Result | Pipeline |
|--------|----------|
| Markdown markers / wikilinks (even with HTML tags like `<br>`) | `MarkdownRenderer.render` |
| HTML tags only (no markdown markers) | `innerHTML` |
| Plain text / numbers | text node |
| `null` | empty |
| Styled value (`AS …`) | Text pills, tag chips, buttons, or list |
| Fragments (plain + styled concat) | Inline mix of markdown/HTML/text and styled chips |
| Error | red inline `pq-error` |

## Date formatting tokens

PQL accepts **Luxon-style aliases** (Dataview habit) and maps them to Obsidian moment:

| Luxon alias | moment |
|-------------|--------|
| `yyyy` | `YYYY` |
| `dd` | `DD` |
| `HH`, `mm`, `ss` | unchanged |

Example: `` `q= dateformat(file.mtime, "yyyy-MM-dd HH:mm:ss")` ``

## Non-goals

- `$=` inline JavaScript
- ` ```dataview` block queries
- Live Preview inline widget
- Vault bulk migration tooling
