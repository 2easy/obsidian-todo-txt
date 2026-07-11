import { App, PluginSettingTab, Setting } from "obsidian";
import type TodoTxtRemindersPlugin from "../main";
import {
	eventToHotkey,
	hotkeyToDisplay,
	isModifierOnly,
} from "./hotkey";

export interface TodoSettings {
	path: string;
	newItemHotkey: string; // normalized hotkey, e.g. "Meta+N"; "" disables
}

export const DEFAULT_SETTINGS: TodoSettings = {
	path: "todo.txt",
	newItemHotkey: "Meta+N",
};

export class TodoSettingTab extends PluginSettingTab {
	plugin: TodoTxtRemindersPlugin;

	constructor(app: App, plugin: TodoTxtRemindersPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Todo.txt file path")
			.setDesc("Vault-relative path to the todo.txt file backing this plugin.")
			.addText((text) =>
				text
					.setPlaceholder("todo.txt")
					.setValue(this.plugin.settings.path)
					.onChange(async (value) => {
						this.plugin.settings.path = value.trim() || "todo.txt";
						await this.plugin.saveSettings();
						this.plugin.onPathChanged();
					})
			);

		new Setting(containerEl)
			.setName("New reminder hotkey")
			.setDesc(
				"Shortcut to open the new reminder window from anywhere. Click the field and press the combination; press Backspace to clear. Overrides Obsidian's default binding for that combo."
			)
			.addText((text) => {
				text.inputEl.addClass("todo-hotkey-input");
				text.inputEl.readOnly = true;
				text.setPlaceholder("Press keys…");
				text.setValue(hotkeyToDisplay(this.plugin.settings.newItemHotkey));
				text.inputEl.addEventListener("keydown", async (e) => {
					e.preventDefault();
					if (e.key === "Backspace" || e.key === "Delete") {
						this.plugin.settings.newItemHotkey = "";
					} else if (isModifierOnly(e)) {
						return; // wait for a real key
					} else {
						this.plugin.settings.newItemHotkey = eventToHotkey(e);
					}
					await this.plugin.saveSettings();
					text.setValue(
						hotkeyToDisplay(this.plugin.settings.newItemHotkey)
					);
					text.inputEl.blur();
				});
			});
	}
}
