import { Compartment } from "@codemirror/state";
import { Plugin, TFile } from "obsidian";
import { pqEditorHighlightExtension } from "./editorHighlight";
import { setGrimoireApp } from "./epochsBridge";
import { processPropertyQueriesInElement } from "./render";
import { rerenderAllMarkdownViews, rerenderViewsForFile } from "./refresh";
import { PropertyQuerySettingTab } from "./settings";
import { DEFAULT_SETTINGS, type PropertyQuerySettings } from "./types";

export default class GrimoirePlugin extends Plugin {
	settings: PropertyQuerySettings = { ...DEFAULT_SETTINGS };
	private readonly highlightCompartment = new Compartment();

	async onload(): Promise<void> {
		await this.loadSettings();
		setGrimoireApp(this.app);
		this.addSettingTab(new PropertyQuerySettingTab(this.app, this));

		// Run before Dataview (-100) so our queries and Dataview false-positive shields apply first.
		this.registerMarkdownPostProcessor((element, ctx) => {
			processPropertyQueriesInElement(this.app, element, ctx, this.settings);
		}, -101);

		this.registerEditorExtension(
			this.highlightCompartment.of(pqEditorHighlightExtension(() => this.settings)),
		);

		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (!this.settings.refreshOnMetadataChange) return;
				if (file instanceof TFile) {
					rerenderViewsForFile(this.app, file);
				}
			}),
		);
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<PropertyQuerySettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
		for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof PropertyQuerySettings)[]) {
			const value = this.settings[key];
			if (value === undefined || value === null || value === "") {
				this.settings[key] = DEFAULT_SETTINGS[key] as never;
			}
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.highlightCompartment.reconfigure(pqEditorHighlightExtension(() => this.settings));
		rerenderAllMarkdownViews(this.app);
	}
}
