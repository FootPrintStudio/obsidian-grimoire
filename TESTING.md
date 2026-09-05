# Grimoire — testing checklist

Open **`Property Query Test/00 Smoke Test.md`** in **Reading view** with Grimoire enabled. The suite includes **three examples per function and operator** with an Expected column for manual verification.

## Unit tests

```bash
bash test.sh
```

Tests cover parse (including `AS` styles), eval, dates, highlight tokenizer, coerce, and Dataview coexistence logic.

## Reading view checklist

- [ ] `` `q= title` `` shows frontmatter title
- [ ] `` `q= dateformat(file.mtime, "yyyy-MM-dd HH:mm:ss")` `` formats mtime
- [ ] HTML placeholder row renders styled `<em>` text
- [ ] `` `q= choice(any(tags), tags, "no tags")` `` shows tag list
- [ ] `` `q= select(2, …)` `` shows **Green**
- [ ] `` `q= select(3, …, pageColour)` `` shows **Blue**
- [ ] `` `q= "**Parent:** " + parent` `` renders bold + wikilink
- [ ] Image markdown row renders an image
- [ ] Epoch slice row shows empty or title segment
- [ ] Duration row shows human-readable age span
- [ ] Error row shows red inline message (*Grimoire error* unless Debug mode is on)
- [ ] Dataview `` `= this.refreshMarker` `` still works when Dataview enabled
- [ ] `` `q= … AS card` `` renders text pill chips (HTML inside a card is allowed)
- [ ] `` `q= file.tags AS tag` `` renders clickable tag chips
- [ ] `` `q= file.tags AS card` `` renders text pills (no auto tag styling)
- [ ] `` `q= default(location AS card, "*Unknown*")` `` cards only when location is set; fallback stays italic markdown
- [ ] `` `q= "**Location:** " + (location AS card) + " <br>"` `` mixes bold label, card chip, and break
- [ ] `` `q= parent AS button` `` renders a link button

## Syntax highlighting checklist

Requires **Syntax highlight inline queries** on (default).

- [ ] **Source mode:** `` `q= choice(title, "Untitled") AS card` `` shows colored tokens, including `as` as a keyword
- [ ] **Reading view + eval off:** same expression shows colored source, not a result
- [ ] **Reading view + eval on:** results replace inline code (no source colors)
- [ ] Toggle **Syntax highlight inline queries** off → plain monospace everywhere
- [ ] Toggling **Enable in Reading view** updates the preview without reopening the note

## Refresh test

Requires **Settings → Refresh on metadata change** enabled (off by default).

1. Open smoke test in Reading view
2. Edit frontmatter `refreshMarker` or an embedded note field
3. Confirm query output updates after metadata cache refresh
