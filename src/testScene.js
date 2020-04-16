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
import * as blockchain from "./blockchain.js";
import * as tooltip from "./tooltip.js";

export class TestScene extends entity.ParallelEntity {
  _setup() {
    this.config.jukebox.changeMusic("principal");

    this.octor = new octor.Octor({
      menu: {
        activeButtonNames: [
          "chat",
          "inventory",
          "ledger",
          "transactions",
          "objectives",
          "network",
          "blockchain"
        ]
      },
      ledger: {
        initialBalance: 10
      },
      transactions: {
        showHash: true,
        showSignature: true
      },
      toolbox: {
        allowEncryption: true
      },
      network: {
        showKeys: true
      },
      toolboxIsActive: true,
      showToolboxNotification: true,
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

    this.octor.screens.chat.addDialog("0-3");
    this.octor.screens.chat.addDialog("0-4");
    this.octor.screens.chat.addDialog("1-0-1-mudge");
    this.octor.screens.chat.addDialog("1-0-1-raven");
    this.octor.screens.chat.addDialog("1-0-1-bluehat");

    this.octor.screens.objectives.unlockObjective("1-1");
    this.octor.screens.objectives.completeObjective("1-1");
    this.octor.screens.objectives.unlockObjective("1-2");

    for (let i = 0; i < 10; i++) {
      const transaction = new transactions.TransactionData(
        "raven",
        "mudge",
        i + 1
      );
      for (let j = 0; j < 4; j++) {
        transaction.statuses[j] = util.randomArrayElement([
          "waiting",
          "accepted",
          "accepted",
          "rejected",
          "rejected"
        ]);
      }

      this.octor.screens.transactions.addTransaction(transaction);
      this.octor.screens.ledger.addTransaction(transaction);
    }

    this.octor.screens.transactions.addTransaction(
      new transactions.TransactionData("raven", "mudge", 2)
    );
    this.octor.screens.transactions.addTransaction(
      new transactions.TransactionData("bluehat", "raven", 3)
    );

    // Test blockchain
    function makeTransaction(id) {
      const t = new transactions.TransactionData();
      t.id = id;
      return t;
    }

    this.octor.screens.blockchain.addBlock(
      new blockchain.BlockData({
        miner: "draper",
        hash: 1234,
        transactions: [makeTransaction(1), makeTransaction(2)],
        nonce: 3,
        reward: 2
      })
    );
    this.octor.screens.blockchain.addBlock(
      new blockchain.BlockData({
        miner: "mudge",
        hash: 5678,
        previousBlockHash: 1234,
        transactions: [makeTransaction(3)],
        nonce: 7,
        reward: 1
      })
    );
    this.octor.screens.blockchain.addBlock(
      new blockchain.BlockData({
        miner: "raven",
        hash: 9012,
        previousBlockHash: 5678,
        transactions: [
          makeTransaction(5),
          makeTransaction(6),
          makeTransaction(7)
        ],
        nonce: 9,
        reward: 3
      })
    );
    this.octor.screens.blockchain.canCreateBlock = true;

    network.testAllKeys();
  }
}

export class TestMemento1 extends entity.ParallelEntity {
  _setup() {
    this.octor = new octor.Octor({
      menu: {
        activeButtonNames: [
          "chat",
          "inventory",
          "ledger",
          "transactions",
          "objectives",
          "network"
        ]
      },
      ledger: {
        initialBalance: 10
      },
      toolbox: {
        allowEncryption: true
      },
      network: {
        showKeys: true
      },
      toolboxIsActive: true,
      showToolboxNotification: true
    });
    this.addEntity(this.octor);

    this.octor.screens.chat.addDialog("0-3");
    this.octor.screens.inventory.unlockItem("turing");
    this.octor.screens.objectives.unlockObjective("1-1");
    this.octor.screens.objectives.completeObjective("1-1");

    const transaction = new transactions.TransactionData("raven", "mudge", 2);
    this.octor.screens.transactions.addTransaction(transaction);
    this.octor.screens.ledger.addTransaction(transaction);

    this.waitingEntity = new entity.WaitingEntity(5000);
    this.addEntity(this.waitingEntity);
  }

  _update() {
    if (this.waitingEntity.requestedTransition) {
      const memento = this.octor.makeMemento();
      this.requestedTransition = {
        name: "next",
        params: { _memento: memento }
      };
    }
  }
}

export class TestMemento2 extends entity.ParallelEntity {
  constructor(memento) {
    super();

    this.memento = memento;
  }

  _setup() {
    this.octor = new octor.Octor({
      memento: this.memento,

      menu: {
        activeButtonNames: [
          "chat",
          "inventory",
          "ledger",
          "transactions",
          "objectives",
          "network"
        ]
      },
      ledger: {
        initialBalance: 10
      },
      toolbox: {
        allowEncryption: true
      },
      network: {
        showKeys: true
      },
      toolboxIsActive: true,
      showToolboxNotification: true
    });
    this.addEntity(this.octor);

    this.octor.screens.chat.addDialog("0-5");
    this.octor.screens.objectives.unlockObjective("1-2");
  }
}

export class TestTooltip extends entity.ParallelEntity {
  _setup() {
    this.octor = new octor.Octor({
      menu: {
        activeButtonNames: [
          "chat",
          "inventory",
          "ledger",
          "transactions",
          "objectives",
          "network",
          "blockchain"
        ]
      }
    });
    this.addEntity(this.octor);

    this.tooltip = new tooltip.Tooltip({
      pointerPositionFractions: [new PIXI.Point(1, 0.5)]
    });
    this.addEntity(this.tooltip);

    this.config.container.interactive = true;
    this._on(this.config.container, "pointertap", () => this.tooltip.close());
  }
}

export class TestTransaction extends entity.ParallelEntity {
  _setup() {
    this.octor = new octor.Octor({
      menu: {
        activeButtonNames: ["transactions", "ledger"]
      },
      ledger: {
        initialBalance: 10
      }
    });
    this.addEntity(this.octor);

    const transactionData = new transactions.TransactionData(
      "mudge",
      "bluehat",
      3
    );

    this.addEntity(
      new entity.EntitySequence([
        // new transactions.CreatedTransactionActivity({
        //   credit: "mudge",
        //   minimumAmount: 3
        // }),
        // new entity.FunctionCallEntity(() => console.log("done honest")),

        // new transactions.CreatedTransactionActivity({
        //   credit: "draper",
        //   minimumAmount: 3
        // }),
        // new entity.FunctionCallEntity(() => console.log("done cheat")),

        new entity.FunctionCallEntity(() =>
          this.octor.screens.transactions.addTransaction(transactionData)
        ),
        new transactions.JudgedTransactionActivity({
          transactionData,
          correctStatus: "rejected",
          correctEntity: new entity.FunctionCallEntity(() =>
            console.log("correct")
          ),
          incorrectEntity: new entity.FunctionCallEntity(() =>
            console.log("incorrect")
          ),
          statusByUser: { raven: "accepted", bluehat: "rejected" }
        })
      ]),
      _.extend({}, this.config, { octor: this.octor })
    );
  }
}

export class TestObjectives extends entity.ParallelEntity {
  _setup() {
    this.octor = new octor.Octor({
      menu: {
        activeButtonNames: ["objectives"]
      }
    });
    this.addEntity(this.octor);

    this.addEntity(
      new entity.EntitySequence([
        new entity.FunctionCallEntity(() =>
          this.octor.screens.objectives.unlockObjective("1-1")
        ),
        new entity.WaitingEntity(5000),
        new entity.FunctionCallEntity(() =>
          this.octor.screens.objectives.completeObjective("1-1")
        ),
        new entity.WaitingEntity(5000),
        new entity.FunctionCallEntity(() =>
          this.octor.screens.objectives.unlockObjective("1-2")
        ),
        new entity.WaitingEntity(5000),
        new entity.FunctionCallEntity(() =>
          this.octor.screens.objectives.completeObjective("1-2", "failed")
        ),
        new entity.WaitingEntity(5000),
        new entity.FunctionCallEntity(() =>
          this.octor.screens.objectives.unlockObjective("1-3")
        )
      ]),
      _.extend({}, this.config, { octor: this.octor })
    );
  }
}
