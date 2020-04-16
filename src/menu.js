import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as geom from "../booyah/src/geom.js";
import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";
import * as audio from "../booyah/src/audio.js";
import * as tween from "../booyah/src/tween.js";

export const screenNames = [
  "chat",
  "objectives",
  "transactions",
  "network",
  "ledger",
  "inventory",
  "blockchain",
  "toolbox"
];

const octogon = new PIXI.Polygon(
  2 - 80,
  50 - 85,
  50 - 80,
  4 - 85,
  110 - 80,
  4 - 85,
  155 - 80,
  50 - 85,
  155 - 80,
  110 - 85,
  110 - 80,
  155 - 85,
  50 - 80,
  155 - 85,
  4 - 80,
  110 - 85
);

const rows = [215, 400];
const columns = [150, 370, 590, 810];
const buttonPositions = {
  chat: new PIXI.Point(columns[0], rows[0]),
  objectives: new PIXI.Point(columns[0], rows[1]),
  transactions: new PIXI.Point(columns[1], rows[0]),
  network: new PIXI.Point(columns[1], rows[1]),
  ledger: new PIXI.Point(columns[2], rows[0]),
  inventory: new PIXI.Point(columns[2], rows[1]),
  blockchain: new PIXI.Point(columns[3], rows[0]),
  toolbox: new PIXI.Point(columns[3], rows[1])
};

const menuDefaultButtonScale = 0.75;
const menuZoomedButtonScale = 0.9;

const unreadMarkerOffset = new PIXI.Point(50, -50);

/**
 * events: names of menu items
 */
export class Menu extends entity.ParallelEntity {
  constructor(options = {}) {
    super();

    util.setupOptions(this, options, {
      activeButtonNames: [],
      versionNumber: "1.0"
    });
  }

  _setup(config) {
    const interfaceTexts = this.config.jsonAssets.interface;

    /* #region  bouttons */
    this.container = new PIXI.Container();
    this.container.visible = false;
    this.config.container.addChild(this.container);

    this.bg = new PIXI.Sprite(
      this.config.app.loader.resources["images/screenMenu.png"].texture
    );
    this.container.addChild(this.bg);

    // Animated icon
    {
      const sprite = util.makeAnimatedSprite(
        this.config.app.loader.resources["images/rotation-octor.json"]
      );
      sprite.anchor.set(0.5);
      sprite.position.set(52, 46);
      sprite.animationSpeed = 0.2;

      this.rotationOctor = new entity.AnimatedSpriteEntity(sprite);
      this.addEntity(
        this.rotationOctor,
        entity.extendConfig({ container: this.container })
      );

      const logo = new PIXI.Sprite(
        this.config.app.loader.resources["images/logo-menu.png"].texture
      );
      logo.position.set(74, 28);
      this.container.addChild(logo);

      const versionNumber = new PIXI.Text(this.versionNumber, {
        fontFamily: "Teko Light",
        fontSize: 32,
        fill: 0xfc5f3b,
        letterSpacing: 1.2
      });
      versionNumber.position.set(136, 82);
      this.container.addChild(versionNumber);
    }

    // Draper's login
    {
      const text = new PIXI.Text("DRAPER", {
        fontFamily: "Teko Light",
        fontSize: 32,
        fill: 0x5ac7d5,
        letterSpacing: 6
      });
      text.anchor.set(1, 1);
      text.position.set(778, 106);
      this.container.addChild(text);
    }

    this.buttons = {};
    for (const name of screenNames) {
      const button = new PIXI.Container();
      button.position = buttonPositions[name];
      button.scale.set(menuDefaultButtonScale);
      this.container.addChild(button);
      this.buttons[name] = button;

      const btnHexa = new PIXI.Sprite(
        this.config.app.loader.resources[`images/menuHexa.png`].texture
      );
      btnHexa.anchor.set(0.5);
      btnHexa.hitArea = octogon;
      button.addChild(btnHexa);

      const uppercaseName = name[0].toUpperCase() + name.substring(1);
      const ico = new PIXI.Sprite(
        this.config.app.loader.resources[
          `images/ico${uppercaseName}.png`
        ].texture
      );
      ico.anchor.set(0.5);
      button.addChild(ico);

      button.text = new PIXI.Text(interfaceTexts[name].text, {
        fontFamily: "Teko",
        fontSize: 48,
        fill: 0xffffff,
        letterSpacing: 0.3
      });
      button.text.anchor.set(0.5);
      button.text.position.set(0, 110);
      button.addChild(button.text);

      this._on(button, "pointertap", () => this._onTap(name));

      this._on(button, "mouseover", () => this._onButtonOver(name));
      this._on(button, "mouseout", () => {
        if (name === this.activeButtonName) this._onButtonOut();
      });
    }

    this.unreadMarkers = {};
    for (const name of screenNames) {
      const unreadMarker = new PIXI.Sprite(
        this.config.app.loader.resources[`images/unread.png`].texture
      );
      unreadMarker.visible = false;
      unreadMarker.anchor.set(0.5);
      unreadMarker.position = geom.add(
        buttonPositions[name],
        unreadMarkerOffset
      );
      this.container.addChild(unreadMarker);
      this.unreadMarkers[name] = unreadMarker;
    }

    this.activeButtonName = null;
    this.tweenSequence = null;

    this._updateActiveButtons();
  }

  _onTap(name) {
    this.config.fxMachine.play("click");

    this.emit("show", name);
  }

  _teardown() {
    this.config.container.removeChild(this.container);
  }

  setVisible(isVisible) {
    this.container.visible = isVisible;

    if (!isVisible) this._onButtonOut();
  }

  activateButtons(names) {
    this.activeButtonNames = _.union(this.activeButtonNames, names);
    this._updateActiveButtons();
  }

  markAsUnread(name) {
    this.unreadMarkers[name].visible = true;
  }

  markAsRead(name) {
    this.unreadMarkers[name].visible = false;
  }

  _onButtonOut() {
    if (!this.activeButtonName) return;

    this.removeEntity(this.tweenSequence);
    this.tweenSequence = null;

    this.buttons[this.activeButtonName].scale.set(menuDefaultButtonScale);

    this.activeButtonName = null;
  }

  _onButtonOver(name) {
    if (this.activeButtonName) this._onButtonOut();

    this.activeButtonName = name;
    this.tweenSequence = new entity.EntitySequence(
      [
        new tween.make(
          this.buttons[name],
          {
            scale: {
              from: new PIXI.Point(
                menuDefaultButtonScale,
                menuDefaultButtonScale
              ),
              to: new PIXI.Point(menuZoomedButtonScale, menuZoomedButtonScale),
              interpolate: tween.interpolation.point
            }
          },
          {
            duration: 500
          }
        ),
        new tween.make(
          this.buttons[name],
          {
            scale: {
              from: new PIXI.Point(
                menuZoomedButtonScale,
                menuZoomedButtonScale
              ),
              to: new PIXI.Point(
                menuDefaultButtonScale,
                menuDefaultButtonScale
              ),
              interpolate: tween.interpolation.point
            }
          },
          {
            duration: 500
          }
        )
      ],
      { loop: true }
    );

    this.addEntity(this.tweenSequence);
  }

  _updateActiveButtons() {
    for (const name of screenNames) {
      const button = this.buttons[name];
      if (_.contains(this.activeButtonNames, name)) {
        button.interactive = true;
        button.alpha = 1;
        button.text.visible = true;
      } else {
        button.interactive = false;
        button.alpha = 0.5;
        button.text.visible = false;
      }
    }
  }
}

const desktopDefaultButtonScale = 0.3;
const desktopZoomedButtonScale = 0.4;

export class DesktopMenu extends entity.ParallelEntity {
  constructor(options = {}) {
    super();

    util.setupOptions(this, options, {
      activeButtonNames: []
    });
  }

  _setup() {
    const unreadMarkerOffset = new PIXI.Point(20, -20);
    const textOffset = new PIXI.Point(30, 0);
    const interfaceTexts = this.config.jsonAssets.interface;

    this.container = new PIXI.Container();
    this.config.container.addChild(this.container);

    this.buttons = {};
    this.unreadMarkers = {};
    this.buttonTexts = {};
    for (let i = 0; i < screenNames.length; i++) {
      const name = screenNames[i];

      const button = new PIXI.Container();
      button.scale.set(desktopDefaultButtonScale);
      button.position.set(30, (i + 1) * 60 + 35);
      this.container.addChild(button);
      this.buttons[name] = button;

      const selectedFilter = new PIXI.filters.AdvancedBloomFilter({
        brightness: 2
      });
      selectedFilter.enabled = false;
      button.filters = [selectedFilter];

      const btnHexa = new PIXI.Sprite(
        this.config.app.loader.resources[`images/menuHexa.png`].texture
      );
      btnHexa.anchor.set(0.5);
      btnHexa.hitArea = octogon;
      button.addChild(btnHexa);

      const uppercaseName = name[0].toUpperCase() + name.substring(1);
      const ico = new PIXI.Sprite(
        this.config.app.loader.resources[
          `images/ico${uppercaseName}.png`
        ].texture
      );
      ico.anchor.set(0.5);
      button.addChild(ico);

      this._on(button, "pointertap", () => this._onTap(name));

      const buttonText = new PIXI.Text(interfaceTexts[name].text, {
        fontFamily: "Teko",
        fontSize: 36,
        fill: 0xffffff,
        letterSpacing: 0.3,
        stroke: 0x000000,
        strokeThickness: 5
      });
      buttonText.anchor.set(0, 0.5);
      buttonText.position = geom.add(button.position, textOffset);
      buttonText.visible = false;
      this.container.addChild(buttonText);
      this.buttonTexts[name] = buttonText;

      this._on(button, "mouseover", () => this._onButtonOver(name));
      this._on(button, "mouseout", () => {
        if (name === this.activeButtonName) this._onButtonOut();
      });

      const unreadMarker = new PIXI.Sprite(
        this.config.app.loader.resources[`images/unread.png`].texture
      );
      unreadMarker.visible = false;
      unreadMarker.anchor.set(0.5);
      unreadMarker.scale.set(0.4);
      unreadMarker.position = geom.add(button.position, unreadMarkerOffset);
      this.container.addChild(unreadMarker);
      this.unreadMarkers[name] = unreadMarker;
    }

    this.activeButtonName = null;
    this.tweenSequence = null;

    this._on(this.config.octor, "switchedScreen", this._updateSelectedButton);

    this._updateActiveButtons();
  }

  teardown() {
    this.config.container.removeChild(this.container);
  }

  _updateActiveButtons() {
    for (const name of screenNames) {
      const button = this.buttons[name];
      if (_.contains(this.activeButtonNames, name)) {
        button.interactive = true;
        button.alpha = 1;
      } else {
        button.interactive = false;
        button.alpha = 0.5;
      }
    }
  }

  _updateSelectedButton(screen) {
    if (screen === "toolbox") return;

    for (const name in this.buttons) {
      this.buttons[name].filters[0].enabled = screen === name;
    }
  }

  _onTap(name) {
    this.config.fxMachine.play("click");

    this.emit("show", name);
  }

  _onButtonOut() {
    if (!this.activeButtonName) return;

    this.buttonTexts[this.activeButtonName].visible = false;

    this.removeEntity(this.tweenSequence);
    this.tweenSequence = null;

    this.buttons[this.activeButtonName].scale.set(desktopDefaultButtonScale);

    this.activeButtonName = null;
  }

  _onButtonOver(name) {
    if (this.activeButtonName) this._onButtonOut();

    this.activeButtonName = name;

    this.buttonTexts[name].visible = true;

    this.tweenSequence = new entity.EntitySequence(
      [
        new tween.make(
          this.buttons[name],
          {
            scale: {
              from: new PIXI.Point(
                desktopDefaultButtonScale,
                desktopDefaultButtonScale
              ),
              to: new PIXI.Point(
                desktopZoomedButtonScale,
                desktopZoomedButtonScale
              ),
              interpolate: tween.interpolation.point
            }
          },
          {
            duration: 500
          }
        ),
        new tween.make(
          this.buttons[name],
          {
            scale: {
              from: new PIXI.Point(
                desktopZoomedButtonScale,
                desktopZoomedButtonScale
              ),
              to: new PIXI.Point(
                desktopDefaultButtonScale,
                desktopDefaultButtonScale
              ),
              interpolate: tween.interpolation.point
            }
          },
          {
            duration: 500
          }
        )
      ],
      { loop: true }
    );

    this.addEntity(this.tweenSequence);
  }

  get visible() {
    return this.container.visible;
  }
  set visible(visible) {
    this.container.visible = visible;
  }

  activateButtons(names) {
    this.activeButtonNames = _.union(this.activeButtonNames, names);
    this._updateActiveButtons();
  }

  markAsUnread(name) {
    this.unreadMarkers[name].visible = true;
  }

  markAsRead(name) {
    this.unreadMarkers[name].visible = false;
  }
}
