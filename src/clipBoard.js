import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as geom from "../booyah/src/geom.js";
import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";
import * as audio from "../booyah/src/audio.js";

/**
 * Events:
 *  copied(text)
 *  pasted(text)
 */
export class ClipBoard extends entity.Entity {
  _setup(config) {
    const interfaceTexts = this.config.jsonAssets.interface;

    this.unlock = "pause"; // Does the overflow panel going up or not

    this.copiedText = null; // Value stored for pasting
    this.onPaste = null; // function(string) used for pasting

    this.container = new PIXI.Container();
    this.container.visible = false;
    this.config.container.addChild(this.container);

    // Empty background to catch clicks outside of the area
    const bg = new PIXI.Sprite();
    bg.interactive = true;
    bg.hitArea = new PIXI.Polygon(0, 0, 960, 0, 960, 540, 0, 540);
    this._on(bg, "pointertap", this.disappear);
    this.container.addChild(bg);

    this.controlsContainer = new PIXI.Container();
    // Don't close when pressing on the container
    this.controlsContainer.interactive = true;
    this.container.addChild(this.controlsContainer);

    this.image = new PIXI.Sprite(
      this.config.app.loader.resources["images/copyPaste.png"].texture
    );
    this.image.anchor.set(0.5, 1);
    this.controlsContainer.addChild(this.image);

    this.copy = new PIXI.Container();
    this.copy.name = "copy";
    this.copy.position.set(-65, -70);
    this.copy.interactive = true;
    this._on(this.copy, "pointertap", this._onCopy);
    this.controlsContainer.addChild(this.copy);

    {
      const buttonBg = new PIXI.Sprite(
        this.config.app.loader.resources["images/copy-paste-button.png"].texture
      );
      buttonBg.anchor.set(0.5);
      this.copy.addChild(buttonBg);
      const text = new PIXI.Text(interfaceTexts["clipboard-copy"].text, {
        fontFamily: "Teko Light",
        fontSize: 30,
        fill: 0x2c808f
      });
      text.anchor.set(0.5);
      this.copy.addChild(text);
    }

    this.paste = new PIXI.Container();
    this.paste.name = "paste";
    this.paste.position.set(65, -70);
    this.paste.interactive = true;
    this._on(this.paste, "pointertap", this._onPaste);
    this.controlsContainer.addChild(this.paste);

    {
      const buttonBg = new PIXI.Sprite(
        this.config.app.loader.resources["images/copy-paste-button.png"].texture
      );
      buttonBg.anchor.set(0.5);
      this.paste.addChild(buttonBg);
      const text = new PIXI.Text(interfaceTexts["clipboard-paste"].text, {
        fontFamily: "Teko Light",
        fontSize: 30,
        fill: 0x2c808f
      });
      text.anchor.set(0.5);
      this.paste.addChild(text);
    }

    this.containerNotif = new PIXI.Container();
    this.containerNotif.position.set(
      this.config.app.screen.width / 2,
      this.config.app.screen.height + 50
    );
    this.container.addChild(this.containerNotif);

    const bgNotif = new PIXI.Sprite(
      this.config.app.loader.resources["images/notification.png"].texture
    );
    bgNotif.angle = 180; // Flipped upside down
    bgNotif.anchor.set(0.5);
    this.containerNotif.addChild(bgNotif);

    this.textMessage = new PIXI.Text("", {
      fontFamily: "Teko Light",
      fontSize: 38,
      fill: "white",
      align: "center"
    });

    this.textMessage.anchor.set(0.5);
    this.textMessage.position.set(0, 30);
    this.containerNotif.addChild(this.textMessage);
  }

  _teardown() {
    this.config.container.removeChild(this.container);
  }

  _update() {
    if (this.unlock === "up") {
      this.containerNotif.y = geom.moveTowards(
        { x: 0, y: this.containerNotif.y },
        { x: 0, y: this.config.app.screen.height - 60 },
        9
      ).y;
    }
  }

  /**
   *  Make the clipboard appear
   *  @options:
   *    @position: center position where it should appear
   *    @textToCopy: Text to copy. If falsy, copy button will be deactivated
   *    @onPaste: function(string) to handle paste. If falsy, paste will not be allowed
   *    @showText: if true, show @textToCopy in a dropdown
   */
  appear(options = {}) {
    const parsedOptions = {};
    util.setupOptions(parsedOptions, options, {
      position: util.REQUIRED_OPTION,
      textToCopy: null,
      onPaste: null,
      showText: false
    });

    // Ensure that we're copying a string and only a string
    if (parsedOptions.textToCopy && parsedOptions.textToCopy.toString()) {
      this.textToCopy = parsedOptions.textToCopy.toString();

      if (parsedOptions.showText) {
        this.containerNotif.y = this.config.app.screen.height + 50;
        this.unlock = "up";
        this.textMessage.text = util.shortenString(
          parsedOptions.textToCopy,
          60
        );
      }

      this.copy.interactive = true;
      util.setPropertyInTree(this.copy, "tint", 0xffffff);
    } else {
      this.copy.interactive = false;
      util.setPropertyInTree(this.copy, "tint", 0x888888);
    }

    this.container.visible = true;

    this.controlsContainer.position = parsedOptions.position;

    if (parsedOptions.onPaste && this.copiedText) {
      this.onPaste = parsedOptions.onPaste;
      this.paste.interactive = true;
      util.setPropertyInTree(this.paste, "tint", 0xffffff);
    } else {
      this.paste.interactive = false;
      util.setPropertyInTree(this.paste, "tint", 0x888888);
    }
  }

  disappear() {
    this.container.visible = false;
    this.containerNotif.position.y = this.config.app.screen.height + 50;
    this.unlock = "pause";
  }

  _onCopy() {
    console.log("copying", this.textToCopy);

    this.config.fxMachine.play("copy");
    this.copiedText = this.textToCopy;

    this.disappear();

    this.emit("copied", this.copiedText);
  }

  _onPaste() {
    console.log("pasting", this.copiedText);

    this.config.fxMachine.play("paste");
    this.onPaste(this.copiedText);

    this.disappear();

    this.emit("pasted", this.copiedText);
  }
}

export function installClipBoard(rootConfig, rootEntity) {
  rootConfig.clipBoard = new ClipBoard();
  rootEntity.addEntity(rootConfig.clipBoard);
}
