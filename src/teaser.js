import * as entity from "../booyah/src/entity.js";

const textStyles = {
  default: {
    fontFamily: "Teko Light",
    fontSize: 38,
    fill: 0xffffff,
    align: "center",
    wordWrap: true,
    wordWrapWidth: 550,
    lineHeight: 28,
  },
  accent: {
    fill: 0x68f1ff,
  },
};

export class Teaser extends entity.ParallelEntity {
  constructor(id) {
    super();

    this.id = id;
  }

  _setup() {
    const info = this.config.jsonAssets.teasers[this.id];

    const message = this._breakIntoLines(info.text);
    this.text = new MultiStyleText(message, textStyles);
    this.text.anchor.set(0.5);
    this.text.position.set(
      this.config.app.renderer.width / 2,
      this.config.app.renderer.height / 2
    );
    this.config.container.addChild(this.text);

    if (info.link) {
      this.text.interactive = true;
      this.text.cursor = "pointer";
      this._on(
        this.text,
        "pointertap",
        () => (window.location.href = info.link)
      );
    }

    this.skipButton = new entity.SkipButton();
    this.addEntity(this.skipButton);
  }

  _update() {
    if (this.skipButton.requestedTransition) this.requestedTransition = true;
  }

  _teardown() {
    this.config.container.removeChild(this.text);

    this.removeAllEntities();
  }

  _breakIntoLines(text) {
    return text.split(/--/g).join("\n");
  }
}
