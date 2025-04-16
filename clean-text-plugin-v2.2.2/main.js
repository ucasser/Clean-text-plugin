const { Plugin, ItemView, WorkspaceLeaf, Setting, Notice } = require('obsidian');

const VIEW_TYPE = "clean-text-view";

const DEFAULT_SETTINGS = {
  removeExtraSpaces: true,
  removeNewlines: true,
  removeReferenceMarks: true,
  convertFullWidth: true
};

module.exports = class CleanTextPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    this.registerView(VIEW_TYPE, leaf => new CleanTextView(leaf, this));

    this.addRibbonIcon("wand", "打开清理界面", () => this.activateView());

    this.addCommand({
      id: "clean-clipboard",
      name: "清理剪贴板文本",
      callback: async () => {
        let text = await navigator.clipboard.readText().catch(() => "");
        let cleaned = this.applyCleaning(text);
        await navigator.clipboard.writeText(cleaned);
        new Notice("剪贴板内容已清理！");
      }
    });

    this.addCommand({
      id: "clean-selection",
      name: "清理选中文本",
      editorCallback: (editor) => {
        let selected = editor.getSelection();
        let cleaned = this.applyCleaning(selected);
        editor.replaceSelection(cleaned);
        new Notice("选中文本已清理！");
      }
    });

    this.addSettingTab(new CleanTextSettingTab(this.app, this));
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async activateView() {
    const leaf = this.app.workspace.getRightLeaf(false);
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  applyCleaning(text) {
    if (this.settings.removeReferenceMarks) {
      text = text.replace(/\[[\d,\-\s]+\]/g, "").replace(/\([\d,\-\s]+\)/g, "");
    }
    if (this.settings.removeExtraSpaces) {
      text = text.replace(/ +/g, "");
    }
    if (this.settings.removeNewlines) {
      text = text.replace(/[\r\n]+/g, "");
    }
    if (this.settings.convertFullWidth) {
      text = text.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    }
    return text.trim();
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
};

class CleanTextView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "文本清理器";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();

    // Wrapper
    const wrapper = container.createDiv({ cls: "clean-text-wrapper" });
    wrapper.setAttr("style", "display:flex;flex-direction:column;height:100%;gap:10px;padding:10px;box-sizing:border-box;");

    // Input
    const input = wrapper.createEl("textarea", {
      attr: { placeholder: "粘贴或输入待清理的文本..." }
    });
    input.setAttr("style", "flex:1;resize:none;width:100%;box-sizing:border-box;");

    // Button row
    const buttonRow = wrapper.createDiv({ cls: "clean-text-buttons" });
    buttonRow.setAttr("style", "text-align:right;");

    const copyBtn = buttonRow.createEl("button", { text: "📋 复制并清空" });
    copyBtn.setAttr("style", "padding:4px 12px;margin-bottom:5px;");
    
    // Output
    const output = wrapper.createEl("textarea", {
      attr: { placeholder: "这里会显示清理后的文本..." }
    });
    output.setAttr("readonly", "true");
    output.setAttr("style", "flex:1;resize:none;width:100%;box-sizing:border-box;background:#f7f7f7;");

    input.addEventListener("input", () => {
      const raw = input.value;
      const cleaned = this.plugin.applyCleaning(raw);
      output.value = cleaned;
    });

    copyBtn.addEventListener("click", async () => {
      if (output.value) {
        await navigator.clipboard.writeText(output.value);
        input.value = "";
        output.value = "";
        new Notice("已复制并清除文本");
      } else {
        new Notice("输出为空，未复制");
      }
    });
  }

  async onClose() {}
}

class CleanTextSettingTab extends require('obsidian').PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "清理规则设置" });

    new Setting(containerEl)
      .setName("删除引用角标")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.removeReferenceMarks)
        .onChange(async value => {
          this.plugin.settings.removeReferenceMarks = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("删除多余空格")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.removeExtraSpaces)
        .onChange(async value => {
          this.plugin.settings.removeExtraSpaces = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("删除换行符")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.removeNewlines)
        .onChange(async value => {
          this.plugin.settings.removeNewlines = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("全角转半角")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.convertFullWidth)
        .onChange(async value => {
          this.plugin.settings.convertFullWidth = value;
          await this.plugin.saveSettings();
        }));
  }
}
