import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as geom from "../booyah/src/geom.js";
import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";
import * as audio from "../booyah/src/audio.js";
import * as scroll from "../booyah/src/scroll.js";

import * as clipBoard from "./clipBoard.js";
import * as transaction from "./transactions.js";

/**
 * events:
 *  unreadInfo
 *  readAllInfo
 *  recordedTransaction (transactionData) - transaction entered the ledger
 */
export class Ledger extends entity.ParallelEntity {
  constructor(options = {}) {
    super();

    util.setupOptions(this, options, {
      memento: null,

      initialBalance: 0
    });
  }

  _setup() {
    const interfaceTexts = this.config.jsonAssets.interface;

    this.optTextBox = {
      fontFamily: "Teko",
      fontSize: 34,
      fill: 0xffffff,
      align: "center"
    };
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
      this.config.app.loader.resources["images/icoLedger.png"].texture
    );
    ico.scale.set(0.75);
    ico.position.set(130, 5);
    this.container.addChild(ico);

    const textIco = new PIXI.Text(interfaceTexts["ledger"].text.toUpperCase(), {
      fontFamily: "Teko Light",
      fontSize: 50,
      fill: 0xffffff,
      letterSpacing: 0.4
    });
    textIco.position.set(220, 55);
    this.container.addChild(textIco);

    this.bg = new PIXI.Sprite(
      this.config.app.loader.resources["images/bgLedger.png"].texture
    );
    this.container.addChild(this.bg);

    // records is an array of TransactionData or BlockData
    if (this.memento) this.records = this.memento;
    else this.records = [];

    this.columnPositions = {
      draper: 335,
      bluehat: 480,
      raven: 625,
      mudge: 770
    };

    this.countDraper = new PIXI.Text("0", this.optTextBox);
    this.countDraper.position.set(335, 450);
    this.countDraper.anchor.set(0.5);
    this.container.addChild(this.countDraper);

    this.countBluehat = new PIXI.Text("0", this.optTextBox);
    this.countBluehat.position.set(480, 450);
    this.countBluehat.anchor.set(0.5);
    this.container.addChild(this.countBluehat);

    this.countRaven = new PIXI.Text("0", this.optTextBox);
    this.countRaven.position.set(625, 450);
    this.countRaven.anchor.set(0.5);
    this.container.addChild(this.countRaven);

    this.countMudge = new PIXI.Text("0", this.optTextBox);
    this.countMudge.position.set(770, 450);
    this.countMudge.anchor.set(0.5);
    this.container.addChild(this.countMudge);

    this.scrollbox = new scroll.Scrollbox({
      boxHeight: 180,
      boxWidth: 800,
      overflowX: "none",
      overflowY: "scroll",
      scrollbarOffsetVertical: 130,
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
    this.scrollbox.container.position.set(0, 215);

    for (let i = 0; i < 4; i++) {
      let text3 = new PIXI.Text(this.initialBalance, this.optTextBox);
      text3.position.set(
        this.columnPositions[Object.keys(this.columnPositions)[i]],
        0
      );
      text3.anchor.set(0.5, 0);
      this.scrollbox.content.addChild(text3);
    }
    let text = new PIXI.Text(
      interfaceTexts["ledger-start"].text.toUpperCase(),
      {
        fontFamily: "Teko",
        fontSize: 30,
        fill: 0xb7f7ff,
        align: "center"
      }
    );
    text.position.set(190, 0);
    text.anchor.set(0.5, 0);
    this.scrollbox.content.addChild(text);

    let textSolde = new PIXI.Text(
      interfaceTexts["ledger-balance"].text.toUpperCase(),
      {
        fontFamily: "Teko",
        fontSize: 30,
        fill: 0xb7f7ff,
        align: "center"
      }
    );
    textSolde.position.set(190, 450);
    textSolde.anchor.set(0.5);
    this.container.addChild(textSolde);

    this._refresh();
  }

  _update(options) {}

  _teardown() {
    this.config.container.removeChild(this.container);
  }

  setVisible(isVisible) {
    this.container.visible = isVisible;

    if (isVisible) this.emit("readAllInfo");
  }

  addTransaction(transactionData) {
    this.records.push(transactionData);
    this._refresh();

    this.emit("recordedTransaction", transactionData);
    if (!this.container.isVisible) this.emit("unreadInfo");
  }

  addBlock(blockData) {
    this.records.push(blockData);
    this.records.push(...blockData.transactions);
    this._refresh();

    if (!this.container.isVisible) this.emit("unreadInfo");
  }

  _refresh() {
    this.balance = {
      draper: this.initialBalance,
      bluehat: this.initialBalance,
      raven: this.initialBalance,
      mudge: this.initialBalance
    };

    for (let i = 0; i < this.records.length; i++) {
      const record = this.records[i];

      if (record instanceof transaction.TransactionData) {
        // Show the transaction

        let text = new PIXI.Text(`-${record.amount}`, this.optTextBox);
        text.position.set(this.columnPositions[record.debit], 40 + i * 40);
        text.anchor.set(0.5, 0);
        this.scrollbox.content.addChild(text);
        this.balance[record.debit] -= record.amount;

        let text1 = new PIXI.Text(`+${record.amount}`, this.optTextBox);
        text1.position.set(this.columnPositions[record.credit], 40 + i * 40);
        text1.anchor.set(0.5, 0);
        this.scrollbox.content.addChild(text1);
        this.balance[record.credit] += record.amount;

        let text2 = new PIXI.Text(`T ${record.id}`, this.optTextBox);
        text2.position.set(190, 40 + i * 40);
        text2.anchor.set(0.5, 0);
        this.scrollbox.content.addChild(text2);
      } else {
        // Show the block

        let text1 = new PIXI.Text(`+${record.reward}`, this.optTextBox);
        text1.position.set(this.columnPositions[record.miner], 40 + i * 40);
        text1.anchor.set(0.5, 0);
        this.scrollbox.content.addChild(text1);
        this.balance[record.miner] += record.reward;

        let text2 = new PIXI.Text(
          `B ${record.hash.toString().padStart(4, "0")}`,
          this.optTextBox
        );
        text2.position.set(190, 40 + i * 40);
        text2.anchor.set(0.5, 0);
        this.scrollbox.content.addChild(text2);
      }
    }

    this.countDraper.text = this.balance["draper"];
    this.countBluehat.text = this.balance["bluehat"];
    this.countMudge.text = this.balance["mudge"];
    this.countRaven.text = this.balance["raven"];

    this.scrollbox.refresh();
  }

  makeMemento() {
    return this.records;
  }
}
