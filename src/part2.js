import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as geom from "../booyah/src/geom.js";
import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";
import * as audio from "../booyah/src/audio.js";

import * as octor from "./octor.js";
import * as chat from "./chat.js";
import * as notification from "./notification.js";
import * as transactions from "./transactions.js";
import * as tooltip from "./tooltip.js";

export class Part2 extends entity.ParallelEntity {
  constructor(memento = null) {
    super();

    this.memento = memento;
  }

  _setup() {
    this.config.jukebox.changeMusic("principal");

    this.octor = new octor.Octor({
      memento: this.memento,

      menu: {
        versionNumber: "2.0",
        activeButtonNames: [
          "inventory",
          "chat",
          "network",
          "objectives",
          "transactions",
          "ledger"
        ]
      },
      ledger: {
        initialBalance: 10
      },
      transactions: {
        showHash: true
      },
      inventory: {
        unlockedItems: ["octor-2.0"]
      },
      toolboxIsActive: true,
      showToolboxNotification: true
    });
    this.addEntity(this.octor);

    // Keep track of the octors received
    this.octorsReceived = 0;
    this._on(this.octor.screens.ledger, "recordedTransaction", transaction => {
      console.log("recordedTransaction ", transaction);
      if (transaction.credit === "draper")
        this.octorsReceived += transaction.amount;
    });

    const tooltipTexts = this.config.jsonAssets.tooltips;

    const hashTooltipSequence = new entity.EntitySequence([
      // Copy the text
      new tooltip.TooltipSequence({
        tooltip: new tooltip.Tooltip({
          message: tooltipTexts["2-hash-copy-transaction"].text,
          boxPosition: new PIXI.Point(650, 70),
          wordWrapWidth: 300,
          pointerPositionFractions: [new PIXI.Point(0.2, 1)]
        }),
        tooltipConfig: entity.extendConfig({
          container: this.octor.screens.transactions.containerNew
        }),
        beforeOpen: new entity.WaitForEvent(
          this.octor.screens.transactions,
          "changedNewTransaction",
          text => text === "DRAPER / MUDGE / 3"
        ),
        beforeClose: new entity.EntitySequence([
          new entity.WaitForEvent(
            this.octor.screens.transactions,
            "copiedNewTransaction"
          ),
          new entity.WaitForEvent(
            this.config.clipBoard,
            "copied",
            text => text === this.octor.screens.transactions.txtIdNew.text
          )
        ])
      }),
      // Open the toolbox
      new tooltip.TooltipSequence({
        tooltip: new tooltip.Tooltip({
          message: tooltipTexts["2-hash-tools"].text,
          boxPosition: this.config.isOnDesktop
            ? new PIXI.Point(200, 490)
            : new PIXI.Point(260, 480),
          pointerPositionFractions: this.config.isOnDesktop
            ? [new PIXI.Point(0, 0.7)]
            : [new PIXI.Point(0, 0.6)]
        }),
        tooltipConfig: entity.extendConfig({
          container: this.octor.screens.transactions.containerNew
        }),
        beforeClose: new entity.WaitForEvent(this.octor.toolbox, "opened")
      }),
      // Paste the transaction
      new tooltip.TooltipSequence({
        tooltip: new tooltip.Tooltip({
          message: tooltipTexts["2-hash-paste-transaction"].text,
          boxPosition: new PIXI.Point(550, 250),
          pointerPositionFractions: [new PIXI.Point(0, 0.5)]
        }),
        tooltipConfig: entity.extendConfig({
          container: this.octor.toolbox.container
        }),
        beforeClose: new entity.WaitForEvent(this.octor.toolbox, "hashed")
      }),
      // Copy the hash
      new tooltip.TooltipSequence({
        tooltip: new tooltip.Tooltip({
          message: tooltipTexts["2-hash-copy-hash"].text,
          boxPosition: new PIXI.Point(550, 375),
          pointerPositionFractions: [new PIXI.Point(0, 0.5)]
        }),
        tooltipConfig: entity.extendConfig({
          container: this.octor.toolbox.container
        }),
        beforeClose: new entity.WaitForEvent(
          this.config.clipBoard,
          "copied",
          text => text === this.octor.toolbox.stringAfterHash
        )
      }),
      // Close the toolbox
      new tooltip.TooltipSequence({
        tooltip: new tooltip.Tooltip({
          message: tooltipTexts["2-hash-close"].text,
          boxPosition: new PIXI.Point(665, 105),
          pointerPositionFractions: [new PIXI.Point(1, 0.5)]
        }),
        tooltipConfig: entity.extendConfig({
          container: this.octor.toolbox.container
        }),
        beforeClose: new entity.WaitForEvent(this.octor.toolbox, "closed")
      }),
      // Paste the hash
      new tooltip.TooltipSequence({
        tooltip: new tooltip.Tooltip({
          message: tooltipTexts["2-hash-paste-end"].text,
          boxPosition: new PIXI.Point(570, 410),
          pointerPositionFractions: [new PIXI.Point(0, 0.5)]
        }),
        tooltipConfig: entity.extendConfig({
          container: this.octor.screens.transactions.containerNew
        }),
        beforeClose: new entity.WaitForEvent(
          this.octor.screens.transactions,
          "pastedNewHash"
        )
      }),
      new entity.NullEntity()
    ]);

    this.sequence = new entity.EntitySequence([
      // Part 2.1
      chat.makeChatDialogEntity(this.octor, "2-1-1"),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.unlockObjective("2-1");
      }),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.chat.addDialog("2-1-2-bluehat");
        this.octor.screens.chat.addDialog("2-1-2-raven");
      }),
      chat.makeChatDialogEntity(this.octor, "2-1-2-mudge"),

      new entity.Alternative([
        // Main action
        new transactions.CreatedTransactionActivity({
          minimumAmount: 3,
          credit: "mudge"
        }),

        // Tooltip sequence (should not request a transition at end)
        hashTooltipSequence
      ]),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.completeObjective("2-1");
        this.octor.screens.chat.closeUnresolvedDialogs();

        this.octor.screens.inventory.unlockItem("turing");
        this.octor.screens.chat.addDialog("2-1-3");
      }),

      // Part 2.2
      chat.makeChatDialogEntity(this.octor, "2-2-1"),

      new entity.FunctionCallEntity(() => {
        for (const item of ["cat1", "cat2", "cat3"])
          this.octor.screens.inventory.unlockItem(item);

        this.config.notifier.notify("inventory-new-item");
      }),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.unlockObjective("2-2");

        this.octor.screens.chat.addDialog("2-2-2-bluehat");
        this.octor.screens.chat.addDialog("2-2-2-raven");
        this.octor.screens.chat.addDialog("2-2-2-mudge");
      }),

      new transactions.CreatedTransactionActivity({
        credit: "draper",
        minimumAmount: 5
      }),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.completeObjective("2-2");
        this.octor.screens.chat.closeUnresolvedDialogs();

        // Get the last transaction to figure out which dialog to launch
        const lastTransaction = _.last(
          this.octor.screens.transactions.transactionDataList
        );
        this.octor.screens.chat.addDialog(`2-2-3-${lastTransaction.debit}`);

        this.octor.screens.chat.addDialog("2-2-4");
      }),

      chat.makeChatDialogEntity(this.octor, "2-2-5")
    ]);
    this.addEntity(this.sequence, entity.extendConfig({ octor: this.octor }));
  }

  _update() {
    if (this.sequence.requestedTransition) {
      this.requestedTransition = {
        name: "next",
        params: {
          _memento: this.octor.makeMemento(),
          results: this.octor.screens.objectives.getResults(["2-1", "2-2"])
        }
      };
    }
  }

  _teardown() {
    this.removeAllEntities();
  }
}
