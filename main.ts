import {
	Notice,
	ObsidianProtocolData,
	Plugin,
	TAbstractFile,
	WorkspaceLeaf,
} from "obsidian";
import { TodoStore, deriveLists } from "./src/store";
import { DEFAULT_SETTINGS, TodoSettings, TodoSettingTab } from "./src/settings";
import { TodoView, VIEW_TYPE_TODO } from "./src/view";
import { TaskModal } from "./src/modal";
import { matchHotkey } from "./src/hotkey";
import { Priority, Task } from "./src/todotxt";

// Accepts "A"/"B"/"C" (case-insensitive) or the words used in the modal.
function parsePriority(raw: string | undefined): Priority {
	if (!raw) return null;
	const v = raw.trim().toLowerCase();
	if (v === "a" || v === "high") return "A";
	if (v === "b" || v === "med" || v === "medium") return "B";
	if (v === "c" || v === "low") return "C";
	return null;
}

export default class TodoTxtRemindersPlugin extends Plugin {
	settings!: TodoSettings;
	store!: TodoStore;
	private keepOpen = false;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.store = new TodoStore(this.app, this.settings.path);

		this.registerView(
			VIEW_TYPE_TODO,
			(leaf: WorkspaceLeaf) => new TodoView(leaf, this)
		);

		this.addRibbonIcon("list-todo", "Open Todo.txt Reminders", () => {
			void this.activateView();
		});

		this.addRibbonIcon("plus-circle", "New reminder", () => {
			void this.newReminder();
		});

		this.addCommand({
			id: "open-todo-txt-reminders",
			name: "Open Todo.txt Reminders",
			callback: () => void this.activateView(),
		});

		this.addCommand({
			id: "new-todo-txt-reminder",
			name: "New reminder",
			callback: () => void this.newReminder(),
		});

		this.addSettingTab(new TodoSettingTab(this.app, this));

		// obsidian://todo-txt-reminders?text=...&list=...&due=YYYY-MM-DD&
		//   priority=high|med|low|A|B|C&link=...&rec=<RRULE>&modal=1
		// With text present it creates the item directly; pass modal=1 (or omit
		// text) to open the prefilled create modal instead.
		this.registerObsidianProtocolHandler("todo-txt-reminders", (params) => {
			void this.handleUri(params);
		});

		// Keep the view effectively unclosable: once it has been open, reopen
		// it immediately if it gets closed.
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				if (
					this.keepOpen &&
					this.app.workspace.getLeavesOfType(VIEW_TYPE_TODO).length === 0
				) {
					void this.activateView();
				}
			})
		);

		// Configurable global shortcut to open the new-reminder window. Uses a
		// capture-phase listener so it can override Obsidian's own binding for
		// the same combo (e.g. Cmd+N → New note).
		this.registerDomEvent(
			document,
			"keydown",
			(e: KeyboardEvent) => {
				const hk = this.settings.newItemHotkey;
				if (!hk) return;
				const target = e.target as HTMLElement | null;
				if (target?.closest(".todo-hotkey-input")) return; // recording
				if (!matchHotkey(e, hk)) return;
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
				void this.newReminder();
			},
			{ capture: true }
		);

		// Re-render open views when the backing file changes on disk (e.g. an
		// external agent rewriting todo.txt).
		this.registerEvent(
			this.app.vault.on("modify", (file: TAbstractFile) => {
				if (file.path === this.settings.path) this.refreshViews();
			})
		);
	}

	onunload(): void {
		// Leaves are detached automatically by Obsidian on unload.
	}

	markViewOpen(): void {
		this.keepOpen = true;
	}

	async handleUri(params: ObsidianProtocolData): Promise<void> {
		const text = (params.text ?? "").trim();
		const list =
			(params.list ?? "").replace(/\s+/g, "") || this.settings.defaultList;
		const prefill: Partial<Task> = {
			text,
			projects: [list],
			due: params.due || null,
			priority: parsePriority(params.priority),
			link: params.link || null,
			rec: params.rec || null,
		};

		const wantsModal = !!params.modal || text.length === 0;
		if (wantsModal) {
			const lists = deriveLists(await this.store.readTasks());
			new TaskModal(this.app, lists, null, list, async (task) => {
				await this.store.addTask(task);
				this.refreshViews();
			}, prefill).open();
			return;
		}

		const task: Task = {
			completed: false,
			completionDate: null,
			creationDate: null, // stamped by the store
			priority: prefill.priority ?? null,
			text,
			projects: [list],
			due: prefill.due ?? null,
			link: prefill.link ?? null,
			rec: prefill.rec ?? null,
			raw: "",
		};
		await this.store.addTask(task);
		new Notice(`Reminder added to ${list}`);
		this.refreshViews();
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null =
			workspace.getLeavesOfType(VIEW_TYPE_TODO)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getLeaf(true);
			await leaf.setViewState({ type: VIEW_TYPE_TODO, active: true });
		}
		workspace.revealLeaf(leaf);
	}

	// Open the create modal from anywhere (command / ribbon), independent of
	// whether a view is focused. Presets the list to the active view's
	// selection when it's a real project list.
	async newReminder(): Promise<void> {
		const tasks = await this.store.readTasks();
		const lists = deriveLists(tasks);
		// Preset to the focused view's selected project, else the default list.
		let preset: string | null = null;
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_TODO)) {
			if (leaf.view instanceof TodoView) {
				preset = leaf.view.getSelectedList();
				break;
			}
		}
		if (!preset) preset = this.settings.defaultList;
		new TaskModal(this.app, lists, null, preset, async (task) => {
			await this.store.addTask(task);
			this.refreshViews();
		}).open();
	}

	refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_TODO)) {
			const view = leaf.view;
			if (view instanceof TodoView) void view.refresh();
		}
	}

	onPathChanged(): void {
		this.store.setPath(this.settings.path);
		this.refreshViews();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
