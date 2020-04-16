import * as util from "../booyah/src/util.js";
import * as entity from "../booyah/src/entity.js";

export class PointsScreen extends entity.ParallelEntity {
  constructor(options = {}) {
    super();

    util.setupOptions(this, options, {
      part: 1,
      objectivesSucceeded: 2,
      objectivesTotal: 3,
      hintsUsed: 3,
      hintsTotal: 7
    });
  }

  _setup() {
    const interfaceTexts = this.config.jsonAssets.interface;

    this.config.jukebox.changeMusic();

    this.container = new PIXI.Container();
    this.config.container.addChild(this.container);

    const bg = new PIXI.Sprite(
      this.config.app.loader.resources["images/bgTilling.jpg"].texture
    );
    this.container.addChild(bg);

    {
      const titleMessage = interfaceTexts["points-part-done"].text.replace(
        ":part",
        this.part
      );
      const titleText = new PIXI.Text(titleMessage, {
        fontFamily: "Teko Light",
        fontSize: 52,
        fill: 0x5ac7d5
      });
      titleText.anchor.set(0.5);
      titleText.position.set(
        this.config.app.renderer.width / 2,
        this.config.app.renderer.height / 4
      );
      this.container.addChild(titleText);
    }

    const totalPoints = this.objectivesTotal * 5;
    const points = this.objectivesSucceeded * 5 - this.hintsUsed;

    const detailedMessages = [
      this._makeDetailedMessage(
        interfaceTexts["points-objectives"].text
          .replace(":succeeded", this.objectivesSucceeded)
          .replace(":total", this.objectivesTotal),
        new PIXI.Point(this.config.app.renderer.width / 2, 250)
      ),
      this._makeDetailedMessage(
        interfaceTexts["points-hints"].text
          .replace(":used", this.hintsUsed)
          .replace(":total", this.hintsTotal),
        new PIXI.Point(this.config.app.renderer.width / 2, 300)
      ),
      this._makeDetailedMessage(
        interfaceTexts["points-points"].text
          .replace(":points", points)
          .replace(":total", totalPoints),
        new PIXI.Point(this.config.app.renderer.width / 2, 400),
        { fontSize: 52, fill: 0x5ac7d5 }
      )
    ];

    const sequenceEntities = [];
    for (const message of detailedMessages) {
      sequenceEntities.push(
        new entity.FunctionCallEntity(() => {
          this.config.fxMachine.play("points-1");
        })
      );
      sequenceEntities.push(new entity.WaitingEntity(700));
      sequenceEntities.push(
        new entity.FunctionCallEntity(() => {
          message.visible = true;
        })
      );
    }
    sequenceEntities.push(
      new entity.FunctionCallEntity(() => {
        this.config.fxMachine.play("points-2");
      })
    );
    this.addEntity(new entity.EntitySequence(sequenceEntities));

    this.skipButton = new entity.SkipButton();
    this.addEntity(
      this.skipButton,
      entity.extendConfig({ container: this.container })
    );
  }

  _update() {
    if (this.skipButton.requestedTransition) this.requestedTransition = true;
  }

  _teardown() {
    this.config.container.removeChild(this.container);
  }

  _makeDetailedMessage(message, position, style = {}) {
    const text = new PIXI.Text(
      message,
      _.extend(
        {
          fontFamily: "Teko Light",
          fontSize: 40,
          fill: 0xffffff
        },
        style
      )
    );
    text.position = position;
    text.anchor.set(0.5);
    text.visible = false;
    this.container.addChild(text);
    return text;
  }
}
