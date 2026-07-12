# Nudge — Spec

Nudge is a task manager built as an Obsidian plugin, backed by a single `todo.txt`-formatted
file. Built because installing third-party apps isn't allowed, but Obsidian (with community
plugins enabled) already is.

## Platform & Packaging

- Obsidian community plugin, **not** a standalone binary.
- **TypeScript + esbuild**, based on the official Obsidian sample plugin template.
- **Desktop-only, macOS-only.** No mobile support.
- Loaded locally as an unpacked dev plugin (`VaultFolder/.obsidian/plugins/nudge/`) —
  no store listing, no signing/notarization needed.
- Runs inside Obsidian's own window/process, so Cmd+Tab, Dock icon, and window sizing are
  inherited for free from Obsidian itself — nothing custom needed there.

## Storage

- Single file: `todo.txt`, stored inside the vault at a configurable path (default: vault root).
- Format: [todo.txt spec](http://todotxt.org/) with custom key:value extensions.
- **Lists** = `+ProjectName` tags on each line. Lists are **dynamically derived** by scanning
  all `+project` tags present in the file — no separate config of "which lists exist."
- A list remains visible in the sidebar as long as it has **at least one item**, completed
  or not.
- **Physical line order in the file is the display order, everywhere** — including the Today
  view. There is no separate `order:` field; position in the file *is* the order.
- **No long-lived in-memory cache.** Every render reads the file fresh from disk. Every
  mutation (checkbox toggle, drag, edit, delete) is: read current file → apply the one change
  → write back. This keeps the race window for external edits (e.g. an agent rewriting the
  file) to milliseconds.
- Plugin subscribes to the vault's `modify` event for this file and re-renders automatically
  when the file changes externally.

### Line format

```
(A) Buy milk +Groceries due:2026-07-12 link:https://example.com rec:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR
x 2026-07-11 Buy milk +Groceries due:2026-07-11
```

- Priority: standard todo.txt `(A)`/`(B)`/`(C)` prefix, or omitted for "None".
  - Mapping: None / Low=(C) / Med=(B) / High=(A).
- `+ProjectName`: list membership (todo.txt spec).
- `due:YYYY-MM-DD`: due date (de facto todo.txt extension).
- `link:<url>`: custom extension for an associated link.
- `rec:<RRULE>`: custom extension. Value is a full [iCalendar RRULE](https://icalendar.org/rrule-tool.html)
  string (via the `rrule` npm library), e.g. `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR` for "every
  workday", `FREQ=MONTHLY;BYDAY=1SU` for "first Sunday of the month".
- Completed items: prefixed `x <completion-date>` per spec, kept in the file (never deleted
  by completion — only explicit Delete removes a line).

## Views

- Custom Obsidian `ItemView` — its own pane/tab, entirely custom HTML/CSS. **Not**
  markdown-block-rendered; `todo.txt` is storage only, never viewed as a rendered note.
- Layout: sidebar-within-the-pane. Left rail = list of lists. Right = items in the
  selected list.
- Sidebar order: **"Today" pinned first**, then all other lists **alphabetically**.
- **Today view**: automatically populated filter, `due: <= today AND not done`. No manual
  add. Items whose due date is in the past render with the date **highlighted in red**
  (still shown, not hidden). An item in Today is still physically a member of its original
  `+project` list — Today is a filter, not a separate storage location.
- **Completed items**: hidden from view on the day *after* they were completed. On the day
  they're completed, they remain visible in their list (and Today, if applicable),
  struck-through — gives a sense of daily progress before disappearing.
- Items default to **read-only** display. Hovering an item reveals **Edit** and **Delete**
  icon buttons.

## Item Model (Create/Edit Modal)

All fields are entered through a structured modal — no hand-typed todo.txt syntax.

| Field | Control | Encoding |
|---|---|---|
| Text | free text input | line description |
| List | dropdown of existing lists + "add new" | `+ProjectName` |
| Due date | date picker | `due:YYYY-MM-DD` |
| Priority | select: None / Low / Med / High | `(C)` / `(B)` / `(A)` / none |
| Link | URL input | `link:<url>`, rendered as a clickable 🔗 button in the list (quick one-click access to the associated link) |
| Recurrence | structured picker (see below) | `rec:<RRULE>` |

- **Edit** opens the same modal, pre-filled with the item's current values.
- **Delete** is immediate — no confirmation dialog. Relies on Obsidian's file history /
  version control for recovery, since deletion is just a line removal in a plain text file.

### Recurrence picker

- UI: dropdown for pattern type (Daily / Weekly / Monthly / Custom workdays / Nth-weekday-
  of-month), plus interval number and weekday checkboxes as needed by the chosen type.
  Builds an RRULE string internally — user never sees or types RRULE syntax.
- Storage: `rec:<RRULE>` token, computed/consumed via the `rrule` npm package.
- Mechanic: **passive only, no OS notifications.** An item just appears in Today once its
  `due:` date arrives (per the Today filter above).
- **Completion behavior:** completing a recurring item does not just mark it `x` — it also
  spawns the **next occurrence** as a new line, with a new `due:` date computed by `rrule`
  from the pattern.
- **Anchor:** the next occurrence's date is computed from the item's **original due date**,
  not the completion timestamp — so completing something late doesn't drift the recurring
  schedule forward.

## Drag and Drop

Since file line order = display order everywhere, all drags are implemented as direct
line-position/content edits in `todo.txt`:

- **Drag between lists**: rewrites the item's `+project` tag to the destination list.
- **Drag into Today**: overwrites `due:` to today's date. Destructive — original due date
  is not preserved separately.
- **Drag to reorder within a list, or within Today**: physically repositions the line in
  the file to sit at the new position. Dragging within Today can reposition a line relative
  to items that live in *different* `+project` lists elsewhere in the file — position is
  global to the file, not scoped to project tags.

## Sorting

There is no automatic sort by priority/due-date. Order is always manual, driven entirely by
physical line position in the file.

## Concurrency / External Edits

Because the file is meant to be handed to an external agent for Q&A, the plugin is
defensive about external writes:

- No in-memory state persists across renders; every operation reads the current file state
  immediately before acting.
- File-watch (`modify` event) triggers automatic re-render, so external edits (e.g. an
  agent modifying `todo.txt` directly) show up without reopening the pane.
- No file locking or conflict warnings — the collision window is considered small enough
  (milliseconds, only during truly simultaneous edits) not to warrant extra complexity.

## Explicit Non-Goals (for this version)

- OS-level notifications/popups.
- Obsidian mobile support.
- Manual sidebar reordering of lists (fixed: Today first, then alphabetical).
- Preserving an item's original due date when dragged into Today.
- Delete confirmation dialogs.
- Any standalone macOS binary / app bundle — superseded entirely by the Obsidian plugin
  approach.
