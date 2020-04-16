import * as entity from "../booyah/src/entity.js";
import * as bgMatrix from "./bgMatrix.js";

export class HeroScene extends entity.ParallelEntity {
  constructor(heroIds) {
    super();

    this.heroIds = heroIds;
  }

  _setup() {
    this.config.jukebox.changeMusic("principal");

    this.matrix = new bgMatrix.BgMatrix();
    this.addEntity(this.matrix);

    this.container = new PIXI.Container();
    this.config.container.addChild(this.container);

    const dialIntro = new PIXI.Sprite(
      this.config.app.loader.resources["images/dialIntro.png"].texture
    );
    dialIntro.position.set(168, 73);
    this.container.addChild(dialIntro);

    this.dialogText = new PIXI.Text("", {
      fontFamily: "Teko",
      fontSize: 28,
      fill: 0xffffff,
      align: "left",
      wordWrap: true,
      wordWrapWidth: 550,
      lineHeight: 28
    });
    this.dialogText.anchor.set(0, 0.5);
    this.dialogText.position.set(208, 248);
    this.container.addChild(this.dialogText);

    const btnAcc = new PIXI.Sprite(
      this.config.app.loader.resources["images/btnIntro.png"].texture
    );
    btnAcc.position.set(573, 424);
    btnAcc.interactive = true;
    this.container.addChild(btnAcc);

    this._on(btnAcc, "pointertap", this._advance);

    this.buttonText = new PIXI.Text("", {
      fontFamily: "Teko",
      fontSize: 34,
      fill: 0xffffff,
      letterSpacing: 6
    });
    this.buttonText.anchor.set(0.5, 0.5);
    this.buttonText.position.set(685, 457);
    this.container.addChild(this.buttonText);

    this.idIndex = -1;
    this._advance();
  }

  _advance() {
    this.config.fxMachine.play("click");

    this.idIndex++;

    if (this.idIndex < this.heroIds.length) {
      const id = this.heroIds[this.idIndex];
      const info = this.config.jsonAssets.heros[id];
      this.dialogText.text = this._breakIntoLines(info.text);
      this.buttonText.text = info.button.toUpperCase();
    } else {
      this.requestedTransition = true;
    }
  }

  _breakIntoLines(text) {
    return text.split(/--/g).join("\n");
  }

  _teardown() {
    this.removeAllEntities();

    this.config.container.removeChild(this.container);
  }
}
