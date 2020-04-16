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

export class Part3 extends entity.ParallelEntity {
  constructor(memento = null) {
    super();

    this.memento = memento;
  }

  _setup() {
    this.config.jukebox.changeMusic("principal");

    this.octor = new octor.Octor({
      memento: this.memento,

      menu: {
        versionNumber: "3.0",
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
        initialBalance: 10
      },
      transactions: {
        showHash: true
      },
      toolboxIsActive: true,
      showToolboxNotification: true,
      toolbox: {
        allowEncryption: true
      },
      network: {
        showKeys: true
      },
      inventory: {
        unlockedItems: ["octor-3.0", "turing", "cat1", "cat2", "cat3"]
      }
    });
    this.addEntity(this.octor);

    this.decryptedBluehat = false;
    this._on(this.octor.toolbox, "decrypted", (str, key, result) => {
      if (str === encryptedText && key === draperPrivateKey)
        this.decryptedBluehat = true;
    });

    const encryptedText = this.config.jsonAssets.messages["3-1-1"].text;
    const draperPrivateKey = rsa.concat(
      network.keys.draper.private,
      network.keys.draper.n
    );

    const decryptedText = this.config.jsonAssets.messages["3-2-1-decrypted"]
      .text;
    const bluehatPublicKey = rsa.concat(
      network.keys.bluehat.public,
      network.keys.bluehat.n
    );

    // Glitch filters
    this.minorGlitchFilter = new PIXI.filters.GlitchFilter({
      fillMode: PIXI.filters.GlitchFilter.MIRROR,
      slices: 5,
      direction: 90
    });
    this.minorGlitchFilter.enabled = false;

    this.majorGlitchFilter = new PIXI.filters.GlitchFilter({
      fillMode: PIXI.filters.GlitchFilter.MIRROR,
      slices: 5,
      direction: -45,
      red: new PIXI.Point(10, -10)
    });
    this.majorGlitchFilter.enabled = false;

    this.config.container.filters = [
      this.minorGlitchFilter,
      this.majorGlitchFilter
    ];

    const tooltipTexts = this.config.jsonAssets.tooltips;

    // Hide these tooltips when not showing decryption
    const decryptionTooltipContainer = new PIXI.Container();
    decryptionTooltipContainer.visible = false;
    this._on(this.octor.toolbox, "switchedScreen", screen => {
      decryptionTooltipContainer.visible = screen === "decryption";
    });
    this.octor.toolbox.container.addChild(decryptionTooltipContainer);

    const pasteMessageTooltip = new tooltip.Tooltip({
      message: tooltipTexts["3-decrypt-paste-message"].text,
      boxPosition: new PIXI.Point(500, 390),
      pointerPositionFractions: [new PIXI.Point(0.8, 0)]
    });
    const pasteKeyTooltip = new tooltip.Tooltip({
      message: tooltipTexts["3-decrypt-paste-key"].text,
      boxPosition: new PIXI.Point(820, 390),
      pointerPositionFractions: [new PIXI.Point(0.2, 0)],
      wordWrapWidth: 250
    });

    const decryptTooltipSequence = new entity.ParallelEntity([
      // Select decrypt
      new tooltip.TooltipSequence({
        tooltip: new tooltip.Tooltip({
          message: tooltipTexts["3-decrypt-select"].text,
          boxPosition: new PIXI.Point(960 * (4 / 5), 100),
          pointerPositionFractions: [new PIXI.Point(0.5, 1)]
        }),
        tooltipConfig: entity.extendConfig({
          container: this.octor.toolbox.container
        }),
        beforeClose: new entity.WaitForEvent(
          this.octor.toolbox,
          "switchedScreen",
          name => name === "decryption"
        )
      }),

      new entity.EntitySequence([
        // Copy message
        new tooltip.TooltipSequence({
          tooltip: new tooltip.Tooltip({
            message: tooltipTexts["3-decrypt-copy-message"].text,
            boxPosition: () => {
              const messagePos = this.octor.screens.chat.messageBoxes.bluehat.getMessagesById(
                "3-1-1"
              )[0].position;
              return new PIXI.Point(
                this.config.app.view.width / 2,
                messagePos.y + 150
              );
            }
          }),
          tooltipConfig: entity.extendConfig({
            container: this.octor.screens.chat.messageBoxes.bluehat.scrollbox
              .content
          }),
          beforeClose: new entity.WaitForEvent(
            this.config.clipBoard,
            "copied",
            text => text === encryptedText
          )
        }),
        // Paste message
        new tooltip.TooltipSequence({
          tooltip: pasteMessageTooltip,
          tooltipConfig: entity.extendConfig({
            container: decryptionTooltipContainer
          }),
          beforeClose: new entity.WaitForEvent(
            this.config.clipBoard,
            "pasted",
            text => text === encryptedText
          )
        })
      ]),

      new entity.EntitySequence([
        // Copy key
        new tooltip.TooltipSequence({
          tooltip: new tooltip.Tooltip({
            message: tooltipTexts["3-decrypt-copy-private-key"].text,
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
            container: decryptionTooltipContainer
          }),
          beforeClose: new entity.WaitForEvent(
            this.config.clipBoard,
            "pasted",
            text => text === draperPrivateKey
          )
        })
      ])
    ]);

    const encryptTooltipSequence = new entity.EntitySequence([
      new tooltip.TooltipSequence({
        tooltip: new tooltip.Tooltip({
          message: tooltipTexts["3-encrypt-copy-message"].text,
          // boxPosition: new PIXI.Point(960 / 2, 300),
          boxPosition: () => {
            const messagePos = this.octor.screens.chat.messageBoxes.bluehat.getMessagesById(
              "3-2-1"
            )[1].position;
            return new PIXI.Point(
              this.config.app.view.width / 2,
              messagePos.y - 60
            );
          },
          pointerPositionFractions: [new PIXI.Point(0.8, 1)]
        }),
        tooltipConfig: entity.extendConfig({
          container: this.octor.screens.chat.messageBoxes.bluehat.scrollbox
            .content
        }),
        beforeClose: new entity.WaitForEvent(
          this.config.clipBoard,
          "copied",
          text => text === decryptedText
        )
      }),
      new entity.NullEntity()
    ]);

    this.sequence = new entity.EntitySequence([
      // Part 3.1
      chat.makeChatDialogEntity(this.octor, "3-1-1"),
      chat.makeChatDialogEntity(this.octor, "3-1-2"),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.unlockObjective("3-1");
      }),

      new entity.Alternative([
        // Main action
        new entity.FunctionalEntity({
          requestTransition: () => this.decryptedBluehat
        }),

        // Tooltip sequence (should not request a transition at end)
        decryptTooltipSequence
      ]),

      new entity.FunctionalEntity({
        requestTransition: () => this.decryptedBluehat
      }),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.completeObjective("3-1");
      }),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.chat.closeUnresolvedDialogs();
      }),

      // Part 3.2
      chat.makeChatDialogEntity(this.octor, "3-2-1"),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.unlockObjective("3-2");
      }),

      new entity.Alternative([
        // Main action
        new entity.WaitForEvent(
          this.octor.toolbox,
          "encrypted",
          (str, key, result) =>
            str === decryptedText && key === bluehatPublicKey
        ),

        // Tooltip sequence (should not request a transition at end)
        encryptTooltipSequence
      ]),

      // TODO: find a way to add a button for other possible encyptions
      // new entity.StateMachine(
      //   {
      //     start: new entity.WaitForEvent(
      //       this.octor.toolbox,
      //       "encrypted",
      //       (str, key, result) =>
      //         str === decryptedText && key === bluehatPublicKey
      //           ? "end"
      //           : "incorrect"
      //     ),
      //     incorrect: new entity.FunctionCallEntity(() =>
      //       this.octor.screens.chat.addDialog("3-2-2-error")
      //     )
      //   },
      //   {
      //     start: _.identity(),
      //     incorrect: "start"
      //   }
      // ),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.objectives.completeObjective("3-2");
      }),

      chat.makeChatDialogEntity(this.octor, "3-2-2-success"),
      chat.makeChatDialogEntity(this.octor, "3-2-3"),

      // Part 3.3
      chat.makeChatDialogEntity(this.octor, "3-3-1"),

      // Show minor glitch
      new audio.MusicEntity("glitch"),
      new entity.FunctionCallEntity(() => {
        // TODO: change music

        this.minorGlitchFilter.enabled = true;
      }),
      new entity.WaitingEntity(2000),
      new entity.FunctionCallEntity(() => {
        this.minorGlitchFilter.enabled = false;
      }),

      new entity.FunctionCallEntity(() => {
        this.octor.screens.chat.addDialog("3-3-2");
      }),
      new entity.WaitingEntity(3000),

      // Show major glitch
      new entity.FunctionCallEntity(() => {
        this.majorGlitchFilter.enabled = true;
      }),
      new entity.WaitingEntity(5000),
      new notification.Notification("3-corrupted"),
      new entity.WaitingEntity(2000),

      // Cut to black
      new audio.MusicEntity(null),
      new entity.FunctionCallEntity(() => {
        this.config.container.visible = false;
        this.config.notifier.container.visible = false;
      }),
      new entity.WaitingEntity(5000)
    ]);
    this.addEntity(this.sequence, entity.extendConfig({ octor: this.octor }));
  }

  _update() {
    if (this.majorGlitchFilter.enabled) {
      this.majorGlitchFilter.slices = Math.random() > 0.9 ? 10 : 5;
    }

    if (this.sequence.requestedTransition) {
      this.requestedTransition = {
        name: "next",
        params: {
          _memento: this.octor.makeMemento(),
          results: this.octor.screens.objectives.getResults(["3-1", "3-2"])
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

  _refreshTooltips() {
    const show = this.octor.toolbox.showEncryption === false;
    if (this.pasteMessageTooltip.container)
      this.pasteMessageTooltip.container.visible = show;
    if (this.pasteKeyTooltip.container) this.pasteKeyTooltip.visible = show;
  }
}
