import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as geom from "../booyah/src/geom.js";
import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";
import * as audio from "../booyah/src/audio.js";
import * as clipBoard from "./clipBoard.js";
import * as rsa from "./rsa.js";

// There seems to be a bug with keys leading to n under 3 digits. These ones work, though
export const keys = {
  draper: rsa.createKeys(13, 23),
  bluehat: rsa.createKeys(11, 13),
  raven: rsa.createKeys(11, 23),
  mudge: rsa.createKeys(23, 19),
  cyberpol: rsa.createKeys(23, 29)
};

// Test functions for keys (called only during test scenes)
export function testKey(keyInfo) {
  const testMessage = "hello";

  const publicStr = rsa.concat(keyInfo.public, keyInfo.n);
  const privateStr = rsa.concat(keyInfo.private, keyInfo.n);
  console.assert(publicStr !== privateStr);

  const publicDeconcat = rsa.deconcat(publicStr);
  const privateDeconcat = rsa.deconcat(privateStr);
  console.assert(publicDeconcat.key === keyInfo.public);
  console.assert(privateDeconcat.key === keyInfo.private);
  console.assert(publicDeconcat.key !== privateDeconcat.key);
  console.assert(publicDeconcat.n === keyInfo.n);
  console.assert(publicDeconcat.n === privateDeconcat.n);

  const encrypted = rsa.crypt(testMessage, keyInfo.public, keyInfo.n);
  console.assert(
    rsa.decrypt(encrypted, keyInfo.private, keyInfo.n) === testMessage
  );

  console.assert(
    rsa.decrypt(encrypted, keyInfo.public, keyInfo.n) !== testMessage
  );

  console.assert(
    rsa.crypt(encrypted, keyInfo.private, keyInfo.n) !==
      rsa.crypt(encrypted, keyInfo.public, keyInfo.n)
  );
}

export function testAllKeys() {
  for (const name in keys) {
    testKey(keys[name]);
  }
}

export function encryptMessage(to, message) {
  const keyInfo = keys[to];
  return rsa.crypt(message, keyInfo.public, keyInfo.n);
}

export function decryptMessage(to, message) {
  const keyInfo = keys[to];
  return rsa.decrypt(message, keyInfo.private, keyInfo.n);
}

export function signMessage(from, hash) {
  const keyInfo = keys[from];
  return rsa.crypt(hash, keyInfo.private, keyInfo.n);
}

export function verifySignature(from, signature) {
  const keyInfo = keys[from];
  return rsa.decrypt(signature, keyInfo.public, keyInfo.n);
}

/**
 * events:
 *  unreadInfo
 *  readAllInfo
 *  selectedUser
 */
export class Network extends entity.ParallelEntity {
  constructor(options = {}) {
    super();

    util.setupOptions(this, options, {
      showKeys: false
    });
  }

  _setup(config) {
    const interfaceTexts = this.config.jsonAssets.interface;

    this.container = new PIXI.Container();
    this.container.visible = false;
    this.config.container.addChild(this.container);

    const screen = new PIXI.Sprite(
      this.config.app.loader.resources["images/screenNormal.png"].texture
    );
    this.container.addChild(screen);

    const lineText = new PIXI.Sprite(
      this.config.app.loader.resources["images/lineText.png"].texture
    );
    lineText.position.set(130, 65);
    this.container.addChild(lineText);

    const ico = new PIXI.Sprite(
      this.config.app.loader.resources["images/icoNetwork.png"].texture
    );
    ico.scale.set(0.75);
    ico.position.set(135, 5);
    this.container.addChild(ico);

    const textIco = new PIXI.Text(
      interfaceTexts["network"].text.toUpperCase(),
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
      this.config.app.loader.resources["images/network/bg.png"].texture
    );
    this.container.addChild(this.bg);

    this.buttons = {
      draper: this._makeButton("draper", new PIXI.Point(150, 195), "Draper"),
      bluehat: this._makeButton("bluehat", new PIXI.Point(468, 195), "BlueHat"),
      raven: this._makeButton("raven", new PIXI.Point(150, 417), "Raven"),
      mudge: this._makeButton("mudge", new PIXI.Point(468, 417), "Mudge"),
      cyberpol: this._makeButton(
        "cyberpol",
        new PIXI.Point(310, 290),
        "Cyberpol"
      )
    };

    // By default, Cyberpol is hidden
    this.buttons.cyberpol.visible = false;

    this.iconChara = new PIXI.Sprite();
    this.iconChara.anchor.set(0.5);
    this.iconChara.scale.set(0.75);
    this.iconChara.position.set(781, 150);
    this.container.addChild(this.iconChara);

    this.txtName = new PIXI.Text("", {
      fontFamily: "Teko Light",
      fontSize: 34,
      fill: 0xffffff,
      align: "center"
    });
    this.txtName.anchor.set(0.5);
    this.txtName.position.set(781, 260);
    this.container.addChild(this.txtName);

    this.txtStatus = new PIXI.Text("", {
      fontFamily: "Teko Light",
      fontSize: 28,
      fill: 0xffffff,
      fontStyle: "italic",
      padding: 2
    });
    this.txtStatus.anchor.set(0.5);
    this.txtStatus.position.set(781, 300);
    this.container.addChild(this.txtStatus);

    if (this.showKeys) {
      // Public key
      this.publicKeySprite = new PIXI.Sprite(
        this.config.app.loader.resources["images/public-key.png"].texture
      );
      this.publicKeySprite.anchor.set(0.5);
      this.publicKeySprite.position.set(720, 400);
      this.publicKeySprite.visible = false;
      this.container.addChild(this.publicKeySprite);

      this.txtPublicKey = new PIXI.Text("", {
        fontFamily: "Teko",
        fontSize: 34,
        fill: 0xffffff,
        align: "center"
      });
      this.txtPublicKey.anchor.set(0.5);
      this.txtPublicKey.position.set(830, 400);
      this.txtPublicKey.interactive = true;
      this.container.addChild(this.txtPublicKey);

      this._on(this.txtPublicKey, "pointertap", () => {
        this.config.clipBoard.appear({
          position: this.txtPublicKey.position,
          textToCopy: this.txtPublicKey.text
        });
      });

      // Private key
      this.privateKeySprite = new PIXI.Sprite(
        this.config.app.loader.resources["images/private-key.png"].texture
      );
      this.privateKeySprite.anchor.set(0.5);
      this.privateKeySprite.position.set(720, 450);
      this.privateKeySprite.visible = false;
      this.container.addChild(this.privateKeySprite);

      this.txtPrivateKey = new PIXI.Text("", {
        fontFamily: "Teko",
        fontSize: 34,
        fill: 0xffffff,
        align: "center"
      });
      this.txtPrivateKey.anchor.set(0.5);
      this.txtPrivateKey.position.set(830, 450);
      this.txtPrivateKey.interactive = true;
      this.container.addChild(this.txtPrivateKey);

      this._on(this.txtPrivateKey, "pointertap", () => {
        this.config.clipBoard.appear({
          position: this.txtPrivateKey.position,
          textToCopy: this.txtPrivateKey.text
        });
      });
    }
  }

  _onTap(name) {
    this.config.fxMachine.play("click");

    for (const characterName of [
      "raven",
      "mudge",
      "draper",
      "bluehat",
      "cyberpol"
    ]) {
      this.buttons[characterName].bg.tint =
        characterName === name ? 0xffffff : 0xaaaaaa;
    }

    this.iconChara.texture = this.config.app.loader.resources[
      "images/network/i" + util.uppercaseFirstLetter(name) + ".png"
    ].texture;
    this.txtName.text = util.uppercaseFirstLetter(name);

    this.txtStatus.text = this.config.jsonAssets.interface[
      `network-status-${name}`
    ].text;

    if (this.showKeys) {
      const key = keys[name];
      this.txtPublicKey.text = rsa.concat(key.public, key.n);
      if (name === "draper") {
        this.txtPrivateKey.text = rsa.concat(key.private, key.n);
      } else {
        this.txtPrivateKey.text = "?";
      }

      this.publicKeySprite.visible = true;
      this.privateKeySprite.visible = true;
    }

    this.emit("selectedUser", name);
  }

  _teardown() {
    this.config.container.removeChild(this.container);
  }

  setVisible(isVisible) {
    this.container.visible = isVisible;

    if (isVisible) this.emit("readAllInfo");
  }

  get showCyberpol() {
    return this.buttons.cyberpol.visible;
  }
  set showCyberpol(value) {
    this.buttons.cyberpol.visible = value;
  }

  _makeButton(name, pos, text) {
    const container = new PIXI.Container();
    container.position = pos;
    container.interactive = true;
    this.container.addChild(container);
    this._on(container, "pointertap", () => this._onTap(name));

    const bg = new PIXI.Sprite(
      this.config.app.loader.resources["images/network/computer.png"].texture
    );
    bg.anchor.set(0.5, 0.4);
    bg.tint = 0xaaaaaa;
    container.addChild(bg);
    container.bg = bg;

    const textBox = new PIXI.Text(text, {
      fontFamily: "Teko Light",
      fontSize: 30,
      fill: 0xffffff,
      align: "center"
    });
    textBox.anchor.set(0.5);
    container.addChild(textBox);

    return container;
  }
}
