import * as entity from "../booyah/src/entity.js";
import * as tween from "../booyah/src/tween.js";

const tableSize = 15;

export class BgMatrix extends entity.ParallelEntity {
  _setup(config) {
    this.bgContainer = new PIXI.Container();
    this.config.container.addChild(this.bgContainer);

    this.glowFilter = new PIXI.filters.GlowFilter(10, 1, 0, 0x93e9f5, 1);
    this.glowFilterAccent = new PIXI.filters.GlowFilter(10, 1, 0, 0xfc5f3b, 1);

    this.sprites = [];

    this.randomizer = new entity.EntitySequence(
      [
        new entity.WaitingEntity(200),
        new entity.FunctionCallEntity(this._addText, this)
      ],
      { loop: true }
    );
    this.addEntity(this.randomizer);
  }

  _addText() {
    const row = Math.floor(Math.random() * tableSize);
    const col = Math.floor(Math.random() * tableSize);

    const number = Math.floor(Math.random() * 9999);
    const numberText = number.toString().padStart(4, "0");
    const shouldAccentNumber = number < 1000;

    const text = new PIXI.Text(numberText, {
      fontFamily: "Teko",
      fontSize: 30,
      fill: shouldAccentNumber ? 0xfc5f3b : 0x009eb3,
      align: "center",
      wordWrap: true,
      wordWrapWidth: "40",
      letterSpacing: 0.2
    });
    text.filters = [
      shouldAccentNumber ? this.glowFilterAccent : this.glowFilter
    ];

    const renderTexture = PIXI.RenderTexture.create(text.width, text.height);
    this.config.app.renderer.render(text, renderTexture);

    const sprite = PIXI.Sprite.from(renderTexture);
    sprite.anchor.set(0.5);
    sprite.position.set(20 + col * 65, 15 + row * 40);

    this.bgContainer.addChild(sprite);
    this.sprites.push(sprite);
  }

  _update(options) {
    for (let j = 0; j < this.sprites.length; j++) {
      const text = this.sprites[j];

      text.alpha -= 0.001 * options.timeScale;
      if (text.alpha <= 0) {
        this.sprites.splice(j, 1);
        this.bgContainer.removeChild(text);
      }
    }
  }

  _teardown() {
    this.config.container.removeChild(this.bgContainer);
    this.removeEntity(this.randomizer);
  }
}
