import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as geom from "../booyah/src/geom.js";
import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";
import * as audio from "../booyah/src/audio.js";

import * as tooltip from "./tooltip.js";
import * as octor from "./octor.js";
import * as chat from "./chat.js";
import * as notification from "./notification.js";
import * as transactions from "./transactions.js";

export class Part1 extends entity.ParallelEntity {
  _setup() {
    this.config.jukebox.changeMusic("principal");

    this.octor = new octor.Octor({
      menu: {
        activeButtonNames: ["inventory", "chat"]
      },
      ledger: {
        initialBalance: 10
      },
      inventory: {
        unlockedItems: ["octor-1.0"]
      }
    });
    this.addEntity(this.octor);

    // Setup chat scroll tooltip
    const tooltipTexts = this.config.jsonAssets.tooltips;
    const smithMessageBox = this.octor.screens.chat.messageBoxes.smith;
    const scrollTooltipSequence = new tooltip.TooltipSequence({
      tooltip: new tooltip.Tooltip({
        message: tooltipTexts["1-scroll"].text,
        boxPosition: new PIXI.Point(
          700 - smithMessageBox.container.position.x,
          200 - smithMessageBox.container.position.y
        ),
        pointerPositionFractions: [new PIXI.Point(1, 0.5)]
      }),
      tooltipConfig: entity.extendConfig({
        container: smithMessageBox.container
      }),
      // Wait until a few messages are shown
      beforeOpen: new entity.FunctionalEntity({
        requestTransition: () =>
          smithMessageBox.scrollbox.content.children.length === 4
      }),
      // Wait for scroll
      beforeClose: new entity.WaitForEvent(
        smithMessageBox.scrollbox,
        "moved",
        details => details.reason === "user"
      )
    });

    // Different tooltips depending on desktop mode
    let goToNetworkTooltipSequence;
    if (this.config.isOnDesktop) {
      goToNetworkTooltipSequence = new tooltip.TooltipSequence({
        tooltip: new tooltip.Tooltip({
          message: tooltipTexts["1-go-to-network"].text,
          boxPosition: new PIXI.Point(
            200 - smithMessageBox.container.position.x,
            300 - smithMessageBox.container.position.y
          ),
          pointerPositionFractions: [new PIXI.Point(0, 0.3)]
        }),
        tooltipConfig: entity.extendConfig({
          container: smithMessageBox.container
        }),
        beforeClose: new entity.WaitForEvent(
          this.octor,
          "switchedScreen",
          screen => screen === "network"
        )
      });
    } else {
      goToNetworkTooltipSequence = new tooltip.TooltipSequence({
        tooltip: new tooltip.Tooltip({
          message: tooltipTexts["1-menu"].text,
          boxPosition: new PIXI.Point(
            260 - smithMessageBox.container.position.x,
            90 - smithMessageBox.container.position.y
          ),
          pointerPositionFractions: [new PIXI.Point(0, 0.3)]
        }),
        tooltipConfig: entity.extendConfig({
          container: smithMessageBox.container
        }),
        beforeClose: new entity.WaitForEvent(
          this.octor,
          "switchedScreen",
          screen => screen === "network"
        )
      });
    }

    const networkTooltipSequence = new tooltip.TooltipSequence({
      tooltip: new tooltip.Tooltip({
        message: tooltipTexts["1-network"].text,
        boxPosition: new PIXI.Point(330, 310),
        pointerPositionFractions: [
          new PIXI.Point(0.2, 0),
          new PIXI.Point(0.2, 1),
          new PIXI.Point(0.8, 0),
          new PIXI.Point(0.8, 1)
        ]
      }),
      tooltipConfig: entity.extendConfig({
        container: this.octor.screens.network.container
      }),
      beforeClose: new entity.WaitForEvent(
        this.octor.screens.network,
        "selectedUser"
      )
    });

    const createTransactionTooltipSequence = new tooltip.TooltipSequence({
      tooltip: new tooltip.Tooltip({
        message: tooltipTexts["1-create-transaction"].text,
        boxPosition: new PIXI.Point(960 / 2, 350),
        pointerPositionFractions: [new PIXI.Point(0.5, 1)]
      }),
      tooltipConfig: entity.extendConfig({
        container: this.octor.screens.transactions.container
      }),
      beforeOpen: new entity.WaitForEvent(
        this.octor,
        "switchedScreen",
        screen => screen === "transactions"
      ),
      beforeClose: new entity.WaitForEvent(
        this.octor.screens.transactions,
        "switchedScreen",
        screen => screen === "new"
      )
    });
    const creditTooltipSequence = new tooltip.TooltipSequence({
      tooltip: new tooltip.Tooltip({
        message: tooltipTexts["1-credit"].text,
        boxPosition: new PIXI.Point(960 / 2, 390),
        pointerPositionFractions: [
          new PIXI.Point(0.2, 0),
          new PIXI.Point(0.8, 0)
        ]
      }),
      tooltipConfig: entity.extendConfig({
        container: this.octor.screens.transactions.containerNew
      }),
      beforeClose: new entity.WaitForEvent(
        this.octor.screens.transactions,
        "changedCredit"
      )
    });

    const judgingTooltipSequence = new tooltip.TooltipSequence({
      tooltip: new tooltip.Tooltip({
        message: tooltipTexts["1-judging"].text,
        boxPosition: new PIXI.Point(250, 300),
        pointerPositionFractions: [new PIXI.Point(0.5, 0)]
      }),
      tooltipConfig: entity.extendConfig({
        container: this.octor.screens.transactions.container
      }),
      beforeOpen: new entity.WaitForEvent(
        this.octor.screens.transactions,
        "createdTransaction"
      ),
      beforeClose: new entity.WaitForEvent(
        this.octor,
        "transactionUpdatedStatus",
        (transactionData, status) =>
          status === "accepted" || status == "rejected"
      )
    });

    const transaction1_2 = new transactions.TransactionData(
      "mudge",
      "raven",
      2
    );
    const transaction1_3 = new transactions.TransactionData(
      "raven",
      "bluehat",
      12
    );

    // Main level sequence
    this.sequence = new entity.EntitySequence([
      // PART 0
      new entity.Alternative([
        new entity.EntitySequence([
          chat.makeChatDialogEntity(this.octor, "0-3")
        ]),
        new entity.EntitySequence([
          scrollTooltipSequence,
          // Will never end
          new entity.NullEntity()
        ])
      ]),

      // Unblock network
      new entity.FunctionCallEntity(() => {
        this.octor.activateButtons(["network"]);
        this.octor.markAsUnread("network");
      }),
      new notification.Notification("0-network"),

      goToNetworkTooltipSequence,
      networkTooltipSequence,

      chat.makeChatDialogEntity(this.octor, "0-4"),
      chat.makeChatDialogEntity(this.octor, "0-5"),

      // Unblock ledger
      new notification.Notification("0-ledger"),
      new entity.FunctionCallEntity(() => {
        this.octor.activateButtons(["ledger"]);
        this.octor.markAsUnread("ledger");
      }),

      new entity.WaitForEvent(
        this.octor,
        "switchedScreen",
        name => name === "ledger"
      ),
      chat.makeChatDialogEntity(this.octor, "0-6"),

      // PART 1
      chat.makeChatDialogEntity(this.octor, "1-0-0"),
      new entity.WaitingEntity(1000),

      // Unblock objectives
      new notification.Notification("1-objectives"),
      new entity.FunctionCallEntity(() => {
        this.octor.activateButtons(["objectives"]);
        this.octor.screens.objectives.unlockObjective("1-1");
      }),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.chat.addDialog("1-0-1-mudge");
        this.octor.screens.chat.addDialog("1-0-1-raven");
      }),
      chat.makeChatDialogEntity(this.octor, "1-0-1-bluehat"),

      // Unblock transactions
      new notification.Notification("1-transactions"),
      new entity.FunctionCallEntity(() => {
        this.octor.activateButtons(["transactions"]);
        this.octor.markAsUnread("transactions");
      }),

      new entity.Alternative([
        new transactions.CreatedTransactionActivity({
          credit: "bluehat"
        }),
        new entity.EntitySequence([
          createTransactionTooltipSequence,
          creditTooltipSequence,
          judgingTooltipSequence
        ])
      ]),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.completeObjective("1-1");
        this.octor.screens.chat.closeUnresolvedDialogs();

        this.octor.screens.chat.addDialog("1-1-2");
      }),

      chat.makeChatDialogEntity(this.octor, "1-1-3"),

      // Part 1.2
      chat.makeChatDialogEntity(this.octor, "1-2-1"),
      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.unlockObjective("1-2");

        // Add a transaction that the player needs to validate
        this.octor.screens.transactions.addTransaction(transaction1_2);
      }),

      new transactions.JudgedTransactionActivity({
        transactionData: transaction1_2,
        correctStatus: "accepted",
        correctEntity: new entity.ParallelEntity(
          [
            chat.makeChatDialogEntity(this.octor, "1-2-2-success"),
            new entity.FunctionCallEntity(() => {
              this.octor.screens.objectives.completeObjective("1-2");
            })
          ],
          { autoTransition: true }
        ),
        incorrectEntity: new entity.ParallelEntity(
          [
            chat.makeChatDialogEntity(this.octor, "1-2-2-error"),
            new entity.FunctionCallEntity(() => {
              this.octor.screens.objectives.completeObjective("1-2", "failed");
            })
          ],
          { autoTransition: true }
        )
      }),

      // Part 1.3
      chat.makeChatDialogEntity(this.octor, "1-3-1"),
      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.unlockObjective("1-3");

        // Add a transaction that the player needs to validate
        this.octor.screens.transactions.addTransaction(transaction1_3);
      }),

      new transactions.JudgedTransactionActivity({
        transactionData: transaction1_3,
        correctStatus: "rejected",
        statusByUser: { raven: "accepted" },
        correctEntity: new entity.ParallelEntity(
          [
            chat.makeChatDialogEntity(this.octor, "1-3-2-success"),
            new entity.FunctionCallEntity(() => {
              this.octor.screens.objectives.completeObjective("1-3");
            })
          ],
          { autoTransition: true }
        ),
        incorrectEntity: new entity.ParallelEntity(
          [
            chat.makeChatDialogEntity(this.octor, "1-3-2-error"),
            new entity.FunctionCallEntity(() => {
              this.octor.screens.objectives.completeObjective("1-3", "failed");
            })
          ],
          { autoTransition: true }
        )
      }),

      chat.makeChatDialogEntity(this.octor, "1-4")
    ]);
    this.addEntity(
      this.sequence,
      _.extend({}, this.config, { octor: this.octor })
    );
  }

  _update() {
    if (this.sequence.requestedTransition) {
      this.requestedTransition = {
        name: "next",
        params: {
          _memento: this.octor.makeMemento(),
          results: this.octor.screens.objectives.getResults([
            "1-1",
            "1-2",
            "1-3"
          ])
        }
      };
    }
  }

  _teardown() {
    this.removeAllEntities();
  }
}
