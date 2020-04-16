import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as geom from "../booyah/src/geom.js";
import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";
import * as audio from "../booyah/src/audio.js";

export class Notifier extends entity.Entity {
  _setup(config) {
    this.textTable = this.config.jsonAssets.notifications;
    this.unlock = "pause";
    this.compte = 0;

    this.container = new PIXI.Container();
    this.container.position.set(this.config.app.screen.width / 2, -50);
    this.config.container.addChild(this.container);

    const bg = new PIXI.Sprite(
      this.config.app.loader.resources["images/notification.png"].texture
    );
    bg.anchor.set(0.5);
    this.container.addChild(bg);

    this.errorOutlineFilter = new PIXI.filters.OutlineFilter(2, 0xfc5f3b);

    this.textMessage = new PIXI.Text("", {
      fontFamily: "Teko",
      fontSize: 40,
      fill: "white",
      align: "center"
    });

    this.textMessage.anchor.set(0.5);
    this.textMessage.position.set(0, -30);
    this.container.addChild(this.textMessage);

    this.unlock = "pause";
  }

  notify(id) {
    const textInfo = this.textTable[id];
    this.textMessage.text = textInfo.text;

    if (textInfo.type === "error") {
      this.config.fxMachine.play("error");

      this.textMessage.filters = [this.errorOutlineFilter];
    } else {
      this.config.fxMachine.play("notif");

      this.textMessage.filters = [];
    }

    this.container.y = -50;
    this.unlock = "down";
  }

  _update() {
    if (this.unlock === "down") {
      this.container.y = geom.moveTowards(
        { x: 0, y: this.container.y },
        { x: 0, y: 60 },
        4
      ).y;
    } else if (this.unlock === "up") {
      this.container.y = geom.moveTowards(
        { x: 0, y: this.container.y },
        { x: 0, y: -50 },
        6
      ).y;
      if (this.container.y === -50) {
        this.unlock = "pause";
        this.compte = 0;
      }
    }
    if (this.container.y === 60) {
      if (this.compte < 175) {
        this.unlock = "pause";
        this.compte++;
      } else {
        this.unlock = "up";
      }
    }
  }
}

export function installNotifier(rootConfig, rootEntity) {
  rootConfig.notifier = new Notifier();
  rootEntity.addEntity(rootConfig.notifier);
}

export class Notification extends entity.Entity {
  constructor(text) {
    super();

    this.text = text;
  }

  _setup() {
    this.config.notifier.notify(this.text);
    this.requestedTransition = true;
  }
}
