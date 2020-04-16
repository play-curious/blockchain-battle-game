import * as entity from "../booyah/src/entity.js";
import * as util from "../booyah/src/util.js";
import * as geom from "../booyah/src/geom.js";
import * as tween from "../booyah/src/tween.js";

const boxPadding = 30;
const pointerWidth = 20;

export class Tooltip extends entity.ParallelEntity {
  constructor(options = {}) {
    super();

    util.setupOptions(this, options, {
      message: "tooltip goes here",
      boxPosition: new PIXI.Point(960 / 2, 540 / 2),
      pointerPositionFractions: [new PIXI.Point(0.2, 0)],
      wordWrapWidth: 300
    });
  }

  _setup(config) {
    this.shouldClose = false;

    this.container = new PIXI.Container();

    if (_.isFunction(this.boxPosition)) {
      this.container.position = this.boxPosition(this);
    } else {
      this.container.position = this.boxPosition;
    }

    this.container.interactive = true; // Block interactions from going "under" the tooltip
    this.config.container.addChild(this.container);

    // Create text now to get size measurements
    this.text = new PIXI.Text(this.message, {
      fontFamily: "Teko Light",
      fontSize: 40,
      fill: 0x055665,
      letterSpacing: 0.3,
      // strokeThickness: 4,
      align: "center",
      wordWrap: true,
      wordWrapWidth: this.wordWrapWidth
    });
    this.text.anchor.set(0.5);

    this.bg = new PIXI.Graphics();
    this.bg.beginFill(0xffffff);
    this.bg.drawRoundedRect(
      -boxPadding - this.text.width / 2,
      -boxPadding - this.text.height / 2,
      this.text.width + 2 * boxPadding,
      this.text.height + 2 * boxPadding,
      10
    );
    this.container.addChild(this.bg);

    this.pointerContainer = new PIXI.Container();
    this.container.addChild(this.pointerContainer);

    for (const pointerPositionFraction of this.pointerPositionFractions) {
      const pointer = new PIXI.Graphics();
      pointer.beginFill(0xffffff);
      pointer.drawRect(
        -pointerWidth / 2,
        -pointerWidth / 2,
        pointerWidth,
        pointerWidth
      );
      pointer.angle = 45;
      pointer.position.set(
        pointerPositionFraction.x * (this.text.width + boxPadding * 2) -
          this.text.width / 2 -
          boxPadding,
        pointerPositionFraction.y * (this.text.height + boxPadding * 2) -
          this.text.height / 2 -
          boxPadding
      );
      this.pointerContainer.addChild(pointer);
    }

    // Add text on top
    this.container.addChild(this.text);

    // Setup animation
    this.pointerContainer.visible = false;
    this.text.visible = false;
    this.animation = new entity.EntitySequence([
      tween.make(
        this.bg,
        {
          scale: {
            from: new PIXI.Point(1, 0),
            to: new PIXI.Point(1, 1),
            interpolate: tween.interpolation.point
          }
        },
        {
          duration: 200
        }
      ),

      new entity.FunctionCallEntity(() => {
        this.pointerContainer.visible = true;
        this.text.visible = true;
      }),

      new entity.FunctionalEntity({
        requestTransition: () => this.shouldClose
      }),

      new entity.FunctionCallEntity(() => {
        this.pointerContainer.visible = false;
        this.text.visible = false;
      }),

      tween.make(
        this.bg,
        {
          scale: {
            from: new PIXI.Point(1, 1),
            to: new PIXI.Point(1, 0),
            interpolate: tween.interpolation.point
          }
        },
        {
          duration: 200
        }
      )
    ]);
    this.addEntity(this.animation);
  }

  _update(options) {
    if (this.animation.requestedTransition) this.requestedTransition = true;
  }

  _teardown() {
    this.config.container.removeChild(this.container);
    this.removeAllEntities();
  }

  close() {
    this.shouldClose = true;
  }
}

export class TooltipSequence extends entity.ParallelEntity {
  constructor(options = {}) {
    super();

    util.setupOptions(this, options, {
      tooltip: util.REQUIRED_OPTION,
      tooltipConfig: null,
      beforeOpen: null,
      beforeClose: util.REQUIRED_OPTION
    });
  }

  _setup() {
    const createTooltip = new entity.FunctionCallEntity(() => {
      this.addEntity(this.tooltip, this.tooltipConfig);
    });
    const closeTooltip = new entity.FunctionCallEntity(() =>
      this.tooltip.close()
    );

    const entities = _.compact([
      this.beforeOpen,
      createTooltip,
      this.beforeClose,
      closeTooltip
    ]);
    this.sequence = new entity.EntitySequence(entities);
    this.addEntity(this.sequence);
  }

  _update() {
    if (this.sequence.requestedTransition && this.tooltip.requestedTransition)
      this.requestedTransition = true;
  }
}
