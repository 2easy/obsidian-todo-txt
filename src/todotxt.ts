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

// Completed items are visible only on the day they were completed; the day
// after, they disappear from all views.
export function isVisible(t: Task, today: string): boolean {
	if (!t.completed) return true;
	return t.completionDate === today;
}

// Today view = due <= today AND (not done, or completed today).
export function inToday(t: Task, today: string): boolean {
	if (!t.due) return false;
	if (t.due > today) return false;
	if (!t.completed) return true;
	return t.completionDate === today;
}

export function isPastDue(t: Task, today: string): boolean {
	return !!t.due && t.due < today;
}
