import { App, PluginSettingTab, Setting } from "obsidian";
import type TodoTxtRemindersPlugin from "../main";

export interface TodoSettings {
	path: string;
}

export const DEFAULT_SETTINGS: TodoSettings = {
	path: "todo.txt",
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
	}
}
