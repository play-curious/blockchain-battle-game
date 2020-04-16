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
import * as network from "./network.js";
import * as rsa from "./rsa.js";
import * as tooltip from "./tooltip.js";

export class Part4 extends entity.ParallelEntity {
  constructor(memento = null) {
    super();

    this.memento = memento;
  }

  _setup() {
    this.config.jukebox.changeMusic("principal");

    this.octor = new octor.Octor({
      memento: this.memento,

      menu: {
        versionNumber: "4.0",
        activeButtonNames: [
          "chat",
          "network",
          "objectives",
          "transactions",
          "ledger",
          "inventory"
        ]
      },
      ledger: {
        initialBalance: 15
      },
      transactions: {
        showHash: true,
        verifyHash: true,
        showSignature: true
      },
      toolboxIsActive: true,
      toolbox: {
        allowEncryption: true
      },
      network: {
        showKeys: true
      },
      inventory: {
        unlockedItems: [
          "octor-1.0",
          "octor-2.0",
          "octor-3.0",
          "octor-4.0",
          "turing",
          "cat1",
          "cat2",
          "cat3"
        ]
      }
    });
    this.addEntity(this.octor);

    const transaction4_2 = new transactions.TransactionData(
      "bluehat",
      "mudge",
      1
    );

    const transaction4_3_honest = new transactions.TransactionData(
      "raven",
      "bluehat",
      5
    );
    const transaction4_3_cheat = new transactions.TransactionData(
      "raven",
      "mudge",
      9
    );
    transaction4_3_cheat.hash = transaction4_3_cheat.calculateHash();
    transaction4_3_cheat.signature = "749631180950"; // random

    let correctOnCheat = null;
    let correctOnHonest = null;

    const transaction4_4 = new transactions.TransactionData(
      "draper",
      "mudge",
      5
    );

    const tooltipTexts = this.config.jsonAssets.tooltips;

    // Hide these tooltips when not showing encryption
    const encryptionTooltipContainer = new PIXI.Container();
    this._on(this.octor.toolbox, "switchedScreen", screen => {
      encryptionTooltipContainer.visible = screen === "encryption";
    });
    this.octor.toolbox.container.addChild(encryptionTooltipContainer);

    const pasteHashTooltip = new tooltip.Tooltip({
      message: tooltipTexts["4-sign-paste-hash"].text,
      boxPosition: new PIXI.Point(500, 390),
      pointerPositionFractions: [new PIXI.Point(0.8, 0)]
    });
    const pasteKeyTooltip = new tooltip.Tooltip({
      message: tooltipTexts["4-sign-paste-key"].text,
      boxPosition: new PIXI.Point(820, 390),
      pointerPositionFractions: [new PIXI.Point(0.2, 0)],
      wordWrapWidth: 250
    });
    const draperPrivateKey = rsa.concat(
      network.keys.draper.private,
      network.keys.draper.n
    );

    const signTooltipSequence = new entity.ParallelEntity([
      new entity.EntitySequence([
        // Wait until correct hash created
        new entity.WaitForEvent(
          this.octor.screens.transactions,
          "pastedNewHash",
          hash => hash == "6121"
        ),

        // Copy hash
        new tooltip.TooltipSequence({
          tooltip: new tooltip.Tooltip({
            message: tooltipTexts["4-sign-copy-hash"].text,
            boxPosition: new PIXI.Point(570, 410),
            pointerPositionFractions: [new PIXI.Point(0, 0.5)]
          }),
          tooltipConfig: entity.extendConfig({
            container: this.octor.screens.transactions.containerNew
          }),
          beforeClose: new entity.WaitForEvent(
            this.config.clipBoard,
            "copied",
            text => text == "6121"
          )
        }),
        // Paste hash
        new tooltip.TooltipSequence({
          tooltip: pasteHashTooltip,
          tooltipConfig: entity.extendConfig({
            container: encryptionTooltipContainer
          }),
          beforeClose: new entity.WaitForEvent(
            this.config.clipBoard,
            "pasted",
            text => text == "6121"
          )
        })
      ]),

      new entity.EntitySequence([
        // Copy key
        new tooltip.TooltipSequence({
          tooltip: new tooltip.Tooltip({
            message: tooltipTexts["4-sign-copy-private-key"].text,
            boxPosition: new PIXI.Point(960 / 2, 410),
            pointerPositionFractions: [new PIXI.Point(1, 0.5)]
          }),
          tooltipConfig: entity.extendConfig({
            container: this.octor.screens.network.container
          }),
          beforeOpen: new entity.WaitForEvent(
            this.octor.screens.network,
            "selectedUser",
            user => user === "draper"
          ),
          beforeClose: new entity.WaitForEvent(
            this.config.clipBoard,
            "copied",
            text => text === draperPrivateKey
          )
        }),
        // Paste key
        new tooltip.TooltipSequence({
          tooltip: pasteKeyTooltip,
          tooltipConfig: entity.extendConfig({
            container: encryptionTooltipContainer
          }),
          beforeClose: new entity.WaitForEvent(
            this.config.clipBoard,
            "pasted",
            text => text === draperPrivateKey
          )
        })
      ]),

      // Don't quit
      new entity.NullEntity()
    ]);

    this.sequence = new entity.EntitySequence([
      chat.makeChatDialogEntity(this.octor, "4-0"),

      // Part 4.1
      chat.makeChatDialogEntity(this.octor, "4-1"),
      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.unlockObjective("4-1");

        this.octor.screens.chat.addDialog("4-1-2-raven");
        this.octor.screens.chat.addDialog("4-1-2-mudge");
      }),
      chat.makeChatDialogEntity(this.octor, "4-1-2-bluehat"),

      new entity.Alternative([
        // Main action
        new transactions.CreatedTransactionActivity({
          credit: "bluehat",
          minimumAmount: 1
        }),

        // Tooltip sequence (should not request a transition at end)
        signTooltipSequence
      ]),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.chat.addDialog("4-1-3");
        this.octor.screens.objectives.completeObjective("4-1");
      }),

      // PART 4.2
      chat.makeChatDialogEntity(this.octor, "4-2-1"),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.chat.closeUnresolvedDialogs();

        this.octor.screens.objectives.unlockObjective("4-2");
        this.octor.screens.transactions.addTransaction(transaction4_2);
      }),

      new transactions.JudgedTransactionActivity({
        transactionData: transaction4_2,
        correctStatus: "accepted",
        correctEntity: new entity.ParallelEntity(
          [
            chat.makeChatDialogEntity(this.octor, "4-2-3-success"),
            new entity.FunctionCallEntity(() => {
              this.octor.screens.objectives.completeObjective("4-2");
            })
          ],
          { autoTransition: true }
        ),
        incorrectEntity: new entity.ParallelEntity(
          [
            chat.makeChatDialogEntity(this.octor, "4-2-3-error"),
            chat.makeChatDialogEntity(this.octor, "4-2-3-error-mudge"),
            new entity.FunctionCallEntity(() => {
              this.octor.screens.objectives.completeObjective("4-2", "failed");
            })
          ],
          { autoTransition: true }
        )
      }),

      // Part 4.3
      chat.makeChatDialogEntity(this.octor, "4-3-1"),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.unlockObjective("4-3");

        this.octor.screens.chat.addDialog("4-3-2");

        this.octor.screens.transactions.addTransaction(transaction4_3_cheat);
        this.octor.screens.transactions.addTransaction(transaction4_3_honest);
      }),

      new entity.ParallelEntity(
        [
          new transactions.JudgedTransactionActivity({
            transactionData: transaction4_3_cheat,
            correctStatus: "rejected",
            statusByUser: { raven: "accepted" },
            correctEntity: new entity.FunctionCallEntity(
              () => (correctOnCheat = true)
            ),
            incorrectEntity: new entity.FunctionCallEntity(
              () => (correctOnCheat = false)
            )
          }),
          new transactions.JudgedTransactionActivity({
            transactionData: transaction4_3_honest,
            correctStatus: "accepted",
            correctEntity: new entity.FunctionCallEntity(
              () => (correctOnHonest = true)
            ),
            incorrectEntity: new entity.FunctionCallEntity(
              () => (correctOnHonest = false)
            )
          })
        ],
        { autoTransition: true }
      ),

      new entity.FunctionCallEntity(() => {
        const objectiveStatus =
          correctOnCheat && correctOnHonest ? "succeeded" : "failed";
        this.octor.screens.objectives.completeObjective("4-3", objectiveStatus);

        // TODO: move this dialogue earlier?
        // this.octor.screens.chat.addDialog("4-3-3");

        this.octor.screens.chat.addDialog("4-3-4");
        this.octor.screens.chat.addDialog("4-3-5");
      }),

      new entity.StateMachine(
        {
          correct: chat.makeChatDialogEntity(this.octor, "4-3-6-success"),
          incorrect: chat.makeChatDialogEntity(this.octor, "4-3-6-error")
        },
        {
          correct: "end",
          incorrect: "end"
        },
        {
          startingState: () =>
            correctOnCheat && correctOnHonest ? "correct" : "incorrect"
        }
      ),

      // Part 4.4
      chat.makeChatDialogEntity(this.octor, "4-4-1"),
      new entity.FunctionCallEntity(() => {
        this.octor.screens.chat.closeUnresolvedDialogs();

        this.octor.screens.objectives.unlockObjective("4-4");
        this.octor.screens.chat.addDialog("4-4-2-raven");
        this.octor.screens.chat.addDialog("4-4-2-bluehat");
      }),
      chat.makeChatDialogEntity(this.octor, "4-4-2-mudge"),

      // First the valid transaction
      new entity.FunctionCallEntity(() => {
        this.octor.screens.transactions.addTransaction(transaction4_4);
      }),
      new transactions.JudgedTransactionActivity({
        transactionData: transaction4_4,
        correctStatus: "accepted",
        correctEntity: new entity.TransitoryEntity(),
        incorrectEntity: new entity.TransitoryEntity()
      }),

      // Then the cheat
      new transactions.CreatedTransactionActivity({
        credit: "draper",
        minimumAmount: 5
      }),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.completeObjective("4-4");
      }),

      chat.makeChatDialogEntity(this.octor, "4-4-3")
    ]);
    this.addEntity(this.sequence, entity.extendConfig({ octor: this.octor }));
  }

  _update() {
    if (this.sequence.requestedTransition) {
      this.requestedTransition = {
        name: "next",
        params: {
          _memento: this.octor.makeMemento(),
          results: this.octor.screens.objectives.getResults([
            "4-1",
            "4-2",
            "4-3",
            "4-4"
          ])
        }
      };
    }
  }

  _teardown() {
    this.removeAllEntities();
  }
}
