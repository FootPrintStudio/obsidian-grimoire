# P3 calendar cases (Grimoire ↔ Epochs)

Runnable automated suite: `npm test` → `test/epochs-e2e.test.ts` (4 plan cases).

Vault smoke path (local): `/home/carl-heinz/Desktop/Test Vault` — paste fixtures from `obsidian-epochs/test/fixtures/p3-calendars.md`. Cloud agents cannot read that path.

| Case | Setup | Expressions | Expected |
|------|--------|-------------|----------|
| **1 Gregorian-only** | Epochs unloaded or unused | `` `q= dateformat(date("2003-10-03"), "MMMM ddO, yyyy")` `` | `October 3rd, 2003` |
| **2 Months calendar** | Epochs + `aether` calendar note | `` `q= dateformat(birthDate, "MMMM d, y G")` `` with `{ calendar: aether, year: 312, month: Greentide, day: 4 }` | `Greentide 4, 312 Age of Flame` |
| **2b dur / durationformat** | same | `` `q= dateformat(date(birthDate) + dur(2, "years"), "y")` `` · `` `q= durationformat(date("aether:314-Greentide-4") - birthDate, "y' years'")` `` | `314` · `2 years` |
| **3 Monthless year-day** | Epochs + `spiral` (`months: []`) | `` `q= dateformat(spiralMark, "d, y G")` `` with `{ calendar: spiral, year: 50, day: 120 }` | `120, 50 Spiral Age` |
| **4 Missing Epochs** | Epochs disabled | fantasy `date("aether:…")` / frontmatter object | empty result; ISO Gregorian still formats |

Peer mins: Epochs **≥ 0.1.1** · Grimoire **≥ 0.9.1**.
