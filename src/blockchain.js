import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as geom from "../booyah/src/geom.js";
import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";
import * as audio from "../booyah/src/audio.js";
import * as scroll from "../booyah/src/scroll.js";

import * as responsive from "./responsive.js";
import * as clipBoard from "./clipBoard.js";
import * as rsa from "./rsa.js";
import * as autoscroll from "./autoscroll.js";

export class BlockData {
  constructor(options = {}) {
    util.setupOptions(this, options, {
      hash: null,
      previousBlockHash: null,
      transactions: null, // Array of TransactionData
      miner: null,
      nonce: null,
      reward: null
    });
  }

  calculateHash() {
    const blockText =
      this.miner +
      this.previousBlockHash +
      this.transactions.map(t => t.toString()).join(".") +
      this.nonce;
    return rsa.calculateHash(blockText);
  }

  recordTransactionsAsPartOfBlock() {
    for (const transaction of this.transactions) {
      transaction.blockStatus = "inBlock";
    }
  }

  areTransactionsValid() {
    for (const transaction of this.transactions) {
      if (transaction.calculateHash() !== transaction.hash) return false;
      if (transaction.calculateSignature() !== transaction.signature)
        return false;
    }

    return true;
  }
}

const buttonTextStyle = {
  fontFamily: "Teko",
  fontSize: 32,
  fill: 0xffffff
};

const labelTextStyle = {
  fontFamily: "Teko Light",
  fontSize: 30,
  fill: 0x4af0ff,
  wordWrap: true,
  wordWrapWidth: 100,
  align: "right"
};

const viewTextStyle = {
  fontFamily: "Teko Light",
  fontSize: 32,
  fill: 0xffffff,
  letterSpacing: 1
};

/**
 * events:
 
 *  readAllInfo
 *  createdBlock(block)
 *  addedBlock(block)
 *  createdIncorrectBlock(block)
 *  updatedHash(hash)
 */
export class Blockchain extends entity.ParallelEntity {
  constructor() {
    super();
  }

  _setup() {
    const interfaceTexts = this.config.jsonAssets.interface;

    this.blocks = [];
    this.transactionsToInclude = [];
    this.nonce = 0; // For the create block view

    this.container = new PIXI.Container();
    this.container.visible = false;
    this.config.container.addChild(this.container);

    this._makeListView();
    this._makeBlockView();
    this._makeCreateView();

    // Add common elements for all interfaces
    {
      const ico = new PIXI.Sprite(
        this.config.app.loader.resources["images/icoBlockchain.png"].texture
      );
      ico.scale.set(0.75);
      ico.position.set(130, 10);
      this.container.addChild(ico);

      const lineText = new PIXI.Sprite(
        this.config.app.loader.resources["images/lineText.png"].texture
      );
      lineText.position.set(130, 65);
      this.container.addChild(lineText);

      const textIco = new PIXI.Text(
        interfaceTexts["blockchain"].text.toUpperCase(),
        {
          fontFamily: "Teko Light",
          fontSize: 50,
          fill: 0xffffff,
          letterSpacing: 0.4
        }
      );
      textIco.position.set(220, 55);
      this.container.addChild(textIco);
    }

    // Start disabled
    this.canCreateBlock = false;

    this._on(
      this.config.octor.screens.transactions,
      "includedTransaction",
      this._updateTransactionsToInclude
    );
    this._on(
      this.config.octor.screens.transactions,
      "excludedTransaction",
      this._updateTransactionsToInclude
    );
  }

  _teardown() {
    this.config.container.removeChild(this.container);
    this.removeAllEntities();
  }

  setVisible(isVisible) {
    this.container.visible = isVisible;

    if (isVisible) this.emit("readAllInfo");
  }

  addBlock(blockData) {
    // Fill in missing fields if necessary
    if (blockData.previousBlockHash === null && this.blocks.length > 0) {
      blockData.previousBlockHash = _.last(this.blocks).hash;
    }
    if (blockData.reward === null) {
      blockData.reward = blockData.transactions.length;
    }
    if (blockData.nonce === null) {
      // Find valid nonce
      let foundNonce = false;
      while (!foundNonce) {
        blockData.nonce = Math.floor(geom.randomInRange(0, 9999));
        blockData.hash = blockData.calculateHash();
        foundNonce = blockData.hash < 1000;
      }
    }
    if (blockData.hash === null) {
      blockData.hash = blockData.calculateHash();
    }
    this.blocks.push(blockData);

    blockData.recordTransactionsAsPartOfBlock();
    this.config.octor.screens.transactions.discardWaitingTransactions();

    this._updateTransactionsToInclude();

    this._refreshList();

    // Go back to list screen
    if (!this.listView.visible) {
      this._switchView("list");
    }

    this.config.notifier.notify("blockchain-block-added");
    this.emit("addedBlock", blockData);

    return blockData;
  }

  _refreshList() {
    const vertical = 170 / 2 + 20;
    const horizontal = 194 / 2 + 20;

    this.blockContainer.removeChildren();

    _.each(this.blocks, (blockData, i) => {
      const sprite = new PIXI.Sprite(
        this.config.app.loader.resources["images/block.png"].texture
      );
      sprite.anchor.set(0.5);
      sprite.position.set(horizontal + 250 * i, vertical);
      sprite.interactive = true;
      this._on(sprite, "pointertap", () => this._onViewBlock(blockData));
      this.blockContainer.addChild(sprite);

      const text = new PIXI.Text(blockData.hash.toString().padStart(4, "0"), {
        fontFamily: "Teko Light",
        fontSize: 34,
        fill: 0x4aecff,
        letterSpacing: 4
      });
      text.anchor.set(0.5);
      text.position.set(horizontal + 250 * i - 30, vertical - 10);
      text.angle = -26.2;
      text.skew.set(geom.degreesToRadians(-10), 0);
      this.blockContainer.addChild(text);

      if (i < this.blocks.length - 1) {
        const arrowSprite = new PIXI.Sprite(
          this.config.app.loader.resources["images/triple-arrow.png"].texture
        );
        arrowSprite.anchor.set(0.5);
        arrowSprite.position.set(horizontal + 120 + 250 * i, vertical);
        arrowSprite.angle = 180;
        this.blockContainer.addChild(arrowSprite);
      }
    });

    this.listScroll.refresh();
  }

  _onCreateBlock() {
    this.config.fxMachine.play("click");

    this._updateTransactionsToInclude();

    if (this.blocks.length === 0) {
      this.blockCreatePreviousBlock.text = "-";
    } else {
      this.blockCreatePreviousBlock.text = _.last(this.blocks)
        .hash.toString()
        .padStart(4, "0");
    }

    this._switchView("create");
  }

  _onViewBlock(blockData) {
    console.log("view block", blockData);
    this.config.fxMachine.play("click");
    this.blockViewMiner.text = blockData.miner.toUpperCase();

    if (blockData.previousBlockHash) {
      this.blockViewPreviousBlock.text = blockData.previousBlockHash
        .toString()
        .padStart(4, "0");
    } else {
      this.blockViewPreviousBlock.text = "-";
    }

    this.blockViewTransactions.text = blockData.transactions
      .map(transactionData => `T${transactionData.id.toString()}`)
      .join(", ");
    this.blockViewNonce.text = blockData.nonce.toString();
    this.blockViewHash.text = blockData.hash.toString().padStart(4, "0");
    this.blockViewReward.text = blockData.reward.toString();

    this._switchView("block");
  }

  _switchView(name) {
    for (const viewName of ["list", "block", "create"]) {
      this[`${viewName}View`].visible = name === viewName;
    }
  }

  _makeListView() {
    const interfaceTexts = this.config.jsonAssets.interface;

    this.listView = new PIXI.Container();
    this.container.addChild(this.listView);

    const screenImage = this.config.isOnDesktop
      ? "images/screenNormal.png"
      : "images/screenTool.png";
    const screen = new PIXI.Sprite(
      this.config.app.loader.resources[screenImage].texture
    );
    this.listView.addChild(screen);

    this.listScroll = new scroll.Scrollbox({
      boxWidth: 675,
      boxHeight: 200,
      overflowX: "scroll",
      overflowY: "none",
      contentMarginX: 10,
      scrollbarOffsetHorizontal: 50,
      scrollbarSize: 30, // width in pixels
      scrollbarBackground: 0, // background color
      scrollbarBackgroundAlpha: 0.75,
      scrollbarForeground: 0x68f1ff, // foreground color
      scrollbarForegroundAlpha: 1
    });
    this.addEntity(
      this.listScroll,
      entity.extendConfig({ container: this.listView })
    );
    this.listScroll.container.position.set(140, 140);

    {
      const autoscrollEntity = new autoscroll.Autoscroll(this.listScroll);
      this.addEntity(
        autoscrollEntity,
        entity.extendConfig({ container: this.listView })
      );
    }

    this.blockContainer = new PIXI.Container();
    this.listScroll.content.addChild(this.blockContainer);

    this.createButton = new PIXI.Container();
    this.createButton.position.set(this.config.app.renderer.width / 2, 470);
    this._on(this.createButton, "pointertap", this._onCreateBlock, this);
    this.listView.addChild(this.createButton);

    const createButtonBg = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/button-left.png"
      ].texture
    );
    createButtonBg.anchor.set(0.5);
    this.createButton.addChild(createButtonBg);

    const createButtonText = new PIXI.Text(
      interfaceTexts["blockchain-mine"].text,
      buttonTextStyle
    );
    createButtonText.anchor.set(0.5);
    this.createButton.addChild(createButtonText);

    this._refreshList();
  }

  _makeBlockView() {
    const interfaceTexts = this.config.jsonAssets.interface;
    const lines = [170, 270, 370, 470];
    const columns = [197, 336, 580, 716];

    this.blockView = new PIXI.Container();
    this.blockView.visible = false;
    this.container.addChild(this.blockView);

    const screenImage = this.config.isOnDesktop
      ? "images/screenNormal.png"
      : "images/screenToolBack.png";
    const screen = new PIXI.Sprite(
      this.config.app.loader.resources[screenImage].texture
    );
    this.blockView.addChild(screen);

    const backButton = responsive.makeBackButton(this.config);
    this._on(backButton, "pointertap", () => {
      this.config.fxMachine.play("click");
      this._switchView("list");
    });
    this.blockView.addChild(backButton);

    // Miner text box
    {
      const minerLabel = new PIXI.Text(
        interfaceTexts["blockchain-miner"].text,
        labelTextStyle
      );
      minerLabel.anchor.set(1, 0.5);
      minerLabel.position.set(columns[0], lines[0]);
      this.blockView.addChild(minerLabel);

      const box = new PIXI.Sprite(
        this.config.app.loader.resources[
          "images/transaction/boxDebiteur.png"
        ].texture
      );
      box.anchor.set(0.5);
      box.position.set(columns[1], lines[0]);
      box.interactive = true;
      this._on(box, "pointertap", () => {
        this.config.fxMachine.play("click");

        this.config.clipBoard.appear({
          position: this.blockViewMiner.position,
          textToCopy: this.blockViewMiner.text
        });
      });
      this.blockView.addChild(box);

      this.blockViewMiner = new PIXI.Text("", viewTextStyle);
      this.blockViewMiner.anchor.set(0.5);
      this.blockViewMiner.position.set(columns[1], lines[0]);
      this.blockView.addChild(this.blockViewMiner);
    }

    // Previous block text box
    {
      const label = new PIXI.Text(
        interfaceTexts["blockchain-previous-block"].text,
        labelTextStyle
      );
      label.anchor.set(1, 0.5);
      label.position.set(columns[2], lines[0]);
      this.blockView.addChild(label);

      const box = new PIXI.Sprite(
        this.config.app.loader.resources[
          "images/transaction/boxHash.png"
        ].texture
      );
      box.anchor.set(0.5);
      box.position.set(columns[3], lines[0]);
      box.interactive = true;
      this._on(box, "pointertap", () => {
        this.config.fxMachine.play("click");

        this.config.clipBoard.appear({
          position: this.blockViewPreviousBlock.position,
          textToCopy: this.blockViewPreviousBlock.text
        });
      });
      this.blockView.addChild(box);

      this.blockViewPreviousBlock = new PIXI.Text("", viewTextStyle);
      this.blockViewPreviousBlock.anchor.set(0.5);
      this.blockViewPreviousBlock.position.set(columns[3], lines[0]);
      this.blockView.addChild(this.blockViewPreviousBlock);
    }

    // Transactions block
    {
      const label = new PIXI.Text(
        interfaceTexts["blockchain-transactions"].text,
        labelTextStyle
      );
      label.anchor.set(1, 0.5);
      label.position.set(columns[0], lines[1]);
      this.blockView.addChild(label);

      const box = new PIXI.Sprite(
        this.config.app.loader.resources["images/large-box.png"].texture
      );
      box.anchor.set(0.5);
      box.position.set(520, lines[1]);
      this.blockView.addChild(box);

      this.blockViewTransactions = new PIXI.Text("", viewTextStyle);
      this.blockViewTransactions.anchor.set(0.5);
      this.blockViewTransactions.position.set(520, lines[1]);
      this.blockView.addChild(this.blockViewTransactions);
    }

    // Nonce text box
    {
      const label = new PIXI.Text(
        interfaceTexts["blockchain-nonce"].text,
        labelTextStyle
      );
      label.anchor.set(1, 0.5);
      label.position.set(columns[0], lines[2]);
      this.blockView.addChild(label);

      const box = new PIXI.Sprite(
        this.config.app.loader.resources[
          "images/transaction/boxCredit.png"
        ].texture
      );
      box.anchor.set(0.5);
      box.position.set(columns[1], lines[2]);
      box.interactive = true;
      this._on(box, "pointertap", () => {
        this.config.fxMachine.play("click");

        this.config.clipBoard.appear({
          position: this.blockViewNonce.position,
          textToCopy: this.blockViewNonce.text
        });
      });
      this.blockView.addChild(box);

      this.blockViewNonce = new PIXI.Text("", viewTextStyle);
      this.blockViewNonce.anchor.set(0.5);
      this.blockViewNonce.position.set(columns[1], lines[2]);
      this.blockView.addChild(this.blockViewNonce);
    }

    // Hash
    {
      const label = new PIXI.Text(
        interfaceTexts["transactions-hash"].text,
        labelTextStyle
      );
      label.anchor.set(1, 0.5);
      label.position.set(columns[2], lines[2]);
      this.blockView.addChild(label);

      const box = new PIXI.Sprite(
        this.config.app.loader.resources[
          "images/transaction/boxHash.png"
        ].texture
      );
      box.anchor.set(0.5);
      box.position.set(columns[3], lines[2]);
      box.interactive = true;
      this._on(box, "pointertap", () => {
        this.config.fxMachine.play("click");

        this.config.clipBoard.appear({
          position: this.blockViewHash.position,
          textToCopy: this.blockViewHash.text
        });
      });
      this.blockView.addChild(box);

      this.blockViewHash = new PIXI.Text("", viewTextStyle);
      this.blockViewHash.anchor.set(0.5);
      this.blockViewHash.position.set(columns[3], lines[2]);
      this.blockView.addChild(this.blockViewHash);
    }

    // Reward text box
    {
      const label = new PIXI.Text(
        interfaceTexts["blockchain-reward"].text,
        labelTextStyle
      );
      label.anchor.set(1, 0.5);
      label.position.set(columns[2], lines[3]);
      this.blockView.addChild(label);

      const box = new PIXI.Sprite(
        this.config.app.loader.resources[
          "images/transaction/boxCredit.png"
        ].texture
      );
      box.anchor.set(0.5);
      box.position.set(columns[3], lines[3]);
      box.interactive = true;
      this._on(box, "pointertap", () => {
        this.config.fxMachine.play("click");

        this.config.clipBoard.appear({
          position: this.blockViewReward.position,
          textToCopy: this.blockViewReward.text
        });
      });
      this.blockView.addChild(box);

      this.blockViewReward = new PIXI.Text("", viewTextStyle);
      this.blockViewReward.anchor.set(0.5);
      this.blockViewReward.position.set(columns[3], lines[3]);
      this.blockView.addChild(this.blockViewReward);
    }
  }

  _makeCreateView() {
    const interfaceTexts = this.config.jsonAssets.interface;
    const lines = [170, 270, 370, 470];
    const columns = [197, 336, 580, 716];

    this.createView = new PIXI.Container();
    this.createView.visible = false;
    this.container.addChild(this.createView);

    const screenImage = this.config.isOnDesktop
      ? "images/screenNormal.png"
      : "images/screenToolBack.png";
    const screen = new PIXI.Sprite(
      this.config.app.loader.resources[screenImage].texture
    );
    this.createView.addChild(screen);

    const backButton = responsive.makeBackButton(this.config);
    this._on(backButton, "pointertap", () => {
      this.config.fxMachine.play("click");

      this._switchView("list");
    });
    this.createView.addChild(backButton);

    // Miner text box
    {
      const label = new PIXI.Text(
        interfaceTexts["blockchain-miner"].text,
        labelTextStyle
      );
      label.anchor.set(1, 0.5);
      label.position.set(columns[0], lines[0]);
      this.createView.addChild(label);

      const box = new PIXI.Sprite(
        this.config.app.loader.resources[
          "images/transaction/txtBox.png"
        ].texture
      );
      box.anchor.set(0.5);
      box.position.set(columns[1], lines[0]);
      box.interactive = true;
      this._on(box, "pointertap", () => {
        this.config.fxMachine.play("click");

        this.config.clipBoard.appear({
          position: this.blockCreateMiner.position,
          textToCopy: this.blockCreateMiner.text
        });
      });
      this.createView.addChild(box);

      this.blockCreateMiner = new PIXI.Text("DRAPER", viewTextStyle);
      this.blockCreateMiner.anchor.set(0.5);
      this.blockCreateMiner.position.set(columns[1], lines[0]);
      this.createView.addChild(this.blockCreateMiner);
    }

    // Previous block text box
    {
      const label = new PIXI.Text(
        interfaceTexts["blockchain-previous-block"].text,
        labelTextStyle
      );
      label.anchor.set(1, 0.5);
      label.position.set(columns[2], lines[0]);
      this.createView.addChild(label);

      const box = new PIXI.Sprite(
        this.config.app.loader.resources[
          "images/transaction/txtBox.png"
        ].texture
      );
      box.anchor.set(0.5);
      box.position.set(columns[3], lines[0]);
      box.interactive = true;
      this._on(box, "pointertap", () => {
        this.config.fxMachine.play("click");

        this.config.clipBoard.appear({
          position: this.blockCreatePreviousBlock.position,
          textToCopy: this.blockCreatePreviousBlock.text
        });
      });
      this.createView.addChild(box);

      this.blockCreatePreviousBlock = new PIXI.Text("", viewTextStyle);
      this.blockCreatePreviousBlock.anchor.set(0.5);
      this.blockCreatePreviousBlock.position.set(columns[3], lines[0]);
      this.createView.addChild(this.blockCreatePreviousBlock);
    }

    // Transactions block
    {
      const label = new PIXI.Text(
        interfaceTexts["blockchain-transactions"].text,
        labelTextStyle
      );
      label.anchor.set(1, 0.5);
      label.position.set(columns[0], lines[1]);
      this.createView.addChild(label);

      const box = new PIXI.Sprite(
        this.config.app.loader.resources["images/large-box.png"].texture
      );
      box.anchor.set(0.5);
      box.position.set(520, lines[1]);
      this.createView.addChild(box);

      this.blockCreateTransactions = new PIXI.Text("", viewTextStyle);
      this.blockCreateTransactions.anchor.set(0.5);
      this.blockCreateTransactions.position.set(520, lines[1]);
      this.createView.addChild(this.blockCreateTransactions);
    }

    // Nonce block
    {
      const label = new PIXI.Text(
        interfaceTexts["blockchain-nonce"].text,
        labelTextStyle
      );
      label.anchor.set(1, 0.5);
      label.position.set(columns[0], lines[2]);
      this.createView.addChild(label);

      const minusButton = new PIXI.Sprite(
        this.config.app.loader.resources["images/transaction/moins.png"].texture
      );
      minusButton.anchor.set(0.5);
      minusButton.position.set(columns[0] + 50, lines[2]);
      minusButton.interactive = true;
      this.createView.addChild(minusButton);

      this._on(minusButton, "pointertap", () => {
        if (this.nonce <= 0) return;

        this.config.fxMachine.play("click");
        this.nonce--;
        this.blockCreateNonce.text = this.nonce.toString();

        this._updateHash();
      });

      this.blockCreateNonce = new PIXI.Text(
        this.nonce.toString(),
        buttonTextStyle
      );
      this.blockCreateNonce.anchor.set(0.5);
      this.blockCreateNonce.position.set(columns[0] + 50 + 60, lines[2]);
      this.blockCreateNonce.interactive = true;
      this._on(this.blockCreateNonce, "pointertap", () => {
        this.config.fxMachine.play("click");

        this.config.clipBoard.appear({
          position: this.blockCreateNonce.position,
          textToCopy: this.blockCreateNonce.text
        });
      });
      this.createView.addChild(this.blockCreateNonce);

      const plusButton = new PIXI.Sprite(
        this.config.app.loader.resources["images/transaction/plus.png"].texture
      );
      plusButton.anchor.set(0.5);
      plusButton.position.set(columns[0] + 50 + 120, lines[2]);
      plusButton.interactive = true;
      this.createView.addChild(plusButton);

      this._on(plusButton, "pointertap", () => {
        this.config.fxMachine.play("click");
        this.nonce++;
        this.blockCreateNonce.text = this.nonce.toString();

        this._updateHash();
      });
    }

    // Hash
    {
      const label = new PIXI.Text(
        interfaceTexts["transactions-hash"].text,
        labelTextStyle
      );
      label.anchor.set(1, 0.5);
      label.position.set(columns[2], lines[2]);
      this.createView.addChild(label);

      const box = new PIXI.Sprite(
        this.config.app.loader.resources[
          "images/transaction/txtBox.png"
        ].texture
      );
      box.anchor.set(0.5);
      box.position.set(columns[3], lines[2]);
      box.interactive = true;
      this._on(box, "pointertap", () => {
        this.config.fxMachine.play("click");

        this.config.clipBoard.appear({
          position: this.blockCreateHash.position,
          textToCopy: this.blockCreateHash.text
        });
      });
      this.createView.addChild(box);

      this.blockCreateHash = new PIXI.Text("", viewTextStyle);
      this.blockCreateHash.anchor.set(0.5);
      this.blockCreateHash.position.set(columns[3], lines[2]);
      this.createView.addChild(this.blockCreateHash);
    }

    // Create button
    {
      const createButton = new PIXI.Sprite(
        this.config.app.loader.resources[
          "images/transaction/button-left.png"
        ].texture
      );
      createButton.anchor.set(0.5);
      createButton.position.set(this.config.app.renderer.width / 2, 470);
      createButton.interactive = true;
      this._on(createButton, "pointertap", this._onCreateBlockDone);
      this.createView.addChild(createButton);

      const createButtonText = new PIXI.Text(
        interfaceTexts["blockchain-create"].text,
        buttonTextStyle
      );
      createButtonText.anchor.set(0.5);
      createButtonText.position.set(this.config.app.renderer.width / 2, 470);
      this.createView.addChild(createButtonText);
    }
  }

  _updateHash() {
    const blockText =
      this.blockCreateMiner.text +
      this.blockCreatePreviousBlock.text +
      this.transactionsToInclude.map(t => t.toString()).join(".") +
      this.blockCreateNonce.text;
    const hash = rsa.calculateHash(blockText);
    this.blockCreateHash.text = hash.toString();

    if (hash < 1000) {
      this.blockCreateHash.style.fill = 0xadfc3b;
    } else {
      this.blockCreateHash.style.fill = 0xfc5f3b;
    }

    this.emit("updatedHash", hash);
  }

  _onCreateBlockDone() {
    if (
      _.size(this.blocks) > 0 &&
      this.blockCreatePreviousBlock.text.length === 0
    ) {
      this.config.notifier.notify("blockchain-error-previous-block-missing");
      return;
    }
    if (
      _.size(this.blocks) > 0 &&
      parseInt(this.blockCreatePreviousBlock.text) !==
        parseInt(_.last(this.blocks).hash)
    ) {
      this.config.notifier.notify("blockchain-error-previous-block-incorrect");
      return;
    }
    if (this.transactionsToInclude.length === 0) {
      this.config.notifier.notify("blockchain-error-transactions-missing");
      return;
    }
    if (parseInt(this.blockCreateHash.text) >= 1000) {
      this.config.notifier.notify("blockchain-error-hash-incorrect");
      return;
    }

    const newBlock = new BlockData({
      hash: parseInt(this.blockCreateHash.text),
      previousBlockHash:
        (this.blocks && parseInt(this.blockCreatePreviousBlock.text)) || 0,
      transactions: this.transactionsToInclude,
      miner: "draper",
      nonce: this.nonce,
      reward: this.transactionsToInclude.length
    });

    if (!newBlock.areTransactionsValid()) {
      // Reset transactions
      for (const transaction of this.transactionsToInclude) {
        transaction.blockStatus = "waiting";
      }

      this._refreshList();
      this._updateTransactionsToInclude();
      this._switchView("list");

      this.config.notifier.notify("blockchain-block-transaction-incorrect");

      this.emit("createdIncorrectBlock", newBlock);
    } else {
      this.blocks.push(newBlock);

      newBlock.recordTransactionsAsPartOfBlock();
      this.config.octor.screens.transactions.discardWaitingTransactions();

      this._refreshList();
      this._updateTransactionsToInclude();
      this._switchView("list");

      this.config.notifier.notify("blockchain-block-created");

      this.emit("createdBlock", newBlock);
    }
  }

  _updateTransactionsToInclude() {
    this.transactionsToInclude = _.filter(
      this.config.octor.screens.transactions.transactionDataList,
      { blockStatus: "included" }
    );

    if (_.isEmpty(this.transactionsToInclude)) {
      const interfaceTexts = this.config.jsonAssets.interface;
      this.blockCreateTransactions.style.fill = 0xfc5f3b; // Red
      this.blockCreateTransactions.text =
        interfaceTexts["blockchain-no-transactions"].text;
    } else {
      this.blockCreateTransactions.style.fill = 0xffffff;
      this.blockCreateTransactions.text = this.transactionsToInclude
        .map(transaction => `T${transaction.id.toString()}`)
        .join(", ");
    }
    this._updateHash();
  }

  get canCreateBlock() {
    return this.createButton.interactive;
  }
  set canCreateBlock(value) {
    this.createButton.interactive = value;
    this.createButton.alpha = value ? 1 : 0.5;

    // Don't get stuck in the new block screen
    if (!value && this.createView.visible) {
      this._switchView("list");
    }
  }
}
