import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as geom from "../booyah/src/geom.js";
import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";
import * as audio from "../booyah/src/audio.js";
import * as rsa from "./rsa.js";

/**
 * Events:
 *  hashed(input, output)
 *  encrypted(text, key, result)
 *  decrypted(text, key, result)
 *  opened
 *  closed
 *  switchedScreen("encryption" or "decryption")
 */
export class Toolbox extends entity.ParallelEntity {
  constructor(options) {
    super();

    util.setupOptions(this, options, {
      allowEncryption: false
    });
  }

  _setup(config) {
    const interfaceTexts = this.config.jsonAssets.interface;

    const optTextBox = {
      fontFamily: "Teko",
      fontSize: 34,
      fill: 0xffffff,
      align: "center",
      letterSpacing: 0.3
    };
    const labelTextStyle = {
      fontFamily: "Teko Light",
      fontSize: 30,
      fill: 0xbdf7ff,
      align: "center",
      letterSpacing: 1.2
    };
    const smallLabelTextStyle = _.extend({}, labelTextStyle, { fontSize: 26 });

    this.stringBeforeHash = "";
    this.stringAfterHash = "";

    this.stringBeforeEncryption = "";
    this.keyForEncryption = "";
    this.stringAfterEncryption = "";

    this.stringBeforeDecryption = "";
    this.keyForDecryption = "";
    this.stringAfterDecryption = "";

    // Toggle: if true, show encryption. Else show decryption
    this.showEncryption = true;

    this.container = new PIXI.Container();
    this.container.visible = false;
    this.config.container.addChild(this.container);

    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000);
    mask.drawRect(
      0,
      0,
      this.config.app.screen.width,
      this.config.app.screen.height
    );
    mask.endFill();
    mask.alpha = 0.5;
    mask.interactive = true;
    this._on(mask, "pointertap", this._onClose);
    this.container.addChild(mask);

    this.image = new PIXI.Sprite(
      this.config.app.loader.resources["images/bgCalcul.png"].texture
    );
    this.image.position.set(61, 72);
    this.image.interactive = true;
    this.container.addChild(this.image);

    const close = new PIXI.Sprite();
    close.hitArea = new PIXI.Rectangle(840, 75, 50, 50);
    close.interactive = true;
    this._on(close, "pointertap", this._onClose);
    this.container.addChild(close);

    const resetButton = new PIXI.Sprite();
    resetButton.hitArea = new PIXI.Rectangle(405, 265, 75, 65);
    resetButton.interactive = true;
    this._on(resetButton, "pointertap", this._reset, this);
    this.container.addChild(resetButton);

    // Hash area
    {
      {
        const text = new PIXI.Text(
          interfaceTexts["toolbox-hashing"].text,
          labelTextStyle
        );
        text.position.set(246, 146);
        text.anchor.set(0.5);
        this.container.addChild(text);
      }

      this.txtHashStart = new PIXI.Text("", optTextBox);
      this.txtHashStart.position.set(245, 245);
      this.txtHashStart.anchor.set(0.5);
      this.container.addChild(this.txtHashStart);

      this.txtHashEnd = new PIXI.Text("", optTextBox);
      this.txtHashEnd.position.set(245, 390);
      this.txtHashEnd.anchor.set(0.5);
      this.container.addChild(this.txtHashEnd);

      const hashStart = new PIXI.Sprite();
      hashStart.hitArea = new PIXI.Rectangle(100, 205, 290, 80);
      hashStart.interactive = true;
      this.container.addChild(hashStart);
      this._on(hashStart, "pointertap", () => {
        this.config.clipBoard.appear({
          position: this.txtHashStart.position,
          textToCopy: this.stringBeforeHash,
          showText: this.stringBeforeHash.length > 24,
          onPaste: pasted => {
            // Paste
            this.stringBeforeHash = pasted;
            this.txtHashStart.text = util.shortenString(pasted, 24);

            // Calculate (the hash can't be more than 4 chars)
            this.stringAfterHash = rsa.calculateHash(pasted);
            this.txtHashEnd.text = this.stringAfterHash;

            this.emit("hashed", this.stringBeforeHash, this.stringAfterHash);
          }
        });
      });

      const hashEnd = new PIXI.Sprite();
      hashEnd.hitArea = new PIXI.Rectangle(100, 350, 290, 80);
      hashEnd.interactive = true;
      this.container.addChild(hashEnd);
      this._on(hashEnd, "pointertap", () => {
        this.config.clipBoard.appear({
          position: this.txtHashEnd.position,
          textToCopy: this.stringAfterHash
        });
      });

      // Setup an animated arrow for the hashing
      const staticArrow = new PIXI.Sprite(
        this.config.app.loader.resources["images/triple-arrow.png"].texture
      );
      staticArrow.anchor.set(0.5);
      staticArrow.angle = 90;
      staticArrow.position.set(243, 319);
      this.container.addChild(staticArrow);

      const animatedArrow = util.makeAnimatedSprite(
        this.config.app.loader.resources["images/animated-arrow.json"]
      );
      animatedArrow.anchor.set(0.5);
      animatedArrow.angle = 180;
      animatedArrow.position.set(243, 319);
      animatedArrow.loop = false;
      animatedArrow.animationSpeed = 0.2;

      const hashArrowSequence = new entity.EntitySequence(
        [
          new entity.WaitForEvent(this, "hashed"),
          new entity.AnimatedSpriteEntity(animatedArrow)
        ],
        { loop: true }
      );
      this.addEntity(
        hashArrowSequence,
        entity.extendConfig({ container: this.container })
      );
    }

    {
      const text = new PIXI.Text(
        interfaceTexts["toolbox-encryption"].text,
        labelTextStyle
      );
      text.position.set(666, 146);
      text.anchor.set(0.5);
      this.container.addChild(text);
    }

    // Decryption area
    {
      // TODO: redo these images

      // Decrypt is under encrypt
      this.decryptionContainer = new PIXI.Container();
      this.decryptionContainer.interactiveChildren = this.allowEncryption;
      this.container.addChild(this.decryptionContainer);

      this.imageDecrypt = new PIXI.Sprite(
        this.config.app.loader.resources["images/calcuDecrypt.png"].texture
      );
      this.decryptionContainer.addChild(this.imageDecrypt);

      {
        const text = new PIXI.Text(
          interfaceTexts["toolbox-decrypt"].text,
          smallLabelTextStyle
        );
        text.position.set(749, 198);
        text.anchor.set(0.5);
        this.decryptionContainer.addChild(text);
      }

      const tabButton = new PIXI.Sprite();
      tabButton.hitArea = new PIXI.Rectangle(666, 170, 170, 50);
      tabButton.interactive = true;
      this._on(tabButton, "pointertap", () => {
        if (!this.showEncryption) return;

        this.config.fxMachine.play("click");
        this.showEncryption = false;
        this._refresh();

        this.emit("switchedScreen", "decryption");
      });
      this.decryptionContainer.addChild(tabButton);

      const ui = new PIXI.Sprite(
        this.config.app.loader.resources["images/calcuUp.png"].texture
      );
      ui.tint = this.allowEncryption ? 0xffffff : 0xaaaaaa;
      this.decryptionContainer.addChild(ui);

      const dataImage = new PIXI.Sprite(
        this.config.app.loader.resources["images/data.png"].texture
      );
      dataImage.tint = this.allowEncryption ? 0xffffff : 0xaaaaaa;
      dataImage.anchor.set(0.5);
      dataImage.position.set(580, 275, 275);
      this.decryptionContainer.addChild(dataImage);

      this.txtDecryptStart = new PIXI.Text("", optTextBox);
      this.txtDecryptStart.position.set(580, 275);
      this.txtDecryptStart.anchor.set(0.5);
      this.txtDecryptStart.hitArea = new PIXI.Rectangle(-75, -37.5, 150, 75);
      this.txtDecryptStart.interactive = true;
      this._on(this.txtDecryptStart, "pointertap", () => {
        this.config.clipBoard.appear({
          position: this.txtDecryptStart.position,
          textToCopy: this.stringBeforeDecryption,
          showText: this.stringBeforeDecryption.length > 10,
          onPaste: pasted => {
            this.stringBeforeDecryption = pasted;
            this.txtDecryptStart.text = util.shortenString(pasted, 10);
            this._decrypt();
          }
        });
      });
      this.decryptionContainer.addChild(this.txtDecryptStart);

      const keyImage = new PIXI.Sprite(
        this.config.app.loader.resources["images/key.png"].texture
      );
      keyImage.tint = this.allowEncryption ? 0xffffff : 0xaaaaaa;
      keyImage.anchor.set(0.5);
      keyImage.position.set(750, 275);
      this.decryptionContainer.addChild(keyImage);

      this.txtDecryptKey = new PIXI.Text("", optTextBox);
      this.txtDecryptKey.position.set(750, 275);
      this.txtDecryptKey.anchor.set(0.5);
      this.txtDecryptKey.hitArea = new PIXI.Rectangle(-75, -37.5, 150, 75);
      this.txtDecryptKey.interactive = true;
      this._on(this.txtDecryptKey, "pointertap", () => {
        this.config.clipBoard.appear({
          position: this.txtDecryptKey.position,
          textToCopy: this.keyForDecryption,
          onPaste: pasted => {
            if (!pasted.match(/^[0-9]{6}$/)) {
              this.config.notifier.notify("crypt-error-key-length");
              return;
            }

            this.keyForDecryption = pasted;
            this.txtDecryptKey.text = pasted;
            this._decrypt();
          }
        });
      });
      this.decryptionContainer.addChild(this.txtDecryptKey);

      this.txtDecryptEnd = new PIXI.Text("", optTextBox);
      this.txtDecryptEnd.position.set(675, 415);
      this.txtDecryptEnd.anchor.set(0.5);
      this.txtDecryptEnd.hitArea = new PIXI.Rectangle(-145, -37.5, 290, 75);
      this.txtDecryptEnd.interactive = true;
      this._on(this.txtDecryptEnd, "pointertap", () => {
        this.config.clipBoard.appear({
          position: this.txtDecryptEnd.position,
          textToCopy: this.stringAfterDecryption,
          showText: this.stringAfterDecryption.length > 24
        });
      });
      this.decryptionContainer.addChild(this.txtDecryptEnd);

      this._makeDoubleArrowAnimation(
        this.decryptionContainer,
        new PIXI.Point(664, 347),
        "decrypted"
      );
    }

    // Encryption area
    {
      this.encryptionContainer = new PIXI.Container();
      this.encryptionContainer.interactiveChildren = this.allowEncryption;
      this.container.addChild(this.encryptionContainer);

      this.imageCrypt = new PIXI.Sprite(
        this.config.app.loader.resources["images/calcuCrypt.png"].texture
      );
      this.encryptionContainer.addChild(this.imageCrypt);

      {
        const text = new PIXI.Text(
          interfaceTexts["toolbox-encrypt"].text,
          smallLabelTextStyle
        );
        text.position.set(578, 198);
        text.anchor.set(0.5);
        this.encryptionContainer.addChild(text);
      }

      const tabButton = new PIXI.Sprite();
      tabButton.hitArea = new PIXI.Rectangle(495, 170, 170, 50);
      tabButton.interactive = true;
      this._on(tabButton, "pointertap", () => {
        if (this.showEncryption) return;

        this.config.fxMachine.play("click");
        this.showEncryption = true;
        this._refresh();

        this.emit("switchedScreen", "encryption");
      });
      this.encryptionContainer.addChild(tabButton);

      const ui = new PIXI.Sprite(
        this.config.app.loader.resources["images/calcuUp.png"].texture
      );
      ui.tint = this.allowEncryption ? 0xffffff : 0xaaaaaa;
      this.encryptionContainer.addChild(ui);

      const dataImage = new PIXI.Sprite(
        this.config.app.loader.resources["images/data.png"].texture
      );
      dataImage.tint = this.allowEncryption ? 0xffffff : 0xaaaaaa;
      dataImage.anchor.set(0.5);
      dataImage.position.set(580, 275, 275);
      this.encryptionContainer.addChild(dataImage);

      this.txtCryptStart = new PIXI.Text("", optTextBox);
      this.txtCryptStart.position.set(580, 275);
      this.txtCryptStart.anchor.set(0.5);
      this.txtCryptStart.hitArea = new PIXI.Rectangle(-75, -37.5, 150, 75);
      this.txtCryptStart.interactive = true;
      this._on(this.txtCryptStart, "pointertap", () => {
        this.config.clipBoard.appear({
          position: this.txtCryptStart.position,
          textToCopy: this.stringBeforeEncryption,
          showText: this.stringBeforeEncryption.length > 10,
          onPaste: pasted => {
            this.stringBeforeEncryption = pasted;
            this.txtCryptStart.text = util.shortenString(pasted, 10);
            this._encrypt();
          }
        });
      });
      this.encryptionContainer.addChild(this.txtCryptStart);

      const keyImage = new PIXI.Sprite(
        this.config.app.loader.resources["images/key.png"].texture
      );
      keyImage.tint = this.allowEncryption ? 0xffffff : 0xaaaaaa;
      keyImage.anchor.set(0.5);
      keyImage.position.set(750, 275);
      this.encryptionContainer.addChild(keyImage);

      this.txtCryptKey = new PIXI.Text("", optTextBox);
      this.txtCryptKey.position.set(750, 275);
      this.txtCryptKey.anchor.set(0.5);
      this.txtCryptKey.hitArea = new PIXI.Rectangle(-75, -37.5, 150, 75);
      this.txtCryptKey.interactive = true;
      this._on(this.txtCryptKey, "pointertap", () => {
        this.config.clipBoard.appear({
          position: this.txtCryptKey.position,
          textToCopy: this.keyForEncryption,
          onPaste: pasted => {
            if (!pasted.match(/^[0-9]{6}$/)) {
              this.config.notifier.notify("crypt-error-key-length");
              return;
            }

            this.keyForEncryption = pasted;
            this.txtCryptKey.text = pasted;
            this._encrypt();
          }
        });
      });
      this.encryptionContainer.addChild(this.txtCryptKey);

      this.txtCryptEnd = new PIXI.Text("", optTextBox);
      this.txtCryptEnd.position.set(675, 415);
      this.txtCryptEnd.anchor.set(0.5);
      this.txtCryptEnd.hitArea = new PIXI.Rectangle(-145, -37.5, 290, 75);
      this.txtCryptEnd.interactive = true;
      this._on(this.txtCryptEnd, "pointertap", () => {
        this.txtCryptEnd.anchor.set(0.5);
        this.config.clipBoard.appear({
          position: this.txtCryptEnd.position,
          textToCopy: this.stringAfterEncryption,
          showText: this.stringAfterEncryption.length > 24
        });
      });
      this.encryptionContainer.addChild(this.txtCryptEnd);

      this._makeDoubleArrowAnimation(
        this.encryptionContainer,
        new PIXI.Point(664, 347),
        "encrypted"
      );
    }

    this._refresh();
  }

  _teardown() {
    this.config.container.removeChild(this.container);
    this.removeAllEntities();
  }

  appear() {
    this.container.visible = true;

    this.emit("opened");
  }

  disappear() {
    this.container.visible = false;

    this.emit("closed");
  }

  _onClose() {
    this.disappear();
    this.config.fxMachine.play("click");
  }

  _refresh() {
    const decryptIndex = this.container.getChildIndex(this.decryptionContainer);
    const encryptIndex = this.container.getChildIndex(this.encryptionContainer);
    if (this.showEncryption && decryptIndex > encryptIndex) {
      this.container.swapChildren(
        this.decryptionContainer,
        this.encryptionContainer
      );
    } else if (!this.showEncryption && decryptIndex < encryptIndex) {
      this.container.swapChildren(
        this.decryptionContainer,
        this.encryptionContainer
      );
    }

    if (this.allowEncryption) {
      util.setPropertyInTree(
        this.decryptionContainer,
        "tint",
        this.showEncryption ? 0xaaaaaa : 0xffffff
      );
      util.setPropertyInTree(
        this.encryptionContainer,
        "tint",
        this.showEncryption ? 0xffffff : 0xaaaaaa
      );
    } else {
      util.setPropertyInTree(this.decryptionContainer, "tint", 0xaaaaaa);
      util.setPropertyInTree(this.encryptionContainer, "tint", 0xaaaaaa);
    }
  }

  _encrypt() {
    if (!this.stringBeforeEncryption || !this.keyForEncryption) {
      this.txtCryptEnd.text = "";
    } else {
      const { key, n } = rsa.deconcat(this.keyForEncryption);
      this.stringAfterEncryption = rsa.crypt(
        this.stringBeforeEncryption,
        key,
        n
      );
      this.txtCryptEnd.text = util.shortenString(
        this.stringAfterEncryption,
        24
      );

      this.emit(
        "encrypted",
        this.stringBeforeEncryption,
        this.keyForEncryption,
        this.stringAfterEncryption
      );
    }
  }

  _decrypt() {
    if (!this.stringBeforeDecryption || !this.keyForDecryption) {
      this.txtDecryptEnd.text = "";
    } else {
      const { key, n } = rsa.deconcat(this.keyForDecryption);
      this.stringAfterDecryption = rsa.decrypt(
        this.stringBeforeDecryption,
        key,
        n
      );
      this.txtDecryptEnd.text = util.shortenString(
        this.stringAfterDecryption,
        24
      );

      this.emit(
        "decrypted",
        this.stringBeforeDecryption,
        this.keyForDecryption,
        this.stringAfterDecryption
      );
    }
  }

  _reset() {
    this.stringBeforeHash = "";
    this.txtHashStart.text = "";

    this.stringAfterHash = "";
    this.txtHashEnd.text = "";

    this.stringBeforeDecryption = "";
    this.txtDecryptStart.text = "";

    this.keyForDecryption = "";
    this.txtDecryptKey.text = "";

    this.stringAfterDecryption = "";
    this.txtDecryptEnd.text = "";

    this.stringBeforeEncryption = "";
    this.txtCryptStart.text = "";

    this.keyForEncryption = "";
    this.txtCryptKey.text = "";

    this.stringAfterEncryption = "";
    this.txtCryptEnd.text = "";
  }

  _makeDoubleArrowAnimation(container, centerPos, event) {
    // Left arrow
    const leftArrowPos = geom.subtract(centerPos, new PIXI.Point(27, 0));

    const leftArrowStatic = new PIXI.Sprite(
      this.config.app.loader.resources["images/triple-arrow.png"].texture
    );
    leftArrowStatic.anchor.set(0.5);
    leftArrowStatic.angle = 45;
    leftArrowStatic.position = leftArrowPos;
    container.addChild(leftArrowStatic);

    const leftArrowAnimated = util.makeAnimatedSprite(
      this.config.app.loader.resources["images/animated-arrow.json"]
    );
    leftArrowAnimated.anchor.set(0.5);
    leftArrowAnimated.angle = 135;
    leftArrowAnimated.position = leftArrowPos;
    leftArrowAnimated.loop = false;
    leftArrowAnimated.animationSpeed = 0.2;

    // Right arrow
    const rightArrowPos = geom.add(centerPos, new PIXI.Point(27, 0));

    const rightArrowStatic = new PIXI.Sprite(
      this.config.app.loader.resources["images/triple-arrow.png"].texture
    );
    rightArrowStatic.anchor.set(0.5);
    rightArrowStatic.angle = 135;
    rightArrowStatic.position = rightArrowPos;
    container.addChild(rightArrowStatic);

    const rightArrowAnimated = util.makeAnimatedSprite(
      this.config.app.loader.resources["images/animated-arrow.json"]
    );
    rightArrowAnimated.anchor.set(0.5);
    rightArrowAnimated.angle = 225;
    rightArrowAnimated.position = rightArrowPos;
    rightArrowAnimated.loop = false;
    rightArrowAnimated.animationSpeed = 0.2;

    const arrowSequence = new entity.EntitySequence(
      [
        new entity.WaitForEvent(this, event),
        new entity.ParallelEntity(
          [
            new entity.AnimatedSpriteEntity(leftArrowAnimated),
            new entity.AnimatedSpriteEntity(rightArrowAnimated)
          ],
          { autoTransition: true }
        )
      ],
      { loop: true }
    );
    this.addEntity(
      arrowSequence,
      entity.extendConfig({ container: container })
    );

    return arrowSequence;
  }
}
