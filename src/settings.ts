import { App, Component, PluginSettingTab, Setting } from "obsidian";
import {
	renderGuidePanel,
	renderReadmePanel,
	renderSettingsTabBar,
	type PluginSettingsTabId,
} from "./readmeTab";
import type GrimoirePlugin from "./main";
import { DEFAULT_SETTINGS } from "./types";

export class PropertyQuerySettingTab extends PluginSettingTab {
	plugin: GrimoirePlugin;
	private activeTab: PluginSettingsTabId = "settings";
	private docComponent = new Component();

	constructor(app: App, plugin: GrimoirePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	hide(): void {
		this.docComponent.unload();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		this.docComponent.unload();
		this.docComponent = new Component();

		containerEl.createEl("h2", { text: "Grimoire" });

		const tabBar = containerEl.createDiv();
		renderSettingsTabBar(tabBar, this.activeTab, (tab) => {
			this.activeTab = tab;
			this.display();
		}, "pq");

		const content = containerEl.createDiv({ cls: "pq-settings-content" });
		const pluginDir =
			this.plugin.manifest.dir ??
			`${this.app.vault.configDir}/plugins/${this.plugin.manifest.id}`;

		if (this.activeTab === "readme") {
			renderReadmePanel(this.app, content, this.docComponent, "pq-readme-panel", pluginDir);
			return;
		}

		if (this.activeTab === "guide") {
			renderGuidePanel(this.app, content, this.docComponent, "pq-guide-panel", pluginDir);
			return;
		}

		this.displaySettings(content);
	}

	private displaySettings(containerEl: HTMLElement): void {
		containerEl.createEl("p", {
			text: "Evaluate inline Grimoire expressions in Reading view. See the Guide tab for the full language reference.",
		});

		new Setting(containerEl)
			.setName("Inline prefix")
			.setDesc('Prefix inside inline code, e.g. "q=" for `q= title`.')
			.addText((text) =>
				text.setValue(this.plugin.settings.inlinePrefix).onChange(async (value) => {
					this.plugin.settings.inlinePrefix = value.trim() || DEFAULT_SETTINGS.inlinePrefix;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Enable in Reading view")
			.setDesc("Evaluate Grimoire expressions when notes render in Reading view.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.enableInReadingView).onChange(async (value) => {
					this.plugin.settings.enableInReadingView = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Syntax highlight inline queries")
			.setDesc(
				"Colorize `q=` expressions in the editor (Source and Live Preview) and in Reading view when evaluation is off.",
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.enableSyntaxHighlight).onChange(async (value) => {
					this.plugin.settings.enableSyntaxHighlight = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Refresh on metadata change")
			.setDesc(
				"Re-render Reading views when frontmatter or embedded note metadata changes, so query results update live. May reset scroll position in split-pane workflows — leave off if that is disruptive.",
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.refreshOnMetadataChange).onChange(async (value) => {
					this.plugin.settings.refreshOnMetadataChange = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Button link open")
			.setDesc("Default pane when clicking AS button links. Ctrl/Cmd and middle-click still override.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("default", "Same as Obsidian links")
					.addOption("current", "Current pane")
					.addOption("tab", "New tab")
					.addOption("split", "Split pane")
					.addOption("window", "New window")
					.setValue(this.plugin.settings.linkOpenBehavior)
					.onChange(async (value) => {
						this.plugin.settings.linkOpenBehavior = value as typeof this.plugin.settings.linkOpenBehavior;
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("h3", { text: "AS badge / pill tones" });
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Comma-separated whole-word matches (case-insensitive). Checked in order: danger → warn → success → muted. Example: dead matches Dead but not Undead.",
		});

		new Setting(containerEl)
			.setName("Success triggers")
			.setDesc("Values containing any of these map to the success (green) badge tone.")
			.addTextArea((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.badgeSuccessTriggers)
					.setValue(this.plugin.settings.badgeSuccessTriggers)
					.onChange(async (value) => {
						this.plugin.settings.badgeSuccessTriggers =
							value.trim() || DEFAULT_SETTINGS.badgeSuccessTriggers;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Warn triggers")
			.setDesc("Values containing any of these map to the warn (amber) badge tone.")
			.addTextArea((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.badgeWarnTriggers)
					.setValue(this.plugin.settings.badgeWarnTriggers)
					.onChange(async (value) => {
						this.plugin.settings.badgeWarnTriggers =
							value.trim() || DEFAULT_SETTINGS.badgeWarnTriggers;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Danger triggers")
			.setDesc("Values containing any of these map to the danger (red) badge tone.")
			.addTextArea((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.badgeDangerTriggers)
					.setValue(this.plugin.settings.badgeDangerTriggers)
					.onChange(async (value) => {
						this.plugin.settings.badgeDangerTriggers =
							value.trim() || DEFAULT_SETTINGS.badgeDangerTriggers;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl("h3", { text: "AS meter / stars" });

		new Setting(containerEl)
			.setName("Filled character")
			.setDesc("Glyph used for filled meter slots (first character if more than one is entered).")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.meterFilledChar)
					.setValue(this.plugin.settings.meterFilledChar)
					.onChange(async (value) => {
						this.plugin.settings.meterFilledChar =
							value.trim() || DEFAULT_SETTINGS.meterFilledChar;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Empty character")
			.setDesc("Glyph used for empty meter slots (first character if more than one is entered).")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.meterEmptyChar)
					.setValue(this.plugin.settings.meterEmptyChar)
					.onChange(async (value) => {
						this.plugin.settings.meterEmptyChar =
							value.trim() || DEFAULT_SETTINGS.meterEmptyChar;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Debug mode")
			.setDesc("Show full parse/evaluation errors inline instead of a generic message.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				}),
			);
	}
}
