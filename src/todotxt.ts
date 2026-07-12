// Parsing / serialization for the todo.txt format with the custom
// due:/link:/rec: extensions described in SPEC.md.

export type Priority = "A" | "B" | "C" | null;

export interface Task {
	completed: boolean;
	completionDate: string | null; // YYYY-MM-DD
	creationDate: string | null; // YYYY-MM-DD (required by spec if completed)
	priority: Priority;
	text: string; // description with recognized tokens removed
	projects: string[]; // list names, without the leading '+'
	due: string | null; // YYYY-MM-DD
	link: string | null;
	rec: string | null; // raw RRULE string
	raw: string; // the original line, verbatim
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseTask(raw: string): Task {
	let s = raw.trim();
	let completed = false;
	let completionDate: string | null = null;
	let creationDate: string | null = null;
	let priority: Priority = null;

	// Completion marker: leading "x " per spec, followed by the completion date.
	if (s === "x" || s.startsWith("x ")) {
		completed = true;
		s = s.slice(1).trimStart();
		const first = s.split(/\s+/)[0] ?? "";
		if (DATE_RE.test(first)) {
			completionDate = first;
			s = s.slice(first.length).trimStart();
		}
	}

	// Priority prefix: (A) / (B) / (C) ...
	const pm = s.match(/^\(([A-Z])\)\s+/);
	if (pm) {
		priority = pm[1] as Priority;
		s = s.slice(pm[0].length);
	}

	// Creation date: a bare leading date. For completed tasks this is the
	// second date (after the completion date); for active tasks it follows
	// the optional priority.
	const lead = s.split(/\s+/)[0] ?? "";
	if (DATE_RE.test(lead)) {
		creationDate = lead;
		s = s.slice(lead.length).trimStart();
	}

	const words = s.length ? s.split(/\s+/) : [];
	const projects: string[] = [];
	let due: string | null = null;
	let link: string | null = null;
	let rec: string | null = null;
	const textWords: string[] = [];

	for (const w of words) {
		if (w.startsWith("+") && w.length > 1) {
			projects.push(w.slice(1));
		} else if (w.startsWith("due:") && w.length > 4) {
			due = w.slice(4);
		} else if (w.startsWith("link:") && w.length > 5) {
			link = w.slice(5);
		} else if (w.startsWith("rec:") && w.length > 4) {
			rec = w.slice(4);
		} else if (w.startsWith("pri:") && w.length === 5) {
			// Priority preserved on completed items (which drop the (A) prefix).
			if (!priority) priority = w.slice(4) as Priority;
		} else {
			textWords.push(w);
		}
	}

	return {
		completed,
		completionDate,
		creationDate,
		priority,
		text: textWords.join(" "),
		projects,
		due,
		link,
		rec,
		raw,
	};
}

export function serializeTask(t: Task): string {
	const parts: string[] = [];
	if (t.completed) {
		parts.push("x");
		if (t.completionDate) parts.push(t.completionDate);
	} else if (t.priority) {
		parts.push(`(${t.priority})`);
	}
	// Creation date follows the completion/priority prefix. The spec requires
	// it whenever a completion date is present.
	if (t.creationDate) parts.push(t.creationDate);
	if (t.text) parts.push(t.text);
	for (const p of t.projects) parts.push("+" + p);
	if (t.due) parts.push("due:" + t.due);
	if (t.link) parts.push("link:" + t.link);
	if (t.rec) parts.push("rec:" + t.rec);
	// A completed line drops the (A) prefix, so keep priority as a pri: key.
	if (t.completed && t.priority) parts.push("pri:" + t.priority);
	return parts.join(" ");
}

// --- date helpers -------------------------------------------------------

export function todayStr(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

// --- visibility / filtering ---------------------------------------------

// Completed items are visible only on the day they were completed (unless
// showCompletedToday is off, hiding them immediately); the day after, they
// disappear from all views regardless.
export function isVisible(
	t: Task,
	today: string,
	showCompletedToday: boolean
): boolean {
	if (!t.completed) return true;
	return showCompletedToday && t.completionDate === today;
}

// Today view = due <= today AND (not done, or completed today when shown).
export function inToday(
	t: Task,
	today: string,
	showCompletedToday: boolean
): boolean {
	if (!t.due) return false;
	if (t.due > today) return false;
	if (!t.completed) return true;
	return showCompletedToday && t.completionDate === today;
}

export function isPastDue(t: Task, today: string): boolean {
	return !!t.due && t.due < today;
}

// Project tags can't contain spaces, so a multi-word list is stored camelCase
// (e.g. "HomeChores"). For display we split it back into words. Storage is
// unaffected — this is display-only. Handles acronyms too ("HTMLParser").
// Normalize a list name for matching, ignoring spaces and case so that
// "Home Chores", "homechores", and "HomeChores" all match.
export function normalizeListName(name: string): string {
	return name.replace(/\s+/g, "").toLowerCase();
}

export function humanizeProject(name: string): string {
	return name
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.trim();
}
