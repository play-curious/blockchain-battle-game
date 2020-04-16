import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as geom from "../booyah/src/geom.js";
import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";
import * as audio from "../booyah/src/audio.js";
import * as scroll from "../booyah/src/scroll.js";

import * as clipBoard from "./clipBoard.js";
import * as rsa from "./rsa.js";
import * as network from "./network.js";
import * as responsive from "./responsive.js";
import * as autoscroll from "./autoscroll.js";

const marginBetweenTransactions = 60;
const buttonPadding = 10;
const buttonHeight = 30;
const labelTextOptions = {
  fontFamily: "Teko Light",
  fontSize: 30,
  fill: 0x4af0ff
};
const transactionColors = {
  waiting: 0x5ac7d5,
  accepted: 0xadfc3b,
  rejected: 0xfc5f3b,
  included: 0xadfc3b,
  excluded: 0xfc5f3
};

/**
 * events:
 *  createdTransaction
 *  acceptedTransaction
 *  rejectedTransaction
 *  judgedTransaction - Params are (transaction, didAccept)
 *  addedTransaction
 *  switchedScreen - screen ("list", "view", or "new")
 *  changedCredit
 *  copiedNewTransaction
 *  pastedNewHash(hash)
 *  includedTransaction
 *  excludedTransaction
 *  changedNewTransaction(text)
 */
export class Transactions extends entity.ParallelEntity {
  constructor(options = {}) {
    super();

    util.setupOptions(this, options, {
      memento: null,

      showHash: false,
      verifyHash: false, // When viewing transactions, is the hash verified automatically?
      showSignature: false,
      verifySignature: false, // When viewing transactions, is the signature verified automatically?
      linkToBlockchain: false
    });
  }

  _setup() {
    const interfaceTexts = this.config.jsonAssets.interface;

    const buttonTextStyle = {
      fontFamily: "Teko",
      fontSize: 32,
      fill: 0xffffff
    };

    // For transaction list
    if (this.memento) this.transactionDataList = this.memento;
    else this.transactionDataList = [];

    // For new transaction
    this.crediteur = "";
    this.debiteur = "";
    this.amount = 1;

    // For viewing transaction
    this.viewingTransaction = null;

    this.container = new PIXI.Container();
    this.container.visible = false;
    this.config.container.addChild(this.container);

    this.containerRecap = new PIXI.Container();
    this.container.addChild(this.containerRecap);

    const screenImage = this.config.isOnDesktop
      ? "images/screenScroll.png"
      : "images/screenToolScroll.png";
    this.containerRecap.addChild(
      new PIXI.Sprite(this.config.app.loader.resources[screenImage].texture)
    );

    // The container background, temporarily disabled

    // const recap = new PIXI.Sprite(
    //   this.config.app.loader.resources["images/transaction/recap.png"].texture
    // );
    // this.containerRecap.addChild(recap);

    {
      const initials = ["D", "M", "R", "B"];
      for (let i = 0; i < 4; i++) {
        const text = new PIXI.Text(initials[i], {
          fontFamily: "Teko Light",
          fontSize: 30,
          fill: 0xffffff
        });
        text.position.set(200 + 50 * i, 140);
        text.anchor.set(0.5);
        this.containerRecap.addChild(text);
      }
    }

    this.scrollbox = new scroll.Scrollbox({
      boxWidth: 760,
      boxHeight: 240,
      overflowX: "none",
      overflowY: "scroll",
      scrollbarOffsetVertical: 70,
      scrollbarSize: 30, // width in pixels
      scrollbarBackground: 0, // background color
      scrollbarBackgroundAlpha: 0.25,
      scrollbarForeground: 0x68f1ff, // foreground color
      scrollbarForegroundAlpha: 1
    });
    this.addEntity(
      this.scrollbox,
      entity.extendConfig({ container: this.containerRecap })
    );
    this.scrollbox.container.position.set(100, 170);

    {
      const autoscrollEntity = new autoscroll.Autoscroll(this.scrollbox);
      this.addEntity(
        autoscrollEntity,
        entity.extendConfig({ container: this.containerRecap })
      );
    }

    this.transactionListContainer = new PIXI.Container();
    this.transactionListContainer.position.set(0, 10);
    this.scrollbox.content.addChild(this.transactionListContainer);
    this._refreshList();

    this.containerNew = new PIXI.Container();
    this.containerNew.visible = false;
    this.container.addChild(this.containerNew);

    {
      const screenImage = this.config.isOnDesktop
        ? "images/screenNormal.png"
        : "images/screenToolBack.png";
      this.containerNew.addChild(
        new PIXI.Sprite(this.config.app.loader.resources[screenImage].texture)
      );
    }

    this.containerView = new PIXI.Container();
    this.containerView.visible = false;
    this.container.addChild(this.containerView);

    {
      const screenImage = this.config.isOnDesktop
        ? "images/screenNormal.png"
        : "images/screenToolBack.png";
      this.containerView.addChild(
        new PIXI.Sprite(this.config.app.loader.resources[screenImage].texture)
      );
    }

    /* #region  New Transaction */

    // Create transaction labels
    {
      const debitLabel = new PIXI.Text(
        interfaceTexts["transactions-debit"].text,
        labelTextOptions
      );
      debitLabel.anchor.set(1, 0);
      debitLabel.position.set(157, 235);
      this.containerNew.addChild(debitLabel);

      const creditLabel = new PIXI.Text(
        interfaceTexts["transactions-credit"].text,
        labelTextOptions
      );
      creditLabel.anchor.set(1, 0);
      creditLabel.position.set(530, 235);
      this.containerNew.addChild(creditLabel);

      const amountLabel = new PIXI.Text(
        interfaceTexts["transactions-amount"].text,
        labelTextOptions
      );
      amountLabel.anchor.set(1, 0);
      amountLabel.position.set(157, 310);
      this.containerNew.addChild(amountLabel);
    }

    // Do _not_ set the new transaction button to interactive by default
    this.btnNewContainer = new PIXI.Container();
    this.btnNewContainer.position.set(this.config.app.renderer.width / 2, 470);
    this._on(this.btnNewContainer, "pointertap", () => {
      this.config.fxMachine.play("click");
      this._showNewTransaction();
    });
    this.containerRecap.addChild(this.btnNewContainer);

    const btnNew = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/button-left.png"
      ].texture
    );
    btnNew.anchor.set(0.5);
    this.btnNewContainer.addChild(btnNew);

    const btnNewText = new PIXI.Text(
      interfaceTexts["transactions-new"].text,
      buttonTextStyle
    );
    btnNewText.anchor.set(0.5);
    this.btnNewContainer.addChild(btnNewText);

    this.canCreateTransaction = false;

    const idTransacNew = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/idTransaction.png"
      ].texture
    );
    idTransacNew.anchor.set(0.5);
    idTransacNew.position.set(481, 165);
    idTransacNew.interactive = true;
    this.containerNew.addChild(idTransacNew);

    this._on(idTransacNew, "pointertap", () => {
      this.config.clipBoard.appear({
        position: this.txtIdNew.position,
        textToCopy: this.txtIdNew.text
      });

      this.emit("copiedNewTransaction", this.txtIdNew.text);
    });

    const idTransacView = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/idTransaction.png"
      ].texture
    );
    idTransacView.anchor.set(0.5);
    idTransacView.position.set(481, 165);
    idTransacView.interactive = true;
    this._on(idTransacView, "pointertap", () => {
      this.config.clipBoard.appear({
        position: this.txtIdView.position,
        textToCopy: this.txtIdView.text
      });
    });
    this.containerView.addChild(idTransacView);

    this.btnDraper = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/btnTransac.png"
      ].texture
    );
    this.btnDraper.anchor.set(0.5);
    this.btnDraper.position.set(199, 245);
    this.btnDraper.interactive = true;
    this.containerNew.addChild(this.btnDraper);

    this._on(this.btnDraper, "pointertap", () => {
      this.config.fxMachine.play("click");
      this._onTap("draper", false);
    });

    this.btnBlueHat = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/btnTransac.png"
      ].texture
    );
    this.btnBlueHat.anchor.set(0.5);
    this.btnBlueHat.position.set(199 + 68, 245);
    this.btnBlueHat.interactive = true;
    this.containerNew.addChild(this.btnBlueHat);

    this._on(this.btnBlueHat, "pointertap", () => {
      this.config.fxMachine.play("click");
      this._onTap("bluehat", false);
    });

    this.btnMudge = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/btnTransac.png"
      ].texture
    );
    this.btnMudge.anchor.set(0.5);
    this.btnMudge.position.set(199 + 2 * 68, 245);
    this.btnMudge.interactive = true;
    this.containerNew.addChild(this.btnMudge);

    this._on(this.btnMudge, "pointertap", () => {
      this.config.fxMachine.play("click");
      this._onTap("mudge", false);
    });

    this.btnRaven = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/btnTransac.png"
      ].texture
    );
    this.btnRaven.anchor.set(0.5);
    this.btnRaven.position.set(199 + 3 * 68, 245);
    this.btnRaven.interactive = true;
    this.containerNew.addChild(this.btnRaven);

    this._on(this.btnRaven, "pointertap", () => {
      this.config.fxMachine.play("click");
      this._onTap("raven", false);
    });

    this.arrayDebiter = {
      draper: this.btnDraper,
      bluehat: this.btnBlueHat,
      mudge: this.btnMudge,
      raven: this.btnRaven
    };

    this.btnDraperC = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/btnTransac.png"
      ].texture
    );
    this.btnDraperC.anchor.set(0.5);
    this.btnDraperC.position.set(368 + 199, 245);
    this.btnDraperC.interactive = true;
    this.containerNew.addChild(this.btnDraperC);

    this._on(this.btnDraperC, "pointertap", () => {
      this.config.fxMachine.play("click");
      this._onTap("draper", true);
    });

    this.btnBlueHatC = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/btnTransac.png"
      ].texture
    );
    this.btnBlueHatC.anchor.set(0.5);
    this.btnBlueHatC.position.set(368 + 199 + 68, 245);
    this.btnBlueHatC.interactive = true;
    this.containerNew.addChild(this.btnBlueHatC);

    this._on(this.btnBlueHatC, "pointertap", () => {
      this.config.fxMachine.play("click");
      this._onTap("bluehat", true);
    });

    this.btnMudgeC = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/btnTransac.png"
      ].texture
    );
    this.btnMudgeC.anchor.set(0.5);
    this.btnMudgeC.position.set(368 + 199 + 2 * 68, 245);
    this.btnMudgeC.interactive = true;
    this.containerNew.addChild(this.btnMudgeC);

    this._on(this.btnMudgeC, "pointertap", () => {
      this.config.fxMachine.play("click");
      this._onTap("mudge", true);
    });

    this.btnRavenC = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/btnTransac.png"
      ].texture
    );
    this.btnRavenC.anchor.set(0.5);
    this.btnRavenC.position.set(368 + 199 + 3 * 68, 245);
    this.btnRavenC.interactive = true;
    this.containerNew.addChild(this.btnRavenC);

    this._on(this.btnRavenC, "pointertap", () => {
      this.config.fxMachine.play("click");
      this._onTap("raven", true);
    });

    this.arrayCrediter = {
      draper: this.btnDraperC,
      bluehat: this.btnBlueHatC,
      mudge: this.btnMudgeC,
      raven: this.btnRavenC
    };

    const optionsTxt = {
      fontFamily: "Teko",
      fontSize: 34,
      fill: 0xffffff
    };

    const txtDraper = new PIXI.Text("D", optionsTxt);
    txtDraper.anchor.set(0.5);
    txtDraper.position.set(199, 245);
    this.containerNew.addChild(txtDraper);
    const txtDraperC = new PIXI.Text("D", optionsTxt);
    txtDraperC.anchor.set(0.5);
    txtDraperC.position.set(368 + 199, 245);
    this.containerNew.addChild(txtDraperC);

    const txtBlueHat = new PIXI.Text("B", optionsTxt);
    txtBlueHat.anchor.set(0.5);
    txtBlueHat.position.set(199 + 68, 245);
    this.containerNew.addChild(txtBlueHat);
    const txtBlueHatC = new PIXI.Text("B", optionsTxt);
    txtBlueHatC.anchor.set(0.5);
    txtBlueHatC.position.set(368 + 199 + 68, 245);
    this.containerNew.addChild(txtBlueHatC);

    const txtMudge = new PIXI.Text("M", optionsTxt);
    txtMudge.anchor.set(0.5);
    txtMudge.position.set(199 + 2 * 68, 245);
    this.containerNew.addChild(txtMudge);
    const txtMudgeC = new PIXI.Text("M", optionsTxt);
    txtMudgeC.anchor.set(0.5);
    txtMudgeC.position.set(368 + 199 + 2 * 68, 245);
    this.containerNew.addChild(txtMudgeC);

    const txtRaven = new PIXI.Text("R", optionsTxt);
    txtRaven.anchor.set(0.5);
    txtRaven.position.set(199 + 3 * 68, 245);
    this.containerNew.addChild(txtRaven);
    const txtRavenC = new PIXI.Text("R", optionsTxt);
    txtRavenC.anchor.set(0.5);
    txtRavenC.position.set(368 + 199 + 3 * 68, 245);
    this.containerNew.addChild(txtRavenC);

    this.txtIdNew = new PIXI.Text("draper / draper", optionsTxt);
    this.txtIdNew.anchor.set(0.5);
    this.txtIdNew.position.set(481, 165);
    this.txtIdNew.hitArea = new PIXI.Rectangle();
    this.containerNew.addChild(this.txtIdNew);

    this.txtAmount = new PIXI.Text(this.amount, optionsTxt);
    this.txtAmount.anchor.set(0.5);
    this.txtAmount.position.set(199 + 68, 323);
    this.containerNew.addChild(this.txtAmount);

    const bntPlus = new PIXI.Sprite(
      this.config.app.loader.resources["images/transaction/plus.png"].texture
    );
    bntPlus.anchor.set(0.5);
    bntPlus.position.set(330, 323);
    bntPlus.interactive = true;
    this.containerNew.addChild(bntPlus);

    this._on(bntPlus, "pointertap", () => {
      this.config.fxMachine.play("click");
      this.amount++;
      this.txtAmount.text = this.amount.toString();
      this._refreshNewTransaction();
    });

    const btnMoins = new PIXI.Sprite(
      this.config.app.loader.resources["images/transaction/moins.png"].texture
    );
    btnMoins.anchor.set(0.5);
    btnMoins.position.set(200, 323);
    btnMoins.interactive = true;
    this.containerNew.addChild(btnMoins);

    this._on(btnMoins, "pointertap", () => {
      if (this.amount > 0) {
        this.config.fxMachine.play("click");
        this.amount--;
        this.txtAmount.text = this.amount.toString();
        this._refreshNewTransaction();
      }
    });

    if (this.showHash) {
      this.txtHash = new PIXI.Text("", optionsTxt);
      this.txtHash.anchor.set(0.5);
      this.txtHash.position.set(297, 402);
      this.containerNew.addChild(this.txtHash);

      const hashLabel = new PIXI.Text(
        interfaceTexts["transactions-hash"].text,
        labelTextOptions
      );
      hashLabel.anchor.set(1, 0.5);
      hashLabel.position.set(157, 402);
      this.containerNew.addChild(hashLabel);
    }

    if (this.showSignature) {
      this.txtSign = new PIXI.Text("", optionsTxt);
      this.txtSign.anchor.set(0.5);
      this.txtSign.position.set(665, 402);
      this.containerNew.addChild(this.txtSign);
    }

    if (this.showHash) {
      const boxHash = new PIXI.Sprite(
        this.config.app.loader.resources[
          "images/transaction/txtBox.png"
        ].texture
      );
      boxHash.anchor.set(0.5);
      boxHash.position.set(297, 402);
      boxHash.interactive = true;
      this.containerNew.addChild(boxHash);

      this._on(boxHash, "pointertap", () => {
        this.config.clipBoard.appear({
          position: this.txtHash.position,
          textToCopy: this.txtHash.text,
          onPaste: pasted => {
            if (!pasted.match(/^[0-9]{4}$/)) {
              this.config.notifier.notify("transaction-error-hash-length");
              return;
            }

            this.newTransactionSignature = pasted;
            this.txtHash.text = pasted;

            this.emit("pastedNewHash", this.txtHash.text);
          }
        });
      });
    }

    if (this.showSignature) {
      const boxSign = new PIXI.Sprite(
        this.config.app.loader.resources[
          "images/transaction/txtBox.png"
        ].texture
      );
      boxSign.anchor.set(0.5);
      boxSign.position.set(665, 402);
      boxSign.interactive = true;
      this.containerNew.addChild(boxSign);

      this._on(boxSign, "pointertap", () => {
        this.config.clipBoard.appear({
          position: this.txtSign.position,
          textToCopy: this.txtSign.text,
          onPaste: pasted => {
            if (!pasted.match(/^[0-9]{12}$/)) {
              this.config.notifier.notify("transaction-error-signature-format");
              return;
            }

            this.txtSign.text = pasted;
          }
        });
      });

      const signatureLabel = new PIXI.Text(
        interfaceTexts["transactions-signature"].text,
        labelTextOptions
      );
      signatureLabel.anchor.set(1, 0.5);
      signatureLabel.position.set(530, 402);
      this.containerNew.addChild(signatureLabel);
    }

    const btnCreer = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/button-left.png"
      ].texture
    );
    btnCreer.anchor.set(0.5);
    btnCreer.position.set(this.config.app.renderer.width / 2, 470);
    btnCreer.interactive = true;
    this.containerNew.addChild(btnCreer);

    const btnCreateText = new PIXI.Text(
      interfaceTexts["transactions-create"].text,
      buttonTextStyle
    );
    btnCreateText.anchor.set(0.5);
    btnCreateText.position.set(this.config.app.renderer.width / 2, 470);
    this.containerNew.addChild(btnCreateText);

    this._on(btnCreer, "pointertap", this._onCreateTransaction, this);

    {
      const btnBack = responsive.makeBackButton(this.config);
      this._on(btnBack, "pointertap", () => {
        this.config.fxMachine.play("click");

        this._showTransactionList();
      });
      this.containerNew.addChild(btnBack);
    }

    /* #endregion */

    /* #region  résumé de la transaction */

    this.txtIdView = new PIXI.Text("", optionsTxt);
    this.txtIdView.visible = false;
    this.txtIdView.anchor.set(0.5);
    this.txtIdView.position.set(481, 165);
    this.containerView.addChild(this.txtIdView);

    const optionsTxtView = {
      fontFamily: "Teko",
      fontSize: 30,
      fill: 0xffffff
    };

    const debitLabel = new PIXI.Text(
      interfaceTexts["transactions-debit"].text,
      labelTextOptions
    );
    debitLabel.anchor.set(1, 0);
    debitLabel.position.set(157, 227);
    this.containerView.addChild(debitLabel);

    const boxDebiteur = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/boxDebiteur.png"
      ].texture
    );
    boxDebiteur.anchor.set(0.5);
    boxDebiteur.position.set(296, 241);
    this.containerView.addChild(boxDebiteur);

    const creditLabel = new PIXI.Text(
      interfaceTexts["transactions-credit"].text,
      labelTextOptions
    );
    creditLabel.anchor.set(1, 0);
    creditLabel.position.set(530, 227);
    this.containerView.addChild(creditLabel);

    const boxCrediteur = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/boxDebiteur.png"
      ].texture
    );
    boxCrediteur.anchor.set(0.5);
    boxCrediteur.position.set(666, 241);
    this.containerView.addChild(boxCrediteur);

    this.txtDebiteur2 = new PIXI.Text(this.debiteur, optionsTxtView);
    this.txtDebiteur2.anchor.set(0.5);
    this.txtDebiteur2.position.set(296, 241);
    this.containerView.addChild(this.txtDebiteur2);

    this.txtCrediteur2 = new PIXI.Text(this.crediteur, optionsTxtView);
    this.txtCrediteur2.anchor.set(0.5);
    this.txtCrediteur2.position.set(666, 241);
    this.containerView.addChild(this.txtCrediteur2);

    if (this.showHash) {
      const boxHashView = new PIXI.Sprite(
        this.config.app.loader.resources[
          "images/transaction/boxHash.png"
        ].texture
      );
      boxHashView.anchor.set(0.5);
      boxHashView.position.set(297, 426);
      boxHashView.interactive = true;
      this.containerView.addChild(boxHashView);

      this.txtHashView = new PIXI.Text(this.txtHash.text, optionsTxtView);
      this.txtHashView.anchor.set(0.5);
      this.txtHashView.position.set(297, 426);
      this.containerView.addChild(this.txtHashView);

      this._on(boxHashView, "pointertap", () => {
        this.config.clipBoard.appear({
          position: this.txtHashView.position,
          textToCopy: this.txtHashView.text
        });
      });

      const hashLabel = new PIXI.Text(
        interfaceTexts["transactions-hash"].text,
        labelTextOptions
      );
      hashLabel.anchor.set(1, 0.5);
      hashLabel.position.set(157, 428);
      this.containerView.addChild(hashLabel);
    }

    if (this.showSignature) {
      const boxSignView = new PIXI.Sprite(
        this.config.app.loader.resources[
          "images/transaction/boxHash.png"
        ].texture
      );
      boxSignView.anchor.set(0.5);
      boxSignView.position.set(663, 426);
      boxSignView.interactive = true;
      this.containerView.addChild(boxSignView);

      this.txtSignView = new PIXI.Text(this.txtSign.text, optionsTxtView);
      this.txtSignView.anchor.set(0.5);
      this.txtSignView.position.set(663, 426);
      this.containerView.addChild(this.txtSignView);

      this._on(boxSignView, "pointertap", () => {
        this.config.clipBoard.appear({
          position: this.txtSignView.position,
          textToCopy: this.txtSignView.text
        });
      });

      const signatureLabel = new PIXI.Text(
        interfaceTexts["transactions-signature"].text,
        labelTextOptions
      );
      signatureLabel.anchor.set(1, 0.5);
      signatureLabel.position.set(530, 428);
      this.containerView.addChild(signatureLabel);
    }

    const amountLabel = new PIXI.Text(
      interfaceTexts["transactions-amount"].text,
      labelTextOptions
    );
    amountLabel.anchor.set(1, 0);
    amountLabel.position.set(157, 328);
    this.containerView.addChild(amountLabel);

    const boxCredit = new PIXI.Sprite(
      this.config.app.loader.resources[
        "images/transaction/boxCredit.png"
      ].texture
    );
    boxCredit.anchor.set(0.5);
    boxCredit.position.set(308, 336);
    this.containerView.addChild(boxCredit);

    this.txtMontant = new PIXI.Text(this.amount, optionsTxtView);
    this.txtMontant.anchor.set(0.5);
    this.txtMontant.position.set(283, 336);
    this.containerView.addChild(this.txtMontant);

    if (this.linkToBlockchain) {
      {
        this.includeButton = new PIXI.Container();
        this.includeButton.position.set(368, 486);
        this.containerView.addChild(this.includeButton);

        const btnInclude = new PIXI.Sprite(
          this.config.app.loader.resources[
            "images/transaction/button-left.png"
          ].texture
        );
        btnInclude.anchor.set(0.5);
        btnInclude.interactive = true;
        this._on(btnInclude, "pointerup", () => {
          this.config.fxMachine.play("click");

          this._includeTransation();
        });
        this.includeButton.addChild(btnInclude);

        const btnAcceptText = new PIXI.Text(
          interfaceTexts["transactions-include"].text,
          buttonTextStyle
        );
        btnAcceptText.anchor.set(0.5);
        this.includeButton.addChild(btnAcceptText);
      }

      {
        this.excludeButton = new PIXI.Container();
        this.excludeButton.position.set(590, 486);
        this.containerView.addChild(this.excludeButton);

        const btnReject = new PIXI.Sprite(
          this.config.app.loader.resources[
            "images/transaction/button-right.png"
          ].texture
        );
        btnReject.anchor.set(0.5);
        btnReject.interactive = true;
        this._on(btnReject, "pointertap", () => {
          this.config.fxMachine.play("click");

          this._excludeTransation();
        });
        this.excludeButton.addChild(btnReject);

        const btnRejectText = new PIXI.Text(
          interfaceTexts["transactions-exclude"].text,
          buttonTextStyle
        );
        btnRejectText.anchor.set(0.5);
        this.excludeButton.addChild(btnRejectText);
      }
    } else {
      {
        this.acceptButton = new PIXI.Container();
        this.acceptButton.position.set(368, 486);
        this.containerView.addChild(this.acceptButton);

        const btnAccept = new PIXI.Sprite(
          this.config.app.loader.resources[
            "images/transaction/button-left.png"
          ].texture
        );
        btnAccept.anchor.set(0.5);
        btnAccept.interactive = true;
        this._on(btnAccept, "pointerup", () => {
          this.config.fxMachine.play("click");

          this._acceptTransation();
        });
        this.acceptButton.addChild(btnAccept);

        const btnAcceptText = new PIXI.Text(
          interfaceTexts["transactions-accept"].text,
          buttonTextStyle
        );
        btnAcceptText.anchor.set(0.5);
        this.acceptButton.addChild(btnAcceptText);
      }

      {
        this.rejectButton = new PIXI.Container();
        this.rejectButton.position.set(590, 486);
        this.containerView.addChild(this.rejectButton);

        const btnReject = new PIXI.Sprite(
          this.config.app.loader.resources[
            "images/transaction/button-right.png"
          ].texture
        );
        btnReject.anchor.set(0.5);
        btnReject.interactive = true;
        this._on(btnReject, "pointertap", () => {
          this.config.fxMachine.play("click");

          this._rejectTransation();
        });
        this.rejectButton.addChild(btnReject);

        const btnRejectText = new PIXI.Text(
          interfaceTexts["transactions-reject"].text,
          buttonTextStyle
        );
        btnRejectText.anchor.set(0.5);
        this.rejectButton.addChild(btnRejectText);
      }
    }

    {
      const btnBack = responsive.makeBackButton(this.config);
      this._on(btnBack, "pointertap", () => {
        this.config.fxMachine.play("click");

        this._showTransactionList();
      });
      this.containerView.addChild(btnBack);
    }

    /* #endregion */

    // Add elements that are common to all transactions interfaces
    {
      const lineText = new PIXI.Sprite(
        this.config.app.loader.resources["images/lineText.png"].texture
      );
      lineText.position.set(130, 65);
      this.container.addChild(lineText);

      const ico = new PIXI.Sprite(
        this.config.app.loader.resources["images/icoTransactions.png"].texture
      );
      ico.scale.set(0.75);
      ico.position.set(130, 10);
      this.container.addChild(ico);

      const textIco = new PIXI.Text(
        interfaceTexts["transactions"].text.toUpperCase(),
        {
          fontFamily: "Teko Light",
          fontSize: 45,
          fill: 0xffffff,
          letterSpacing: 0.4
        }
      );
      textIco.position.set(220, 55);
      this.container.addChild(textIco);
    }

    // TODO: replace this:
    //garder à la fin du setup
    this._onTap("draper", false);
    this._onTap("draper", true);
  }

  _onTap(name, crediter) {
    var array = this.arrayDebiter;
    if (crediter) {
      this.crediteur = name;
      array = this.arrayCrediter;
    } else {
      this.debiteur = name;
    }

    array["raven"].texture = this.config.app.loader.resources[
      "images/transaction/btnTransacD.png"
    ].texture;
    array["mudge"].texture = this.config.app.loader.resources[
      "images/transaction/btnTransacD.png"
    ].texture;
    array["bluehat"].texture = this.config.app.loader.resources[
      "images/transaction/btnTransacD.png"
    ].texture;
    array["draper"].texture = this.config.app.loader.resources[
      "images/transaction/btnTransacD.png"
    ].texture;

    array[name].texture = this.config.app.loader.resources[
      "images/transaction/btnTransac.png"
    ].texture;

    this._refreshNewTransaction();
    this.emit("changedCredit");
  }

  _teardown() {
    this.config.container.removeChild(this.container);
    this.removeAllEntities();
  }

  _showNewTransaction() {
    this.containerNew.visible = true;
    this.containerRecap.visible = false;

    this.emit("switchedScreen", "new");
  }

  setVisible(isVisible) {
    this.container.visible = isVisible;

    this.emit("readAllInfo");
  }

  makeTransactionId() {
    return _.isEmpty(this.transactionDataList)
      ? 1
      : _.max(this.transactionDataList, "id").id + 1;
  }

  // Fills in missing fields from transaction data if necessary
  addTransaction(transactionData) {
    if (transactionData.id === null)
      transactionData.id = this.makeTransactionId();
    if (this.showHash && transactionData.hash === null)
      transactionData.hash = transactionData.calculateHash();
    if (this.showSignature && transactionData.signature === null)
      transactionData.signature = transactionData.calculateSignature();

    this.transactionDataList.push(transactionData);

    this._refreshList();
    this._on(transactionData, "updatedStatus", () => this._refreshList());

    this.emit("addedTransaction", transactionData);
    if (!this.container.visible) this.emit("unreadInfo");

    return transactionData;
  }

  discardWaitingTransactions() {
    for (const transactionData of this.transactionDataList) {
      if (transactionData.blockStatus !== "inBlock") {
        transactionData.blockStatus = "discarded";
      }
    }

    this._refreshList();
  }

  _showTransaction(id) {
    this.containerRecap.visible = false;
    this.containerView.visible = true;
    this.containerNew.visible = false;

    const transaction = _.find(this.transactionDataList, { id });
    this.viewingTransaction = transaction;

    this.txtIdView.text = transaction.toString();
    this.txtIdView.visible = true;
    this.txtCrediteur2.text = transaction.credit.toUpperCase();
    this.txtDebiteur2.text = transaction.debit.toUpperCase();
    this.txtMontant.text = transaction.amount;
    if (this.showHash) {
      this.txtHashView.text = transaction.hash;

      if (this.verifyHash) {
        const hashIsCorrect = transaction.calculateHash() === transaction.hash;
        this.txtHashView.style.fill = hashIsCorrect
          ? transactionColors.accepted
          : transactionColors.rejected;
      }
    }

    if (this.showSignature) {
      this.txtSignView.text = transaction.signature;

      if (this.verifySignature) {
        const signatureIsCorrect =
          transaction.calculateSignature() === transaction.signature;
        this.txtSignView.style.fill = signatureIsCorrect
          ? transactionColors.accepted
          : transactionColors.rejected;
      }
    }

    if (this.linkToBlockchain) {
      this.includeButton.visible = _.contains(
        ["waiting", "excluded"],
        transaction.blockStatus
      );
      this.excludeButton.visible = _.contains(
        ["waiting", "included"],
        transaction.blockStatus
      );
    } else {
      const showJudgingButtons =
        transaction.getUserStatus("draper") === "waiting";
      this.acceptButton.visible = showJudgingButtons;
      this.rejectButton.visible = showJudgingButtons;
    }

    this.emit("switchScreen", "view");
  }

  _refreshList() {
    this.transactionListContainer.removeChildren();

    for (let i = 0; i < this.transactionDataList.length; i++) {
      const transactionData = this.transactionDataList[i];
      // Ignore discarded transactions
      if (
        transactionData.linkToBlockchain &&
        transactionData.linkToBlockchain === "discarded"
      )
        continue;

      const transactionColor = transactionColors[transactionData.status];

      const buttonBg = new PIXI.Graphics();
      buttonBg.beginFill(0x000000);
      buttonBg.drawRect(
        -buttonPadding,
        -buttonPadding,
        700 + 2 * buttonPadding,
        buttonHeight + 2 * buttonPadding
      );
      buttonBg.endFill();
      buttonBg.alpha = 0.3;
      buttonBg.position.set(0, i * marginBetweenTransactions);
      buttonBg.interactive = true;
      this._on(buttonBg, "pointerup", () => {
        this.config.fxMachine.play("click");
        this._showTransaction(transactionData.id);
      });
      this.transactionListContainer.addChild(buttonBg);

      const idText = new PIXI.Text(transactionData.id, {
        fontFamily: "Teko",
        fontSize: 34,
        fill: transactionColor
      });
      idText.position.set(0, i * marginBetweenTransactions);
      this.transactionListContainer.addChild(idText);

      if (this.linkToBlockchain) {
        let iconName;
        switch (transactionData.blockStatus) {
          case "waiting": {
            iconName = "waiting-waiting";
            break;
          }

          case "included": {
            iconName = "waiting-accepted";
            break;
          }

          case "excluded": {
            iconName = "waiting-rejected";
            break;
          }

          case "inBlock": {
            iconName = "accepted-accepted";
            break;
          }

          case "discarded": {
            if (
              transactionData.calculateSignature() ===
                transactionData.signature &&
              transactionData.calculateHash() == transactionData.hash
            ) {
              iconName = "rejected-rejected";
            } else {
              iconName = "accepted-rejected";
            }
            break;
          }

          default:
            throw new Error("Unknown status");
        }

        const statusIcon = new PIXI.Sprite(
          this.config.app.loader.resources[
            `images/transaction/${iconName}.png`
          ].texture
        );
        statusIcon.anchor.set(0.5);
        statusIcon.position.set(
          100,
          i * marginBetweenTransactions + buttonHeight / 2
        );
        this.transactionListContainer.addChild(statusIcon);
      } else {
        for (let j = 0; j < 4; j++) {
          const status = transactionData.statuses[j];

          const statusIcon = new PIXI.Sprite(
            this.config.app.loader.resources[
              `images/transaction/${transactionData.status}-${status}.png`
            ].texture
          );
          statusIcon.anchor.set(0.5);
          statusIcon.position.set(
            100 + j * 50,
            i * marginBetweenTransactions + buttonHeight / 2
          );
          this.transactionListContainer.addChild(statusIcon);
        }
      }

      const buttonText = new PIXI.Text(transactionData.toString(), {
        fontFamily: "Teko",
        fontSize: 30,
        fill: transactionColor
      });
      buttonText.position.set(345, i * marginBetweenTransactions);
      this.transactionListContainer.addChild(buttonText);
    }

    this.scrollbox.refresh();
  }

  _refreshNewTransaction() {
    let text = this.debiteur + " / " + this.crediteur + " / " + this.amount;
    this.txtIdNew.text = text.toUpperCase();

    this.emit("changedNewTransaction", this.txtIdNew.text);
  }

  _acceptTransation() {
    this.viewingTransaction.setUserStatus("draper", "accepted");

    this.config.notifier.notify("transaction-accepted");

    this.emit("acceptedTransaction", this.viewingTransaction);
    this.emit("judgedTransaction", this.viewingTransaction, true);

    this.viewingTransaction = null;
    this._showTransactionList();
  }

  _rejectTransation() {
    this.viewingTransaction.setUserStatus("draper", "rejected");

    this.emit("rejectedTransaction", this.viewingTransaction);
    this.emit("judgedTransaction", this.viewingTransaction, false);

    this.config.notifier.notify("transaction-rejected");

    this.viewingTransaction = null;
    this._showTransactionList();
  }

  _includeTransation() {
    this.viewingTransaction.blockStatus = "included";

    this.config.notifier.notify("transaction-included");

    this.emit("includedTransaction", this.viewingTransaction);

    this.viewingTransaction = null;
    this._showTransactionList();
  }

  _excludeTransation() {
    this.viewingTransaction.blockStatus = "excluded";

    this.config.notifier.notify("transaction-excluded");

    this.emit("excludedTransaction", this.viewingTransaction);

    this.viewingTransaction = null;
    this._showTransactionList();
  }

  _showTransactionList() {
    this.containerRecap.visible = true;
    this.containerView.visible = false;
    this.containerNew.visible = false;

    this._refreshList();

    this.emit("switchScreen", "list");
  }

  _onCreateTransaction() {
    if (this.crediteur === this.debiteur) {
      this.config.notifier.notify("transaction-error-same-user");
      return;
    }
    if (this.amount === 0) {
      this.config.notifier.notify("transaction-error-zero");
      return;
    }
    if (this.showHash) {
      if (this.txtHash.text.length === 0) {
        this.config.notifier.notify("transaction-error-hash-missing");
        return;
      }

      if (rsa.calculateHash(this.txtIdNew.text) !== this.txtHash.text) {
        this.config.notifier.notify("transaction-error-hash-incorrect");
        return;
      }
    }
    if (this.showSignature) {
      if (this.txtSign.text.length === 0) {
        this.config.notifier.notify("transaction-error-signature-missing");
        return;
      }

      const keys = network.keys[this.debiteur];
      const signature = rsa.crypt(this.txtHash.text, keys.private, keys.n);
      if (signature !== this.txtSign.text) {
        this.config.notifier.notify("transaction-error-signature-incorrect");
        return;
      }
    }

    const transactionData = new TransactionData(
      this.crediteur,
      this.debiteur,
      this.amount
    );
    transactionData.setUserStatus("draper", "accepted");
    if (this.showHash) transactionData.hash = this.txtHash.text;
    if (this.showSignature) transactionData.signature = this.txtSign.text;

    this.addTransaction(transactionData);

    // Reset the create transaction form
    if (this.txtHash) this.txtHash.text = "";
    if (this.txtSign) this.txtSign.text = "";

    this.config.notifier.notify("transaction-created");
    this.emit("createdTransaction", transactionData);

    this._showTransactionList();
  }

  makeMemento() {
    return this.transactionDataList;
  }

  get canCreateTransaction() {
    return this.btnNewContainer.interactive;
  }
  set canCreateTransaction(value) {
    this.btnNewContainer.interactive = value;
    this.btnNewContainer.alpha = value ? 1 : 0.5;

    // Don't get stuck in the new transaction screen
    if (!value && this.containerNew.visible) {
      this._showTransactionList();
    }
  }
}

export class TransactionData extends PIXI.utils.EventEmitter {
  constructor(credit, debit, amount, hash = null, signature = null) {
    super();

    this.id = null;
    this.credit = credit;
    this.debit = debit;
    this.amount = amount;
    this.hash = hash;
    this.signature = signature;
    this.status = "waiting";
    this.statuses = ["waiting", "waiting", "waiting", "waiting"];
    this.blockStatus = "waiting"; // One of "waiting", "included", "excluded", "inBlock", "discarded"
  }

  toString() {
    const text = this.debit + " / " + this.credit + " / " + this.amount;
    return text.toUpperCase();
  }

  calculateHash() {
    const message = this.toString();
    return rsa.calculateHash(message);
  }

  calculateSignature() {
    const keys = network.keys[this.debit];
    return rsa.crypt(this.hash, keys.private, keys.n);
  }

  // Statuses: "waiting", "accepted", or "rejected"
  // 3 out of 4 must accept for it to be accepted
  _refreshStatus() {
    if (_.find(this.statuses, x => x === "waiting")) this.status = "waiting";
    else if (_.countBy(this.statuses, _.identity()).accepted >= 3)
      this.status = "accepted";
    else this.status = "rejected";
  }

  getUserStatus(userName) {
    const users = ["draper", "mudge", "raven", "bluehat"];
    const index = users.indexOf(userName);
    if (index === -1) throw new Error("no such user");

    return this.statuses[index];
  }

  setUserStatus(userName, status) {
    if (!_.contains(["accepted", "rejected", "waiting"], status))
      throw new Error("no such status");

    const users = ["draper", "mudge", "raven", "bluehat"];
    const index = users.indexOf(userName);
    if (index === -1) throw new Error("no such user");

    this.statuses[index] = status;
    this._refreshStatus();

    this.emit("updatedStatus", this.status);
  }
}

function makeValidationSequence(
  transactionData,
  defaultStatus = "accepted",
  statusByUser = {}
) {
  // Pick a random order of NPCs
  const states = [];
  for (const user of _.shuffle(["mudge", "raven", "bluehat"])) {
    const status = statusByUser[user] || defaultStatus;

    states.push(new entity.WaitingEntity(geom.randomInRange(1000, 4000)));
    states.push(
      new entity.FunctionCallEntity(() =>
        transactionData.setUserStatus(user, status)
      )
    );
  }
  return new entity.EntitySequence(states);
}

// Create the reactions from other users to the a player's transaction (cheating or not)
// Behavior:
//  - If playing by the rules:
//    - The debitor should be draper
//    - The creditor should be the one specified
//    - The amount needs to be over some minimum
//  - If cheating:
//    - The debited user should have enough money, otherwise, all users will reject
//    - The debited user should reject it
//    - More than one transaction can be made, but the total should be over the minimum amount

export class CreatedTransactionActivity extends entity.ParallelEntity {
  constructor(options = {}) {
    super();

    this.options = util.setupOptions({}, options, {
      credit: util.REQUIRED_OPTION, // Set to "draper" if cheating
      minimumAmount: 1
    });
  }

  _setup() {
    this.octorsStolen = 0;

    const states = {
      allowNewTransaction: new entity.FunctionCallEntity(
        () =>
          (this.config.octor.screens.transactions.canCreateTransaction = true)
      ),
      waiting: new entity.WaitForEvent(
        this.config.octor.screens.transactions,
        "createdTransaction",
        transactionData => {
          this.transactionData = transactionData;

          return this.transactionData.credit === "draper"
            ? "cheating"
            : "honest";
        }
      ),

      // Honest states
      honest: new entity.FunctionalEntity({
        setup: () =>
          (this.config.octor.screens.transactions.canCreateTransaction = false),
        requestTransition: () =>
          this._shouldAccept(this.transactionData) ? "accept" : "reject"
      }),
      honestAccept: () => {
        const statusByUser = {};
        if (!this._waitingFor(this.transactionData)) {
          // If this is not the transaction we are waiting for, the creditor does not accept
          statusByUser[this.transactionData.credit] = "rejected";
          // If Draper is not the debitor, the debitor also refuses
          if (this.transactionData.debit !== "draper")
            statusByUser[this.transactionData.debit] = "rejected";
        }

        return makeValidationSequence(
          this.transactionData,
          "accepted",
          statusByUser
        );
      },
      honestReject: () =>
        makeValidationSequence(this.transactionData, "rejected"),
      honestDone: new entity.FunctionalEntity({
        requestTransition: () =>
          this._waitingFor(this.transactionData) ? "yes" : "no"
      }),

      // Cheating states
      cheating: new entity.FunctionalEntity({
        setup: () =>
          (this.config.octor.screens.transactions.canCreateTransaction = false),
        requestTransition: () =>
          this._shouldAccept(this.transactionData) ? "accept" : "reject"
      }),
      cheatingAccept: () => {
        // The cheated user rejects it
        const statusByUser = {};
        statusByUser[this.transactionData.debit] = "rejected";

        return makeValidationSequence(
          this.transactionData,
          "accepted",
          statusByUser
        );
      },
      cheatingReject: () =>
        makeValidationSequence(this.transactionData, "rejected"),
      cheatingDone: new entity.FunctionalEntity({
        requestTransition: () => {
          // We're not looking for the user to cheat
          if (this.options.credit !== "draper") return "no";

          // Did the user cheat enough yet?
          this.octorsStolen += this.transactionData.amount;
          return this.octorsStolen >= this.options.minimumAmount ? "yes" : "no";
        }
      })
    };
    const transitions = {
      allowNewTransaction: "waiting",
      waiting: entity.makeTransitionTable({
        cheating: "cheating",
        honest: "honest"
      }),

      // Honest states
      honest: entity.makeTransitionTable({
        accept: "honestAccept",
        reject: "honestReject"
      }),
      honestReject: "allowNewTransaction",
      honestAccept: "honestDone",
      honestDone: entity.makeTransitionTable({
        yes: "end",
        no: "allowNewTransaction"
      }),

      // Cheating states
      cheating: entity.makeTransitionTable({
        accept: "cheatingAccept",
        reject: "cheatingReject"
      }),
      cheatingReject: "allowNewTransaction",
      cheatingAccept: "cheatingDone",
      cheatingDone: entity.makeTransitionTable({
        yes: "end",
        no: "allowNewTransaction"
      })
    };

    this.stateMachine = new entity.StateMachine(states, transitions, {
      startingState: "allowNewTransaction"
    });
    this.addEntity(this.stateMachine);
  }

  _update() {
    if (this.stateMachine.requestedTransition) this.requestedTransition = true;
  }

  _teardown() {
    // Just in case
    this.config.octor.screens.transactions.canCreateTransaction = false;
  }

  _waitingFor(transactionData) {
    return (
      transactionData.debit === "draper" &&
      transactionData.credit === this.options.credit &&
      transactionData.amount >= this.options.minimumAmount
    );
  }

  _shouldAccept(transactionData) {
    return (
      this.config.octor.screens.ledger.balance[transactionData.debit] >=
      transactionData.amount
    );
  }
}

export class JudgedTransactionActivity extends entity.ParallelEntity {
  constructor(options = {}) {
    super();

    this.options = util.setupOptions({}, options, {
      transactionData: util.REQUIRED_OPTION,
      correctStatus: util.REQUIRED_OPTION,
      correctEntity: util.REQUIRED_OPTION,
      incorrectEntity: util.REQUIRED_OPTION,
      statusByUser: {}
    });
  }

  _setup() {
    const states = {
      // Wait until the player judges the transaction
      waiting: new entity.WaitForEvent(
        this.options.transactionData,
        "updatedStatus",
        () =>
          this.options.transactionData.getUserStatus("draper") ===
          this.options.correctStatus
            ? "correct"
            : "incorrect"
      ),
      correct: makeValidationSequence(
        this.options.transactionData,
        this.options.correctStatus,
        this.options.statusByUser
      ),
      incorrect: makeValidationSequence(
        this.options.transactionData,
        this.options.correctStatus,
        this.options.statusByUser
      ),
      afterCorrect: this.options.correctEntity,
      afterIncorrect: this.options.incorrectEntity
    };

    const transitions = {
      waiting: entity.makeTransitionTable({
        correct: "correct",
        incorrect: "incorrect"
      }),
      correct: "afterCorrect",
      incorrect: "afterIncorrect",
      afterCorrect: "end",
      afterIncorrect: "end"
    };

    this.stateMachine = new entity.StateMachine(states, transitions, {
      startingState: "waiting"
    });
    this.addEntity(this.stateMachine);
  }

  _update() {
    if (this.stateMachine.requestedTransition) this.requestedTransition = true;
  }
}
