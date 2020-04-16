import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";

const TIME_PER_WORD = 60000 / 150; // 150 words per minute

/**
 * Events:
 *  done - key (string)
 */
export class SubtitleNarrator extends entity.ParallelEntity {
  _setup(config) {
    this.subtitleTexts = this.config.jsonAssets.subtitles;

    this.container = new PIXI.Container();
    this.config.container.addChild(this.container);

    this.narratorSubtitle = new PIXI.Text("", {
      fontFamily: "Teko",
      fontSize: 40,
      fill: "white",
      strokeThickness: 4,
      align: "center",
      wordWrap: true,
      wordWrapWidth: this.config.app.screen.width - 150
    });
    this.narratorSubtitle.anchor.set(0.5, 0.5);
    this.narratorSubtitle.position.set(
      this.config.app.screen.width / 2,
      this.config.app.screen.height - 75
    );
    this.container.addChild(this.narratorSubtitle);

    this.key = null;
    this.timeSincePlay = null;
    this.lines = null;
    this.nextLineAt = null;

    this._on(
      this.config.playOptions,
      "showSubtitles",
      this._updateShowSubtitles
    );

    this._updateShowSubtitles();
  }

  _update(options) {
    if (!this.key || options.gameState !== "playing") return;

    this.timeSincePlay += options.timeSinceLastFrame;
    this._updateSubtitle();
  }

  _teardown() {
    this.config.container.removeChild(this.container);
  }

  changeKey(key) {
    if (!_.has(this.subtitleTexts, key)) {
      console.error("No key", key, "in narration table");
      return;
    }

    this._stopNarration();
    this._initNarration(key);
  }

  stopNarration(key) {
    if (this.key === key) this._stopNarration();
  }

  _onSignal(signal) {
    if (signal === "reset") this._stopNarration();
  }

  _initNarration(key) {
    this.key = key;
    this.timeSincePlay = 0;
    this.lines = narration.breakDialogIntoLines(this.subtitleTexts[key].text);

    if (this.lines[0].start) {
      // Wait for first line
      this.lineIndex = -1;
    } else {
      // Start first line now
      this.lineIndex = 0;
      this.narratorSubtitle.text = this.lines[0].text;
    }
    this._updateNextLineAt();
  }

  _stopNarration() {
    if (!this.key) return;

    this.emit("done", this.key);

    this.key = null;
    this.timeSincePlay = null;
    this.lines = null;
    this.nextLineAt = null;

    this.narratorSubtitle.text = "";
  }

  // Must be called after his.lines, this.lineIndex, etc.. have been set
  _updateNextLineAt() {
    if (
      this.lineIndex < this.lines.length - 1 &&
      this.lines[this.lineIndex + 1].start
    ) {
      this.nextLineAt = this.lines[this.lineIndex + 1].start;
    } else {
      this.nextLineAt =
        this.timeSincePlay +
        narration.estimateDuration(
          this.lines[this.lineIndex].text,
          TIME_PER_WORD
        );
    }
  }

  _updateSubtitle() {
    if (this.nextLineAt >= this.timeSincePlay) return;

    this.lineIndex++;
    if (this.lineIndex < this.lines.length) {
      this._updateNextLineAt();
      this.narratorSubtitle.text = this.lines[this.lineIndex].text;
    } else {
      this._stopNarration();
    }
  }

  _updateShowSubtitles() {
    const showSubtitles = this.config.playOptions.options.showSubtitles;
    this.container.visible = showSubtitles;
  }
}

export function installSubtitleNarrator(rootConfig, rootEntity) {
  rootConfig.narrator = new SubtitleNarrator();
  rootEntity.addEntity(rootConfig.narrator);
}
