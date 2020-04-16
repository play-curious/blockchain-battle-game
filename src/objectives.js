import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as geom from "../booyah/src/geom.js";
import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";
import * as audio from "../booyah/src/audio.js";
import * as scroll from "../booyah/src/scroll.js";

import * as clipBoard from "./clipBoard.js";

const objectiveColors = {
  succeeded: 0xadfc3b,
  failed: 0xfc5f3b,
  waiting: 0x5ac7d5
};

const marginBetweenObjectives = 20;
const marginBeforeButton = 20;

const buttonPadding = 10;

/**
 * events:
 *  unreadInfo
 *  readAllInfo
 *  completedObjective(status)
 */
export class Objectives extends entity.ParallelEntity {
  constructor(options = {}) {
    super();

    util.setupOptions(this, options, {
      memento: null
    });
  }

  _setup() {
    const interfaceTexts = this.config.jsonAssets.interface;

    this.optTextBox = {
      fontFamily: "Teko",
      fontSize: 40,
      align: "left",
      wordWrap: true,
      wordWrapWidth: 540,
      fill: objectiveColors.waiting
    };

    this.optUnder = {
      fontFamily: "Teko",
      fontSize: 26,
      align: "left",
      wordWrap: true,
      wordWrapWidth: 540,
      fill: 0xffffff
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
      this.config.app.loader.resources["images/icoObjectives.png"].texture
    );
    ico.scale.set(0.75);
    ico.position.set(130, 10);
    this.container.addChild(ico);

    const textIco = new PIXI.Text(
      interfaceTexts["objectives"].text.toUpperCase(),
      {
        fontFamily: "Teko Light",
        fontSize: 50,
        fill: 0xffffff,
        letterSpacing: 0.4
      }
    );
    textIco.position.set(220, 55);
    this.container.addChild(textIco);

    {
      const scoreText = new PIXI.Text(interfaceTexts["score"].text, {
        fontFamily: "Teko",
        fontSize: 40,
        fill: 0xffffff
      });
      scoreText.anchor.set(1, 0);
      scoreText.position.set(780, 70);
      this.container.addChild(scoreText);
    }

    {
      this.scoreCounter = new PIXI.Text("555", {
        fontFamily: "Teko",
        fontSize: 40,
        fill: objectiveColors.succeeded
      });
      this.scoreCounter.anchor.set(0.5, 0);
      this.scoreCounter.position.set(810, 70);
      this.container.addChild(this.scoreCounter);
    }

    {
      const costText = new PIXI.Text(
        interfaceTexts["objectives-hint-cost"].text,
        {
          fontFamily: "Teko",
          fontSize: 26,
          align: "center",
          wordWrap: true,
          wordWrapWidth: 540,
          fill: 0xffffff,
          fontStyle: "italic",
          padding: 2
        }
      );
      costText.position.set(450, 110);
      this.container.addChild(costText);
    }

    this.scrollbox = new scroll.Scrollbox({
      boxWidth: 805,
      boxHeight: 330,
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
    this.scrollbox.container.position.set(20, 160);

    this.objectivesJSON = this.config.jsonAssets.objectives;

    if (this.memento) {
      this.objectivesTab = this.memento;
    } else {
      this.objectivesTab = [];

      for (let i = 0; i < Object.keys(this.objectivesJSON).length; i++) {
        let theObjective = this.objectivesJSON[
          Object.keys(this.objectivesJSON)[i]
        ];
        // Only take hints with text in them
        const hints = _.filter(
          [
            theObjective["hint-1"],
            theObjective["hint-2"],
            theObjective["hint-3"]
          ],
          _.identity
        );
        this.objectivesTab.push(
          new ObjectiveData(
            theObjective["id"],
            theObjective["name"],
            theObjective["description"],
            hints
          )
        );
      }
    }

    this.refresh();
  }

  completeObjective(id, status = "succeeded") {
    if (!_.contains(["succeeded", "failed"], status))
      throw new Error("no such status");

    const objective = _.find(this.objectivesTab, { id });
    objective.unlock = true;
    objective.status = status;
    this.refresh();

    this.config.notifier.notify(`objective-${status}`);

    this.emit("completedObjective", status);

    if (!this.container.visible) this.emit("unreadInfo");
  }

  unlockObjective(id) {
    _.find(this.objectivesTab, { id }).unlock = true;
    this.refresh();

    this.config.notifier.notify("objective-new");
    if (!this.container.visible) this.emit("unreadInfo");
  }

  refresh() {
    this.scrollbox.content.removeChildren();

    this.scoreCounter.text = this.getTotalScore().toString();

    const unlockedObjectives = this.objectivesTab.filter(o => o.unlock);
    const pastObjectives = unlockedObjectives.filter(
      o => o.status !== "waiting"
    );
    const currentObjective = _.last(
      unlockedObjectives.filter(o => o.status === "waiting")
    );

    let currentY = 0;

    // Add past objectives
    for (const objective of pastObjectives) {
      if (!objective.unlock) continue;

      const objectiveContainer = new PIXI.Container();
      objectiveContainer.position.set(95, currentY);
      this.scrollbox.content.addChild(objectiveContainer);

      let title = new PIXI.Text(
        objective.name,
        _.extend({}, this.optTextBox, {
          fill: objectiveColors[objective.status]
        })
      );
      objectiveContainer.addChild(title);

      let spriteTexture;
      if (objective.status === "succeeded")
        spriteTexture = "images/objective-success.png";
      else spriteTexture = "images/objective-failure.png";

      const sprite = new PIXI.Sprite(
        this.config.app.loader.resources[spriteTexture].texture
      );
      sprite.position.set(640, 0);
      objectiveContainer.addChild(sprite);

      currentY += objectiveContainer.height + marginBetweenObjectives;
    }

    // Add currecnt objective (if any)
    if (currentObjective) {
      const objectiveContainer = new PIXI.Container();
      objectiveContainer.position.set(95, currentY);
      this.scrollbox.content.addChild(objectiveContainer);

      const title = new PIXI.Text(currentObjective.name, this.optTextBox);
      objectiveContainer.addChild(title);

      // Handle hints
      const interfaceTexts = this.config.jsonAssets.interface;
      const hintTexts = [
        interfaceTexts["objectives-hint-1"].text,
        interfaceTexts["objectives-hint-2"].text,
        interfaceTexts["objectives-hint-3"].text
      ];

      // Show revealed hints
      const revealedHints = _.first(
        currentObjective.hints,
        currentObjective.revealedHintCount
      );
      let hintY = title.height + marginBetweenObjectives;
      for (let i = 0; i < revealedHints.length; i++) {
        const hintText = `${interfaceTexts.hint.text} ${i + 1} - ${
          revealedHints[i]
        }`;
        const text = new PIXI.Text(hintText, this.optUnder);
        text.position.set(0, hintY);
        objectiveContainer.addChild(text);

        hintY += text.height + marginBetweenObjectives;
      }

      if (currentObjective.hints.length > currentObjective.revealedHintCount) {
        const text = hintTexts[currentObjective.revealedHintCount];

        const buttonFg = new PIXI.Text(text, {
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
        button.position.set(
          buttonPadding,
          hintY + marginBeforeButton + buttonPadding
        );
        button.addChild(buttonBg);
        button.addChild(buttonFg);
        button.interactive = true;
        this._on(button, "pointerup", this._revealHint);
        objectiveContainer.addChild(button);
      }
    }

    this.scrollbox.refresh();
  }

  _teardown() {
    this.config.container.removeChild(this.container);
  }

  setVisible(isVisible) {
    this.container.visible = isVisible;

    if (isVisible) this.emit("readAllInfo");
  }

  makeMemento() {
    return this.objectivesTab;
  }

  getResults(objectiveIds) {
    const results = {
      objectivesSucceeded: 0,
      objectivesTotal: 0,
      hintsUsed: 0,
      hintsTotal: 0
    };
    for (const id of objectiveIds) {
      const objective = _.find(this.objectivesTab, { id });
      if (objective.status === "succeeded") results.objectivesSucceeded++;
      results.objectivesTotal++;
      results.hintsUsed += objective.revealedHintCount;
      results.hintsTotal += objective.hints.length;
    }
    return results;
  }

  getTotalScore() {
    let score = 0;
    for (const objective of this.objectivesTab) {
      if (objective.status === "succeeded") score += 5;
      score -= objective.revealedHintCount;
    }
    return score;
  }

  _revealHint() {
    this.config.fxMachine.play("click");

    const currentObjective = _.last(
      this.objectivesTab.filter(o => o.unlock && o.status === "waiting")
    );

    currentObjective.revealedHintCount++;
    this.refresh();
  }
}

class ObjectiveData {
  constructor(id, name, description, hints = []) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.hints = hints;

    this.revealedHintCount = 0;
    this.status = "waiting"; // waiting, succeeded, or failed
    this.unlock = false;
  }
}
