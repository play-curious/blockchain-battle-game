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
import * as blockchain from "./blockchain.js";

export class Part5 extends entity.ParallelEntity {
  constructor(memento = null) {
    super();

    this.memento = memento;
  }

  _setup() {
    this.config.jukebox.changeMusic("principal");

    this.octor = new octor.Octor({
      memento: this.memento,

      menu: {
        versionNumber: "5.0",
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
        showSignature: true,
        verifySignature: true,
        linkToBlockchain: true
      },
      toolboxIsActive: true,
      toolbox: {
        allowEncryption: true
      },
      network: {
        showKeys: true
      },
      inventory: {
        unlockedItems: ["octor-5.0"]
      }
    });
    this.addEntity(this.octor);

    const cyberpolSignature = "082028525223";
    const cyberpolHash = "1986";

    const messageToEncrypt = this.config.jsonAssets.messages["5-4-2-raven-2"]
      .text;
    const cyberpolPublicKey = rsa.concat(
      network.keys.cyberpol.public,
      network.keys.cyberpol.n
    );

    // Special copy-paste behavior for Cyberpol card
    this._on(
      this.octor.screens.inventory,
      "openedZoom",
      (inventoryId, zoomContainer) => {
        if (inventoryId !== "cyberpol-card") return;

        {
          // Make box around hash
          const hashBox = new PIXI.Graphics();
          hashBox.position.set(-750 / 2 + 309, -480 / 2 + 390);
          hashBox.lineStyle(4, 0x5ac7d5);
          hashBox.drawRect(-113 / 2, -35 / 2, 113, 35);
          hashBox.hitArea = new PIXI.Rectangle(-113 / 2, -35 / 2, 113, 35);
          hashBox.interactive = true;
          this._on(hashBox, "pointertap", () => {
            this.config.fxMachine.play("click");

            this.config.clipBoard.appear({
              position: hashBox.getGlobalPosition(),
              textToCopy: cyberpolHash
            });
          });
          zoomContainer.addChild(hashBox);
        }

        {
          // Make box around signature
          const signatureBox = new PIXI.Graphics();
          signatureBox.position.set(-750 / 2 + 596, -480 / 2 + 299);
          signatureBox.lineStyle(4, 0x5ac7d5);
          signatureBox.drawRect(-190 / 2, -35 / 2, 190, 35);
          signatureBox.hitArea = new PIXI.Rectangle(-190 / 2, -35 / 2, 190, 35);
          signatureBox.interactive = true;
          this._on(signatureBox, "pointertap", () => {
            this.config.fxMachine.play("click");

            this.config.clipBoard.appear({
              position: signatureBox.getGlobalPosition(),
              textToCopy: cyberpolSignature
            });
          });
          zoomContainer.addChild(signatureBox);
        }
      }
    );

    const transaction_5_1 = new transactions.TransactionData(
      "mudge",
      "bluehat",
      1
    );

    // A bad transaction
    const transactions_5_2_bad = new transactions.TransactionData(
      "raven",
      "bluehat",
      2
    );
    transactions_5_2_bad.hash = transactions_5_2_bad.calculateHash();
    transactions_5_2_bad.signature = "746536296832";

    const transactions_5_2_good = new transactions.TransactionData(
      "bluehat",
      "mudge",
      3
    );

    const tooltipTexts = this.config.jsonAssets.tooltips;
    const mineTooltipSequence = new entity.EntitySequence([
      // Include the transaction
      new tooltip.TooltipSequence({
        tooltip: new tooltip.Tooltip({
          message: tooltipTexts["5-mine-include-transaction"].text,
          boxPosition: new PIXI.Point(474, 387),
          pointerPositionFractions: [new PIXI.Point(0.2, 1)]
        }),
        tooltipConfig: entity.extendConfig({
          container: this.octor.screens.transactions.containerView
        }),
        beforeOpen: new entity.WaitForEvent(
          this.octor,
          "switchedScreen",
          screen => screen === "transactions"
        ),
        beforeClose: new entity.WaitForEvent(
          this.octor.screens.transactions,
          "includedTransaction"
        )
      }),
      // Find nonce
      new tooltip.TooltipSequence({
        tooltip: new tooltip.Tooltip({
          message: tooltipTexts["5-mine-find-nonce"].text,
          boxPosition: new PIXI.Point(288, 475),
          pointerPositionFractions: [
            new PIXI.Point(0.3, 0),
            new PIXI.Point(0.7, 0)
          ]
        }),
        tooltipConfig: entity.extendConfig({
          container: this.octor.screens.blockchain.createView
        }),
        beforeOpen: new entity.WaitForEvent(
          this.octor,
          "switchedScreen",
          screen => screen === "blockchain"
        ),
        beforeClose: new entity.WaitForEvent(
          this.octor.screens.blockchain,
          "updatedHash",
          hash => hash < 1000
        )
      }),

      // Don't quit
      new entity.NullEntity()
    ]);

    // Glitch filters
    this.pixelateFilter = new PIXI.filters.PixelateFilter();
    this.pixelateFilter.enabled = false;
    this.config.container.filters = [this.pixelateFilter];

    this.levelResult;

    this.sequence = new entity.EntitySequence([
      // Part 5.1
      chat.makeChatDialogEntity(this.octor, "5-1-1"),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.unlockObjective("5-1");

        // Create some transactions
        this.octor.screens.transactions.addTransaction(transaction_5_1);
      }),

      // Unlock blockchain
      new notification.Notification("5-blockchain"),
      new entity.FunctionCallEntity(() => {
        this.octor.activateButtons(["blockchain"]);
        this.octor.markAsUnread("blockchain");
        this.octor.screens.blockchain.canCreateBlock = true;
      }),

      new entity.Alternative([
        // Main action
        // Wait for block creation
        new entity.WaitForEvent(this.octor.screens.blockchain, "createdBlock"),

        // Tooltip sequence (should not request a transition at end)
        mineTooltipSequence
      ]),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.completeObjective("5-1");

        this.octor.screens.blockchain.canCreateBlock = false;
      }),

      // chat.makeChatDialogEntity(this.octor, "5-1-2"),

      // Part 5.2

      chat.makeChatDialogEntity(this.octor, "5-2-1"),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.unlockObjective("5-2");

        // Create some transactions
        this.octor.screens.transactions.addTransaction(transactions_5_2_bad);
        this.octor.screens.transactions.addTransaction(transactions_5_2_good);

        this.octor.screens.blockchain.canCreateBlock = true;
      }),

      new entity.StateMachine(
        {
          start: new entity.Alternative([
            {
              transition: "correct",
              entity: new entity.WaitForEvent(
                this.octor.screens.blockchain,
                "createdBlock"
              )
            },
            {
              transition: "incorrect",
              entity: new entity.WaitForEvent(
                this.octor.screens.blockchain,
                "createdIncorrectBlock"
              )
            }
          ]),
          correct: new entity.FunctionCallEntity(() => {
            this.octor.screens.objectives.completeObjective("5-2");

            this.octor.screens.chat.addDialog("5-2-2-win");
          }),
          incorrect: new entity.FunctionCallEntity(() => {
            this.octor.screens.objectives.completeObjective("5-2", "failed");

            this.octor.screens.chat.addDialog("5-2-2-lose");
          })
        },
        {
          correct: "end",
          incorrect: "end"
        }
      ),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.transactions.discardWaitingTransactions();
        this.octor.screens.blockchain.canCreateBlock = false;
      }),

      // Part 5.3
      chat.makeChatDialogEntity(this.octor, "5-3-1"),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.chat.addDialog("5-3-2-raven");
        this.octor.screens.chat.addDialog("5-3-2-bluehat");
        this.octor.screens.chat.addDialog("5-3-2-mudge");
      }),

      new entity.WaitingEntity(5000),

      chat.makeChatDialogEntity(this.octor, "5-3-3"),
      new audio.MusicEntity(null),

      chat.makeChatDialogEntity(this.octor, "5-3-4"),
      new audio.MusicEntity("fast"),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.unlockObjective("5-3");

        this.octor.screens.blockchain.canCreateBlock = true;
      }),

      new BlockRace(),

      new audio.MusicEntity("principal"),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.completeObjective("5-3");
        this.octor.screens.chat.addDialog("5-3-5");

        this.octor.screens.blockchain.canCreateBlock = false;
      }),

      // Part 5.4

      // Reveal extra button in chat and in network
      new entity.FunctionCallEntity(() => {
        this.octor.screens.chat.closeUnresolvedDialogs();

        this.octor.screens.chat.showCyberpol = true;
        this.octor.screens.network.showCyberpol = true;
        this.octor.markAsUnread("network");
      }),

      chat.makeChatDialogEntity(this.octor, "5-4-1"),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.unlockObjective("5-4");
        this.octor.screens.chat.addDialog("5-4-2-smith");
      }),

      new entity.ParallelEntity(
        [
          // Bluehat wants to make a deal
          chat.makeChatDialogEntity(this.octor, "5-4-2-bluehat"),

          // Mudge suggests asking for ID card
          new entity.EntitySequence([
            chat.makeChatDialogEntity(this.octor, "5-4-2-mudge"),
            chat.makeChatDialogEntity(this.octor, "5-4-3"),

            // Reveal image
            new entity.FunctionCallEntity(() => {
              this.octor.screens.inventory.unlockItem("cyberpol-card");
            }),
            new notification.Notification("inventory-new-item")
          ]),

          // Raven suggests sending encrypted message
          new entity.EntitySequence([
            chat.makeChatDialogEntity(this.octor, "5-4-2-raven-1"),
            chat.makeChatDialogEntity(this.octor, "5-4-2-raven-2"),
            chat.makeChatDialogEntity(this.octor, "5-4-2-raven-3"),

            // Copy message tooltip
            new entity.Alternative([
              // Main action
              // Wait until they encrypt the message
              new entity.WaitForEvent(
                this.octor.toolbox,
                "encrypted",
                (text, key) =>
                  text === messageToEncrypt && key === cyberpolPublicKey
              ),

              // Show tooltip
              new entity.EntitySequence([
                new tooltip.TooltipSequence({
                  tooltip: new tooltip.Tooltip({
                    message: tooltipTexts["5-copy-message"].text,
                    boxPosition: () => {
                      const messagePos = this.octor.screens.chat.messageBoxes.raven.getMessagesById(
                        "5-4-2-raven-2"
                      )[0].position;
                      return new PIXI.Point(180, messagePos.y + 100);
                    }
                  }),
                  tooltipConfig: entity.extendConfig({
                    container: this.octor.screens.chat.messageBoxes.raven
                      .scrollbox.content
                  }),
                  beforeClose: new entity.WaitForEvent(
                    this.config.clipBoard,
                    "copied",
                    text => text === messageToEncrypt
                  )
                }),

                // Stop sequence
                new entity.NullEntity()
              ])
            ]),

            chat.makeChatDialogEntity(this.octor, "5-4-4")
          ])
        ],
        { autoTransition: true }
      ),

      // Handle multiple choice
      new entity.FunctionCallEntity(() => {
        this.octor.screens.chat.addDialog("5-4-5");
      }),

      new entity.StateMachine(
        {
          start: new entity.WaitForEvent(
            this.octor.screens.chat,
            "clickedButton",
            (dialog, buttonIndex) => {
              if (dialog.id !== "5-4-5") return false; // Not the right dialog. Keep waiting...

              return `choice${buttonIndex}`;
            }
          ),
          choice0: new entity.EntitySequence([
            chat.makeChatDialogEntity(this.octor, "5-4-6-yes"),
            new entity.FunctionCallEntity(() => {
              this.octor.screens.objectives.completeObjective("5-4", "failed");
              this.levelResult = "lose-yes";
            })
          ]),
          choice1: new entity.EntitySequence([
            chat.makeChatDialogEntity(this.octor, "5-4-6-no-id"),
            new entity.FunctionCallEntity(() => {
              this.octor.screens.objectives.completeObjective("5-4", "failed");
              this.levelResult = "lose-id";
            })
          ]),
          choice2: new entity.EntitySequence([
            chat.makeChatDialogEntity(this.octor, "5-4-6-no-message"),
            new entity.FunctionCallEntity(() => {
              this.octor.screens.objectives.completeObjective("5-4");
              this.levelResult = "win";
            })
          ])
        },
        {
          choice0: "end",
          choice1: "end",
          choice2: "end"
        }
      ),

      // Show glitch
      new entity.WaitingEntity(500),

      new entity.FunctionCallEntity(() => {
        this.pixelateFilter.enabled = true;
      }),
      new entity.WaitingEntity(1000),

      new notification.Notification("5-shutdown"),
      new entity.WaitingEntity(3000),

      // Cut to black
      new audio.MusicEntity(null),
      new entity.FunctionCallEntity(() => {
        this.config.container.visible = false;
        this.config.notifier.container.visible = false;
      }),
      new entity.WaitingEntity(1000)
    ]);
    this.addEntity(this.sequence, entity.extendConfig({ octor: this.octor }));
  }

  _update() {
    if (this.sequence.requestedTransition) {
      this.requestedTransition = {
        name: this.levelResult,
        params: {
          _memento: this.octor.makeMemento(),
          results: this.octor.screens.objectives.getResults([
            "5-1",
            "5-2",
            "5-3",
            "5-4"
          ])
        }
      };
    }
  }

  _teardown() {
    // Make sure the scene is visible at the end
    this.config.container.filters = [];
    this.config.container.visible = true;
    this.config.notifier.container.visible = true;

    this.removeAllEntities();
  }
}

// Make transactions, some of which are invalide
function makeTransaction() {
  const users = ["mudge", "raven", "bluehat"];
  const [fromUser, toUser] = _.chain(users)
    .shuffle()
    .take(2)
    .value();
  const amount = Math.ceil(Math.random() * 3);
  const transaction = new transactions.TransactionData(
    toUser,
    fromUser,
    amount
  );

  // TODO: add bad amounts?

  const diceRoll = Math.random();
  if (diceRoll < 0.25) {
    // Bad hash
    transaction.hash = _.random(10000)
      .toString()
      .padStart(4, "0");
  } else if (diceRoll < 0.5) {
    // Bad signature
    transaction.signature = _.random(1000000000000)
      .toString()
      .padStart(12, "0");
  }

  return transaction;
}

const blockRaceTime = 30000;

class BlockRace extends entity.ParallelEntity {
  _setup() {
    const states = {
      start: new entity.FunctionCallEntity(() => {
        for (let i = 0; i < 4; i++) {
          const transaction = makeTransaction();
          this.config.octor.screens.transactions.addTransaction(transaction);
        }
      }),

      race: new entity.Alternative([
        {
          transition: "timeout",
          entity: new entity.WaitingEntity(blockRaceTime)
        },
        {
          transition: "completed",
          entity: new entity.WaitForEvent(
            this.config.octor.screens.blockchain,
            "createdBlock"
          )
        }
      ]),

      timeout: new entity.FunctionCallEntity(() => {
        const blockTransactions = this.config.octor.screens.transactions.transactionDataList.filter(
          transaction =>
            transaction.blockStatus !== "inBlock" &&
            transaction.calculateHash() === transaction.hash &&
            transaction.calculateSignature() === transaction.signature
        );

        const block = new blockchain.BlockData({
          miner: util.randomArrayElement(["mudge", "bluehat", "raven"]),
          transactions: blockTransactions
        });

        this.config.octor.screens.blockchain.addBlock(block);
      }),

      // Check if Draper earned 5 octors. Since he started with 2, that makes 7 in all
      checkDone: new entity.Decision(() => {
        const amountEarned = _.chain(
          this.config.octor.screens.blockchain.blocks
        )
          .rest()
          .filter({ miner: "draper" })
          .pluck("reward")
          .reduce((memo, reward) => memo + reward, 0)
          .value();
        return amountEarned >= 7 ? "yes" : "no";
      })
    };
    const transitions = {
      start: "race",
      race: entity.makeTransitionTable({
        timeout: "timeout",
        completed: "checkDone"
      }),
      timeout: "start",
      checkDone: entity.makeTransitionTable({
        yes: "end",
        no: "start"
      })
    };

    this.stateMachine = new entity.StateMachine(states, transitions);
    this.addEntity(this.stateMachine);
  }

  _update() {
    if (this.stateMachine.requestedTransition) this.requestedTransition = true;
  }
}
