import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as geom from "../booyah/src/geom.js";
import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";
import * as audio from "../booyah/src/audio.js";
import * as scroll from "../booyah/src/scroll.js";

import * as clipBoard from "./clipBoard.js";
import * as tooltip from "./tooltip.js";
import * as autoscroll from "./autoscroll.js";

const characterNames = ["smith", "bluehat", "mudge", "raven", "cyberpol"];

const messageBoxWidth = 800 - 123;
const messageWidth = messageBoxWidth - 150;
const marginBetweenLines = 34 / 2;
const marginBetweenMessages = 34 / 2;
const buttonPadding = 10;
const timePerLetter = 16;
const timeBetweenMessages = 500;

const buttonPositions = {
  smith: new PIXI.Point(458.5, 106.5),
  bluehat: new PIXI.Point(682, 106.5),
  mudge: new PIXI.Point(570, 106.5),
  raven: new PIXI.Point(780.5, 106.5),
  cyberpol: new PIXI.Point(839, 200)
};

const unreadMarkerOffset = new PIXI.Point(40, -40);

export function makeChatDialogEntity(octor, id) {
  const chat = octor.screens.chat;

  return new entity.EntitySequence([
    new entity.FunctionCallEntity(() => chat.addDialog(id)),
    new entity.WaitForEvent(chat, "dialogDone", dialogId => dialogId === id)
  ]);
}

/**
 * events:
 *  dialogDone(id)
 *  unreadInfo
 *  readAllInfo
 *  showMessageBox(name)
 *  clickedButton(dialog, buttonIndex)
 */
export class Chat extends entity.ParallelEntity {
  constructor(options = {}) {
    super();

    util.setupOptions(this, options, {
      memento: null
    });
  }

  _setup(config) {
    const interfaceTexts = this.config.jsonAssets.interface;

    this.container = new PIXI.Container();
    this.container.visible = false;
    this.config.container.addChild(this.container);

    const screenImage = this.config.isOnDesktop
      ? "images/screenScroll.png"
      : "images/screenToolScroll.png";
    const screen = new PIXI.Sprite(
      this.config.app.loader.resources[screenImage].texture
    );
    this.container.addChild(screen);

    const lineText = new PIXI.Sprite(
      this.config.app.loader.resources["images/lineText.png"].texture
    );
    lineText.position.set(130, 65);
    this.container.addChild(lineText);

    const ico = new PIXI.Sprite(
      this.config.app.loader.resources["images/icoChat.png"].texture
    );
    ico.scale.set(0.75);
    ico.position.set(130, 10);
    this.container.addChild(ico);

    const textIco = new PIXI.Text(interfaceTexts["chat"].text.toUpperCase(), {
      fontFamily: "Teko Light",
      fontSize: 50,
      fill: 0xffffff,
      letterSpacing: 0.4
    });
    textIco.position.set(220, 55);
    this.container.addChild(textIco);

    this.bg = new PIXI.Sprite(
      this.config.app.loader.resources["images/chat/bg.png"].texture
    );
    this.container.addChild(this.bg);

    this.textMessage = new PIXI.Container();

    const childConfig = _.extend({}, this.config, {
      container: this.container
    });

    this.messageBoxes = {};
    this.buttons = {};
    for (const name of characterNames) {
      const button = new PIXI.Sprite();
      button.position = buttonPositions[name];
      button.anchor.set(0.5);
      button.hitArea = new PIXI.Polygon(-30, -35, 90, -35, 25, 35, -90, 35);

      button.interactive = true;
      this._on(button, "pointertap", () => {
        if (this.currentCharacterName === name) return;

        this.config.fxMachine.play("click");
        this._showMessageBox(name);
      });
      this.container.addChild(button);
      this.buttons[name] = button;

      const messageBox = new MessageBox(
        this.memento && { memento: this.memento[name] }
      );
      this._on(messageBox, "dialogDone", id =>
        this.completedDialogQueue.push(id)
      );
      this._on(messageBox, "interruptedDialog", () => {
        this.unreadMarkers[name].visible = false;
        this._checkAllRead();
      });
      this._on(messageBox, "unreadInfo", () => {
        this.unreadMarkers[name].visible = true;
        this.emit("unreadInfo");
      });
      this._on(messageBox, "clickedButton", (...args) =>
        this.emit("clickedButton", ...args)
      );

      this.messageBoxes[name] = messageBox;
      this.addEntity(messageBox, childConfig);
    }

    // Cyberpol button starts hidden
    this.buttons.cyberpol.visible = false;

    this.unreadMarkers = {};
    for (const name of characterNames) {
      const unreadMarker = new PIXI.Sprite(
        this.config.app.loader.resources[`images/unread.png`].texture
      );
      unreadMarker.visible = false;
      unreadMarker.scale.set(0.75);
      unreadMarker.anchor.set(0.5);
      unreadMarker.position = geom.add(
        buttonPositions[name],
        unreadMarkerOffset
      );
      this.container.addChild(unreadMarker);
      this.unreadMarkers[name] = unreadMarker;
    }

    this.completedDialogQueue = [];

    this.currentCharacterName = null;
    this._showMessageBox("smith");
  }

  _update(options) {
    if (!this.container.visible) return;

    while (this.completedDialogQueue.length > 0) {
      this.emit("dialogDone", this.completedDialogQueue.shift());
      this._checkAllRead();
    }
  }

  _showMessageBox(name) {
    // Show the correct button graphic
    for (const buttonName of characterNames) {
      const filename = buttonName === name ? buttonName : buttonName + "T";
      this.buttons[buttonName].texture = this.config.app.loader.resources[
        `images/chat/${filename}.png`
      ].texture;
    }

    if (this.container.visible) {
      // Show the correct MessageBox
      this.messageBoxes[this.currentCharacterName].container.visible = false;
      this.messageBoxes[name].container.visible = true;

      // Remove unread notification
      this.unreadMarkers[name].visible = false;

      this._checkAllRead();
    }

    this.currentCharacterName = name;

    this.emit("showMessageBox", name);
  }

  _teardown() {
    this.config.container.removeChild(this.container);
  }

  addDialog(id) {
    const dialog = this.config.jsonAssets.messages[id];
    this.messageBoxes[dialog.chat.toLowerCase()].addDialog(dialog);
  }

  setVisible(isVisible) {
    this.container.visible = isVisible;

    if (isVisible) {
      // Re-enable visibility of selected message box
      this.messageBoxes[this.currentCharacterName].container.visible = true;
      this.unreadMarkers[this.currentCharacterName].visible = false;
    } else {
      // Hide all message boxes
      Object.values(this.messageBoxes).forEach(
        messageBox => (messageBox.container.visible = false)
      );
    }
  }

  closeUnresolvedDialogs() {
    _.each(this.messageBoxes, box => box.closeUnresolvedDialog());
  }

  makeMemento() {
    // We can't have unresolved dialogs, because they won't restore properly
    this.closeUnresolvedDialogs();
    return _.mapObject(this.messageBoxes, box => box.makeMemento());
  }

  _checkAllRead() {
    if (!_.some(_.values(this.unreadMarkers), "visible")) {
      this.emit("readAllInfo");
    }
  }

  get showCyberpol() {
    return this.buttons.cyberpol.visible;
  }
  set showCyberpol(value) {
    this.buttons.cyberpol.visible = value;
  }
}

/**
 * events:
 *  dialogDone(id)
 *  unreadInfo
 *  interruptedDialog
 *  clickedButton(dialog, buttonIndex)
 */
class MessageBox extends entity.ParallelEntity {
  constructor(options = {}) {
    super();

    util.setupOptions(this, options, {
      memento: null
    });
  }

  _setup() {
    this.lastMessageY = this.memento ? this.memento.lastMessageY : 0;

    this.container = new PIXI.Container();
    this.container.visible = false;
    this.container.position.set(123, 166);
    this.config.container.addChild(this.container);

    const scrollboxOptions = {
      boxWidth: 710,
      boxHeight: 280,
      overflowX: "none",
      overflowY: "scroll",
      scrollbarOffsetVertical: 100,
      scrollbarSize: 30, // width in pixels
      scrollbarBackground: 0, // background color
      scrollbarBackgroundAlpha: 0.25,
      scrollbarForeground: 0x68f1ff, // foreground color
      scrollbarForegroundAlpha: 1,
      contentMarginY: 50
    };
    if (this.memento) scrollboxOptions.content = this.memento.content;

    this.scrollbox = new scroll.Scrollbox(scrollboxOptions);
    this.addEntity(
      this.scrollbox,
      entity.extendConfig({ container: this.container })
    );

    const autoscrollEntity = new autoscroll.Autoscroll(this.scrollbox);
    this.addEntity(
      autoscrollEntity,
      entity.extendConfig({ container: this.container })
    );

    this.dialogQueue = [];
    this.currentDialog = null;
    this.messagesToShow = [];
    this.completedDialogQueue = [];
    this.messageLength = 0;

    this.activeButtonsContainer = null;

    const revealLineSequence = new entity.EntitySequence(
      [
        new entity.FunctionalEntity({
          requestTransition: () =>
            this.messagesToShow.length > 0 || this.dialogQueue.length > 0
        }),
        new entity.FunctionCallEntity(() => {
          this._unpackQueue();
          this._revealNextMessage();
        }),
        () =>
          new entity.WaitingEntity(
            timeBetweenMessages + this.messageLength * timePerLetter
          ),
        new entity.FunctionalEntity({
          requestTransition: () => !this.activeButtonsContainer
        }),
        // When following a button press, add a delay before the next message
        () =>
          this.buttonTextLength > 0
            ? new entity.WaitingEntity(
                timeBetweenMessages + this.buttonTextLength * timePerLetter
              )
            : new entity.TransitoryEntity(true),
        new entity.FunctionCallEntity(() => {
          this._handleDialogEnd();
        })
      ],
      { loop: true }
    );
    this.addEntity(revealLineSequence);
  }

  _teardown() {
    this.config.container.removeChild(this.container);
  }

  _update(options) {
    if (!this.container.visible) return;

    while (this.completedDialogQueue.length > 0) {
      this.emit("dialogDone", this.completedDialogQueue.shift());
    }
  }

  addDialog(dialog) {
    this.dialogQueue.push(dialog);
  }

  closeUnresolvedDialog() {
    if (!this.activeButtonsContainer) return;

    this.scrollbox.content.removeChild(this.activeButtonsContainer);
    this.activeButtonsContainer = null;

    // Quit current dialog
    this.messagesToShow = [];

    this.emit("interruptedDialog");
  }

  getMessagesById(id) {
    return _.filter(this.scrollbox.content.children, { id });
  }

  _unpackQueue() {
    if (this.messagesToShow.length === 0) {
      this.currentDialog = this.dialogQueue.shift();

      // Break up dialog into multiple messages, attaching to dialog ID to each
      const messages = this._breakIntoMessages(
        this.currentDialog.text
      ).map(message => ({ id: this.currentDialog.id, message }));
      this.messagesToShow.push(...messages);

      // Don't add margin before 1st line
      if (this.lastMessageY > 0) {
        this.lastMessageY += marginBetweenMessages;
      }
    }
  }

  makeMemento() {
    return {
      content: this.scrollbox.content,
      lastMessageY: this.lastMessageY
    };
  }

  // Sets this.messageLength as well
  _revealNextMessage() {
    // Matches text like "[Hello] Hi, nice to meet you"
    const messageRegexp = /(?:\{(.+)\})?(?:\[(.+)\])?(.*)/;

    const { message, id } = this.messagesToShow.shift();
    let [, imageName, allButtonText, messageText] = messageRegexp.exec(message);
    if (messageText) messageText = messageText.trim();

    if (imageName) {
      const sprite = new PIXI.Sprite(
        this.config.app.loader.resources[imageName].texture
      );
      sprite.id = id;
      sprite.position.set(0, this.lastMessageY + marginBetweenLines);
      this.lastMessageY += sprite.height + marginBetweenLines;
      this.scrollbox.content.addChild(sprite);

      this.messageLength = 50;
    } else if (allButtonText) {
      // Handle multiple buttons
      this.activeButtonsContainer = new PIXI.Container();
      this.scrollbox.content.addChild(this.activeButtonsContainer);

      const buttonTexts = allButtonText.split("|");
      for (let i = 0; i < buttonTexts.length; i++) {
        const buttonText = buttonTexts[i].trim();

        const buttonFg = new PIXI.Text(util.shortenString(buttonText, 50), {
          fontFamily: "Teko",
          fontSize: 34,
          fill: 0xffffff,
          letterSpacing: 0.3
        });

        const buttonBg = new PIXI.Graphics();
        buttonBg.beginFill(0x3fc2d5);
        buttonBg.drawRect(
          -buttonPadding,
          -buttonPadding,
          buttonFg.width + 2 * buttonPadding,
          buttonFg.height + 2 * buttonPadding
        );

        const button = new PIXI.Container();
        button.id = id;
        button.addChild(buttonBg);
        button.addChild(buttonFg);
        button.interactive = true;
        this._on(button, "pointerup", () => {
          this.config.fxMachine.play("click");
          this._replaceButton(id, messageText || buttonText);

          this.emit("clickedButton", this.currentDialog, i);
        });

        button.position.set(
          messageBoxWidth - (buttonFg.width + 2 * buttonPadding),
          this.lastMessageY +
            marginBetweenMessages +
            marginBetweenLines +
            i * (buttonFg.height + 2 * buttonPadding + marginBetweenMessages) +
            buttonPadding
        );
        this.activeButtonsContainer.addChild(button);
      }

      this.messageLength = 0; // Delay will come later, with buttonTextLength
    } else {
      // Handle very long words in messages
      const splitMessage = this._breakIntoLines(messageText);

      const textBox = new PIXI.Text(splitMessage, {
        fontFamily: "Teko",
        fontSize: 34,
        fill: 0xffffff,
        align: "left",
        wordWrap: true,
        wordWrapWidth: messageWidth,
        letterSpacing: 0.3
      });
      textBox.id = id;
      textBox.position.set(0, this.lastMessageY + marginBetweenLines);
      textBox.interactive = true;
      this._on(textBox, "pointerup", () => {
        const bounds = textBox.getBounds();
        this.config.clipBoard.appear({
          position: new PIXI.Point(
            bounds.x + bounds.width / 2,
            bounds.y + bounds.height / 2
          ),
          textToCopy: messageText
        });
      });
      this.scrollbox.content.addChild(textBox);

      this.lastMessageY += textBox.height + marginBetweenLines;

      this.messageLength = splitMessage.length;
    }

    this.scrollbox.refresh();

    this.buttonTextLength = 0;

    if (!this.container.visible) {
      this.emit("unreadInfo");
    }
  }

  _handleDialogEnd() {
    if (this.messagesToShow.length === 0) {
      this.completedDialogQueue.push(this.currentDialog.id);
      this.currentDialog = null;
    }
  }

  _breakIntoMessages(text) {
    return _.filter(text.split(/--/g));
  }

  _replaceButton(id, messageText) {
    this.scrollbox.content.removeChild(this.activeButtonsContainer);
    this.activeButtonsContainer = null;

    const textBox = new PIXI.Text(this._breakIntoLines(messageText), {
      fontFamily: "Teko",
      fontSize: 34,
      fill: 0x68f1ff,
      align: "right",
      wordWrap: true,
      wordWrapWidth: messageWidth,
      letterSpacing: 0.3
    });
    textBox.id = id;
    textBox.anchor.set(1, 0);
    textBox.position.set(
      messageBoxWidth,
      this.lastMessageY + marginBetweenMessages + marginBetweenLines
    );
    textBox.interactive = true;
    this._on(textBox, "pointerup", () => {
      const bounds = textBox.getBounds();
      this.config.clipBoard.appear({
        position: new PIXI.Point(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2
        ),
        textToCopy: messageText
      });
    });
    this.scrollbox.content.addChild(textBox);

    this.lastMessageY +=
      textBox.height + marginBetweenMessages + marginBetweenLines;

    this.scrollbox.refresh();

    this.buttonTextLength = messageText.length;
  }

  _breakIntoLines(str) {
    return str
      .trim()
      .split(" ")
      .flatMap(word =>
        word.length < 50
          ? word
          : _.chain(word)
              .chunk(50)
              .map(x => x.join(""))
              .value()
      )
      .join(" ");
  }
}
