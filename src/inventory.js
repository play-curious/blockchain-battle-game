import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as geom from "../booyah/src/geom.js";
import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";
import * as audio from "../booyah/src/audio.js";
import * as scroll from "../booyah/src/scroll.js";

import * as clipBoard from "./clipBoard.js";

/**
 * events:
 
 *  unreadInfo
 *  readAllInfo
 *  openedZoom(inventoryId, container)
 *  closedZoom(inventoryId, container)
 */
export class Inventory extends entity.ParallelEntity {
  constructor(options) {
    super();

    util.setupOptions(this, options, {
      memento: null,

      unlockedItems: []
    });
  }

  _setup() {
    const interfaceTexts = this.config.jsonAssets.interface;

    this.container = new PIXI.Container();
    this.container.visible = false;
    this.config.container.addChild(this.container);

    const screen = new PIXI.Sprite(
      this.config.app.loader.resources["images/screenScroll.png"].texture
    );
    this.container.addChild(screen);

    const lineText = new PIXI.Sprite(
      this.config.app.loader.resources["images/lineText.png"].texture
    );
    lineText.position.set(130, 65);
    this.container.addChild(lineText);

    const ico = new PIXI.Sprite(
      this.config.app.loader.resources["images/icoInventory.png"].texture
    );
    ico.scale.set(0.75);
    ico.position.set(130, 10);
    this.container.addChild(ico);

    const textIco = new PIXI.Text(
      interfaceTexts["inventory"].text.toUpperCase(),
      {
        fontFamily: "Teko Light",
        fontSize: 50,
        fill: 0xffffff,
        letterSpacing: 0.4
      }
    );
    textIco.position.set(220, 55);
    this.container.addChild(textIco);

    this.bg = new PIXI.Sprite(
      this.config.app.loader.resources["images/bgInventory.png"].texture
    );
    this.container.addChild(this.bg);

    this.scrollbox = new scroll.Scrollbox({
      boxWidth: 675,
      boxHeight: 240,
      overflowX: "none",
      overflowY: "scroll",
      scrollbarOffsetVertical: 160,
      scrollbarSize: 30, // width in pixels
      scrollbarBackground: 0, // background color
      scrollbarBackgroundAlpha: 0.25,
      scrollbarForeground: 0x68f1ff, // foreground color
      scrollbarForegroundAlpha: 1
    });
    this.addEntity(
      this.scrollbox,
      _.extend({}, this.config, { container: this.container })
    );
    this.scrollbox.container.position.set(115, 180);

    if (this.memento) {
      this.inventoryItems = this.memento;

      for (const id of this.unlockedItems)
        _.find(this.inventoryItems, { id }).unlocked = true;
    } else {
      const inventoryJson = this.config.jsonAssets.inventory;
      this.inventoryItems = _.map(
        inventoryJson,
        item =>
          new InventoryData(
            item["id"],
            item["title"],
            item["type"],
            item["filename"],
            item["preview"],
            item["music"],
            item["narration"],
            _.contains(this.unlockedItems, item.id)
          )
      );
    }

    this._refresh();

    // To hold videos while they play, and then auto-remove them
    this.videoContainer = new entity.DeflatingCompositeEntity({
      autoTransition: false
    });
    this.addEntity(
      this.videoContainer,
      entity.extendConfig({ container: this.config.overlayContainer })
    );
  }

  _refresh() {
    this.scrollbox.content.removeChildren();
    let x = 0;
    let backLine = 0;
    for (let i = 0; i < this.inventoryItems.length; i++) {
      if (this.inventoryItems[i].unlocked) {
        let picture;
        if (this.inventoryItems[i].type === "video") {
          picture = new PIXI.Sprite(
            this.config.app.loader.resources[
              this.inventoryItems[i].preview
            ].texture
          );
          picture.interactive = true;
          this._on(picture, "pointerup", () => {
            this._onPlayVideo(this.inventoryItems[i]);
          });
        } else if (this.inventoryItems[i].type === "picture") {
          picture = new PIXI.Sprite(
            this.config.app.loader.resources[
              this.inventoryItems[i].fileName
            ].texture
          );
          picture.interactive = true;
          this._on(picture, "pointerup", () => {
            this.config.fxMachine.play("click");
            this._zoom(this.inventoryItems[i].id);
          });
        } else if (this.inventoryItems[i].type === "animation") {
          picture = new PIXI.Sprite(
            this.config.app.loader.resources[
              this.inventoryItems[i].preview
            ].texture
          );
          picture.interactive = true;
          this._on(picture, "pointerup", () => {
            this.config.fxMachine.play("click");
            this._zoom(this.inventoryItems[i].id);
          });
        } else {
          throw new Error("No such inventory item type");
        }

        // Preview pictures are 220x123 px
        picture.anchor.set(0.5);
        picture.position.set(x * 250 + 240 / 2, +backLine * 135 + 123 / 2);

        // Reduce preview image to 123 px high
        picture.scale.set(123 / picture.height);

        picture.obj = this.inventoryItems[i];

        x++;
        if (x === 3) {
          x = 0;
          backLine++;
        }
        this.scrollbox.content.addChild(picture);
      }
    }

    this.scrollbox.refresh();
  }

  _teardown() {
    this.config.container.removeChild(this.container);
  }

  setVisible(isVisible) {
    this.container.visible = isVisible;

    if (isVisible) this.emit("readAllInfo");
  }

  unlockItem(id) {
    _.find(this.inventoryItems, { id }).unlocked = true;

    this._refresh();

    // this.config.notifier.notify("inventory-new-item");
    if (!this.container.visible) this.emit("unreadInfo");
  }

  _zoom(id) {
    const item = this.config.jsonAssets.inventory[id];

    const zoomContainer = new PIXI.Container();
    zoomContainer.position.set(
      this.config.app.screen.width / 2,
      this.config.app.screen.height / 2
    );
    this.container.addChild(zoomContainer);

    // Block clicks to outside the zoom
    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000);
    bg.drawRect(0, 0, 960, 540);
    bg.endFill();
    bg.alpha = 0.5;
    bg.position.set(
      -this.config.app.screen.width / 2,
      -this.config.app.screen.height / 2
    );
    bg.interactive = true;
    this._on(bg, "pointerup", () => this._onCloseZoom(id, zoomContainer));
    zoomContainer.addChild(bg);

    // Create the picture now to get its dimensions, but add it _after_ the contour
    // Block clicking events
    let bigPic;
    if (item.type === "picture") {
      bigPic = new PIXI.Sprite(
        this.config.app.loader.resources[item.filename].texture
      );
    } else {
      bigPic = util.makeAnimatedSprite(
        this.config.app.loader.resources[item.filename]
      );
      bigPic.animationSpeed = 0.2;
      bigPic.play();
    }
    bigPic.anchor.set(0.5);
    bigPic.interactive = true;

    const contour = new PIXI.Graphics();
    contour.beginFill(0xdafbff);
    contour.drawRect(
      -bigPic.width / 2 - 5,
      -bigPic.height / 2 - 5,
      bigPic.width + 10,
      bigPic.height + 10
    );
    contour.endFill();
    zoomContainer.addChild(contour);

    zoomContainer.addChild(bigPic);

    const close = new PIXI.Sprite(
      this.config.app.loader.resources["images/close.png"].texture
    );
    close.anchor.set(0.5);
    close.position.set(bigPic.width / 2, -bigPic.height / 2);
    close.interactive = true;
    zoomContainer.addChild(close);

    this._on(close, "pointerup", () => this._onCloseZoom(id, zoomContainer));

    this.emit("openedZoom", id, zoomContainer);
  }

  _onPlayVideo(inventoryItem) {
    this.config.fxMachine.play("click");

    const videoEntity = new narration.VideoScene({
      video: inventoryItem.fileName,
      music: inventoryItem.music,
      narration: inventoryItem.narration
    });

    this.videoContainer.addEntity(videoEntity);
  }

  _onCloseZoom(id, zoomContainer) {
    this.config.fxMachine.play("click");
    this.container.removeChild(zoomContainer);
    this.emit("closedZoom", id, zoomContainer);
  }

  makeMemento() {
    return this.inventoryItems;
  }
}

class InventoryData {
  constructor(
    id,
    title,
    type,
    fileName,
    preview = null,
    music = null,
    narration = null,
    unlocked = false
  ) {
    this.id = id;
    this.title = title;
    this.type = type;
    this.fileName = fileName;
    this.preview = preview;
    this.music = music;
    this.narration = narration;
    this.unlocked = unlocked;
  }
}
