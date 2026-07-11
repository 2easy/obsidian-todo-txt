// Hotkey capture/matching. A hotkey is stored as a normalized string with
// modifiers in a fixed order, e.g. "Meta+N", "Ctrl+Shift+Enter".

const MODIFIER_KEYS = new Set([
	"Control",
	"Alt",
	"Shift",
	"Meta",
	"CapsLock",
]);

export function isModifierOnly(e: KeyboardEvent): boolean {
	return MODIFIER_KEYS.has(e.key);
}

export function eventToHotkey(e: KeyboardEvent): string {
	const parts: string[] = [];
	if (e.ctrlKey) parts.push("Ctrl");
	if (e.altKey) parts.push("Alt");
	if (e.shiftKey) parts.push("Shift");
	if (e.metaKey) parts.push("Meta");
	let key = e.key;
	if (key.length === 1) key = key.toUpperCase();
	parts.push(key);
	return parts.join("+");
}

export function matchHotkey(e: KeyboardEvent, stored: string): boolean {
	if (!stored || isModifierOnly(e)) return false;
	return eventToHotkey(e) === stored;
}

const SYMBOLS: Record<string, string> = {
	Ctrl: "⌃",
	Alt: "⌥",
	Shift: "⇧",
	Meta: "⌘",
};

export function hotkeyToDisplay(stored: string): string {
	if (!stored) return "";
	const parts = stored.split("+");
	const key = parts.pop() ?? "";
	const mods = parts.map((m) => SYMBOLS[m] ?? m).join("");
	return mods + key;
}
