import { Plugin, TAbstractFile, WorkspaceLeaf } from "obsidian";
import { TodoStore, deriveLists } from "./src/store";
import { DEFAULT_SETTINGS, TodoSettings, TodoSettingTab } from "./src/settings";
import { TodoView, VIEW_TYPE_TODO } from "./src/view";
import { TaskModal } from "./src/modal";

export default class TodoTxtRemindersPlugin extends Plugin {
	settings!: TodoSettings;
	store!: TodoStore;

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
		let defaultList: string | null = null;
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_TODO)) {
			if (leaf.view instanceof TodoView) {
				defaultList = leaf.view.getSelectedList();
				break;
			}
		}
		new TaskModal(this.app, lists, null, defaultList, async (task) => {
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
