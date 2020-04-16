import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as geom from "../booyah/src/geom.js";
import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";
import * as audio from "../booyah/src/audio.js";

import * as clipBoard from "./clipBoard.js";
import * as ledger from "./ledger.js";
import * as inventory from "./inventory.js";
import * as chat from "./chat.js";
import * as network from "./network.js";
import * as objectives from "./objectives.js";
import * as transactions from "./transactions.js";
import * as blockchain from "./blockchain.js";
import * as hero from "./hero.js";
import * as notification from "./notification.js";
import * as menu from "./menu.js";
import * as toolbox from "./toolbox.js";
import * as objectiveEffect from "./objectiveEffect.js";

const screensWithToolbox = ["chat", "transactions", "blockchain"];
const screensWithMemento = [
  "objectives",
  "inventory",
  "transactions",
  "ledger",
  "chat"
];

const unreadMarkerOffset = new PIXI.Point(25, -25);

/**
 * events:
 *  switchedScreen(name)
 *  transactionUpdatedStatus(transactionData, status)
 *  activatedButton(name)
 */
export class Octor extends entity.ParallelEntity {
  constructor(optionsIn = {}) {
    super();

    this.options = util.setupOptions({}, optionsIn, {
      memento: null,

      menu: {},
      transactions: {},
      ledger: {},
      toolbox: {},
      inventory: {},
      network: {},
      blockchain: {},
      objectives: {},

      toolboxIsActive: false,
      showToolboxNotification: false
    });

    // Merge memento into options
    if (this.options.memento) {
      for (const screenName of menu.screenNames) {
        if (!_.has(this.options, screenName)) this.options[screenName] = {};

        this.options[screenName].memento = this.options.memento[screenName];
      }
    }

    // If toolbox is active, enable the button
    if (this.options.toolboxIsActive) {
      this.options.menu.activeButtonNames.push("toolbox");
    }

    this.showToolboxNotification = this.options.showToolboxNotification;
  }

  _setup() {
    this.container = new PIXI.Container();
    this.config.container.addChild(this.container);

    this.tilingSprite = new PIXI.TilingSprite(
      this.config.app.loader.resources["images/bgTilling.jpg"].texture,
      960,
      540
    );
    this.container.addChild(this.tilingSprite);

    const extendedConfig = _.extend({}, this.config, {
      octor: this,
      container: this.container
    });

    // Layers: screen, buttons, desktopMenu, then overlay
    const screenContainer = new PIXI.Container();
    if (!this.config.isOnDesktop) screenContainer.position.x = -20;
    this.container.addChild(screenContainer);

    const buttonLayer = new PIXI.Container();
    this.container.addChild(buttonLayer);

    if (this.config.isOnDesktop) {
      this.desktopMenu = new menu.DesktopMenu(this.options.menu);
      this.addEntity(this.desktopMenu, extendedConfig);
    }

    const overlayContainer = new PIXI.Container();
    this.container.addChild(overlayContainer);

    this.screens = {
      menu: new menu.Menu(this.options.menu),
      ledger: new ledger.Ledger(this.options.ledger),
      inventory: new inventory.Inventory(this.options.inventory),
      chat: new chat.Chat(this.options.chat),
      network: new network.Network(this.options.network),
      objectives: new objectives.Objectives(this.options.objectives),
      transactions: new transactions.Transactions(this.options.transactions),
      blockchain: new blockchain.Blockchain(this.options.blockchain)
    };

    Object.values(this.screens).forEach(screen =>
      this.addEntity(
        screen,
        _.extend({}, extendedConfig, {
          container: screenContainer,
          overlayContainer
        })
      )
    );

    this.btnHome = new PIXI.Sprite(
      this.config.app.loader.resources["images/home.png"].texture
    );
    this.btnHome.anchor.set(0.5);
    if (this.config.isOnDesktop) {
      this.btnHome.position.set(35, 35);
      this.btnHome.scale.set(57 / 65);
    } else {
      this.btnHome.position.set(50, 50);
    }

    this.btnHome.interactive = true;
    buttonLayer.addChild(this.btnHome);
    this._on(this.btnHome, "pointertap", () => {
      this.config.fxMachine.play("click");
      this.switchScreen("menu");
    });

    if (!this.config.isOnDesktop) {
      this.homeUnreadMarker = new PIXI.Sprite(
        this.config.app.loader.resources[`images/unread.png`].texture
      );
      this.homeUnreadMarker.anchor.set(0.5);
      this.homeUnreadMarker.scale.set(0.6);
      this.homeUnreadMarker.position = geom.add(
        this.btnHome.position,
        unreadMarkerOffset
      );
      this.container.addChild(this.homeUnreadMarker);
    }

    // Setup unread notifications
    for (const name in this.screens) {
      this._on(this.screens[name], "unreadInfo", () => {
        this.screens.menu.markAsUnread(name);
        if (this.desktopMenu) this.desktopMenu.markAsUnread(name);

        this._refreshHomeUnreadMarker();
      });
      this._on(this.screens[name], "readAllInfo", () => {
        this.screens.menu.markAsRead(name);
        if (this.desktopMenu) this.desktopMenu.markAsRead(name);

        this._refreshHomeUnreadMarker();
      });
    }

    // Update ledger when a transaction is accepted
    this._on(this.screens.transactions, "addedTransaction", transaction => {
      this._on(transaction, "updatedStatus", status => {
        if (status === "accepted")
          this.screens.ledger.addTransaction(transaction);
        this.emit("transactionUpdatedStatus", transaction, status);
      });
    });

    // When a block is added, update ledger and show list transactions screen
    this._on(this.screens.blockchain, "createdBlock", this._onNewBlock);
    this._on(this.screens.blockchain, "addedBlock", this._onNewBlock);

    // All screens start off invisible
    this.currentScreenName = "menu";
    this.screens.menu.setVisible(true);

    this.toolboxButton = new PIXI.Sprite(
      this.config.app.loader.resources["images/btnToolbox.png"].texture
    );
    this.toolboxButton.position.set(25, 470);

    this.toolboxNotification = new PIXI.Sprite(
      this.config.app.loader.resources["images/unread.png"].texture
    );
    this.toolboxNotification.position.set(25 + 10, 470 - 60);

    if (!this.config.isOnDesktop) {
      buttonLayer.addChild(this.toolboxButton);
      buttonLayer.addChild(this.toolboxNotification);
    }

    if (this.options.toolboxIsActive) {
      // Add the toolbox later, so it will be on top
      this.toolbox = new toolbox.Toolbox(this.options.toolbox);

      if (this.showToolboxNotification) {
        this.markAsUnread("toolbox");
      }

      this.toolboxButton.interactive = true;
      this._on(this.toolboxButton, "pointertap", () => {
        this.config.fxMachine.play("click");

        this.toolbox.appear();
      });

      // Remove unread notification on toolbox
      this._on(this.toolbox, "opened", () => {
        this.showToolboxNotification = false;
        this.toolboxNotification.visible = false;
        this.markAsRead("toolbox");
      });
    } else {
      this.toolboxButton.alpha = 0.5;
    }

    // Setup ObjectiveEffect
    const objectiveEffectSequence = new entity.EntitySequence(
      [
        // Wait until objective is completed
        new entity.WaitForEvent(this.screens.objectives, "completedObjective"),
        // Run filter
        new objectiveEffect.ObjectiveEffect()
      ],
      { loop: true }
    );
    this.addEntity(objectiveEffectSequence);

    // Jump directy to screens using the menu
    this._on(this.screens.menu, "show", name => this.switchScreen(name));
    if (this.desktopMenu)
      this._on(this.desktopMenu, "show", name => this.switchScreen(name));

    if (this.options.toolboxIsActive) {
      // Add the toolbox on top
      this.addEntity(this.toolbox);
    }

    this._refreshHomeUnreadMarker();
    this.switchScreen("menu");
  }

  _update(options) {
    const vector = geom.vectorFromAngle(
      geom.degreesToRadians((options.timeSinceStart / 2000) % 360),
      0.5
    );

    this.tilingSprite.tilePosition = geom.add(
      this.tilingSprite.tilePosition,
      vector
    );
  }

  _teardown() {
    this.config.container.removeChild(this.container);
  }

  switchScreen(name) {
    if (name === "toolbox") {
      this.toolbox.appear();
    } else {
      this.screens[this.currentScreenName].setVisible(false);

      this.currentScreenName = name;
      this.screens[name].setVisible(true);

      this.toolboxButton.visible = _.contains(screensWithToolbox, name);
      this.toolboxNotification.visible =
        this.toolboxButton.visible && this.showToolboxNotification;

      this.btnHome.visible = name !== "menu";
      if (this.desktopMenu) this.desktopMenu.visible = name !== "menu";

      this._refreshHomeUnreadMarker();
    }

    this.emit("switchedScreen", name);
  }

  makeMemento() {
    const memento = {};
    for (const name of screensWithMemento) {
      memento[name] = this.screens[name].makeMemento();
    }
    return memento;
  }

  // Dispatch the command to both menus
  activateButtons(names) {
    this.screens.menu.activateButtons(names);
    if (this.desktopMenu) this.desktopMenu.activateButtons(names);

    for (const name of names) this.emit("activatedButton", name);
  }

  markAsUnread(name) {
    this.screens.menu.markAsUnread(name);
    if (this.desktopMenu) this.desktopMenu.markAsUnread(name);

    this._refreshHomeUnreadMarker();
  }

  markAsRead(name) {
    this.screens.menu.markAsRead(name);
    if (this.desktopMenu) this.desktopMenu.markAsRead(name);

    this._refreshHomeUnreadMarker();
  }

  _onNewBlock(block) {
    this.screens.ledger.addBlock(block);

    // TODO: make this function public?
    this.screens.transactions._showTransactionList();
  }

  _refreshHomeUnreadMarker() {
    if (!this.homeUnreadMarker) return;

    if (this.currentScreenName === "menu") {
      // On the menu, don't show the unread marker
      this.homeUnreadMarker.visible = false;
    } else {
      // Only show the unread marker if a different screen has them
      const unreadMarkerCount = _.chain(this.screens.menu.unreadMarkers)
        .filter(
          (marker, name) => marker.visible && name !== this.currentScreenName
        )
        .size()
        .value();
      this.homeUnreadMarker.visible = unreadMarkerCount > 0;
    }
  }
}
