import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as geom from "../booyah/src/geom.js";
import * as entity from "../booyah/src/entity.js";
import * as scroll from "../booyah/src/scroll.js";
import * as tween from "../booyah/src/tween.js";

const autoScrollAmount = 5;
const fastScrollTime = 500;

export class Autoscroll extends entity.ParallelEntity {
  constructor(scrollbox) {
    super();

    this.scrollbox = scrollbox;
  }

  _setup() {
    this.contentSize = this._getContentSize();
    this.hasNewContent = false;
    this.isAutoScrolling = false;
    this.isFastScrolling = false;

    this.container = new PIXI.Container();
    this.config.container.addChild(this.container);

    this.arrow = new PIXI.Sprite(
      this.config.app.loader.resources["images/arrow-down.png"].texture
    );
    if (this.scrollbox.isScrollbarVertical) {
      this.arrow.anchor.set(0.5, 0);
      this.arrow.position = this.container.toLocal(
        this.scrollbox.container.toGlobal(
          new PIXI.Point(
            this.scrollbox.options.boxWidth / 2,
            this.scrollbox.options.boxHeight
          )
        )
      );
    } else if (this.scrollbox.isScrollbarHorizontal) {
      this.arrow.anchor.set(0.5, 0);
      this.arrow.angle = -90;
      this.arrow.position = this.container.toLocal(
        this.scrollbox.container.toGlobal(
          new PIXI.Point(
            this.scrollbox.options.boxWidth,
            this.scrollbox.options.boxHeight / 2
          )
        )
      );
    } else {
      throw new Error("Scrollbox must be horizontal or vertical");
    }
    this.arrow.interactive = true;
    this._on(this.arrow, "pointertap", () => (this.isFastScrolling = true));
    this.container.addChild(this.arrow);

    this._on(this.scrollbox, "refreshed", this._onContentRefresh);
    this._on(this.scrollbox, "moved", this._onMoved);

    const fastScrollSequence = new entity.EntitySequence(
      [
        new entity.FunctionalEntity({
          requestTransition: () => this.isFastScrolling
        }),
        () => this._makeFastScrollTween(),
        new entity.FunctionCallEntity(() => (this.isFastScrolling = false))
      ],
      { loop: true }
    );
    this.addEntity(fastScrollSequence);

    this._refresh();
  }

  _teardown() {
    this.config.container.removeChild(this.container);
    this.removeAllEntities();
  }

  _update() {
    if (!this.isAutoScrolling) return;

    if (this._isAtEnd(this.contentSize)) {
      this.isAutoScrolling = false;
    } else {
      if (this.scrollbox.isScrollbarVertical) {
        this.scrollbox.scrollBy(new PIXI.Point(0, -autoScrollAmount), {
          reason: "autoscroll"
        });
      } else if (this.scrollbox.isScrollbarHorizontal) {
        this.scrollbox.scrollBy(new PIXI.Point(-autoScrollAmount, 0), {
          reason: "autoscroll"
        });
      }
    }
  }

  _getContentSize() {
    return new PIXI.Point(
      this.scrollbox.content.width,
      this.scrollbox.content.height
    );
  }

  _onContentRefresh() {
    const newContentSize = this._getContentSize();
    // If the content hasn't gotten larger, stop
    if (
      newContentSize.x <= this.contentSize.x &&
      newContentSize.y <= this.contentSize.y
    )
      return;

    if (!this._isAtEnd(newContentSize)) {
      if (
        this._isAtEnd(this.contentSize) &&
        this.scrollbox.container.worldVisible
      ) {
        // Start auto-scrolling
        this.isAutoScrolling = true;
      } else {
        // Indicate that new content is available
        this.hasNewContent = true;
        this._refresh();
      }
    }

    this.contentSize = newContentSize;
  }

  _refresh() {
    this.arrow.visible = this.hasNewContent;
  }

  _onMoved({ reason }) {
    // Allow the user to cancel autoscroll by scrolling themselves
    if (this.isAutoScrolling && reason === "user") {
      this.isAutoScrolling = false;
    }

    // If we reached the end, remove new content notification
    if (this.hasNewContent && this._isAtEnd(this.contentSize)) {
      this.hasNewContent = false;
      this._refresh();
    }
  }

  _isAtEnd(contentSize) {
    if (this.scrollbox.isScrollbarVertical) {
      const end =
        this.scrollbox.options.boxHeight -
        (contentSize.y + this.scrollbox.options.contentMarginY);
      return this.scrollbox.content.position.y < end + geom.EPSILON;
    } else if (this.scrollbox.isScrollbarHorizontal) {
      const end =
        this.scrollbox.options.boxWidth -
        (contentSize.x + this.scrollbox.options.contentMarginX);
      return this.scrollbox.content.position.x < end + geom.EPSILON;
    }
  }

  _makeFastScrollTween() {
    let to;
    if (this.scrollbox.isScrollbarVertical) {
      to = new PIXI.Point(
        0,
        this.scrollbox.options.boxHeight -
          (this.contentSize.y + this.scrollbox.options.contentMarginY)
      );
    } else if (this.scrollbox.isScrollbarHorizontal) {
      to = new PIXI.Point(
        this.scrollbox.options.boxWidth -
          (this.contentSize.x + this.scrollbox.options.contentMarginX),
        0
      );
    }

    const fastScrollTween = new tween.Tween({
      from: this.scrollbox.currentScroll,
      to,
      duration: fastScrollTime,
      interpolate: tween.interpolation.point
    });
    this._on(fastScrollTween, "updatedValue", this._updateFastScroll);
    return fastScrollTween;
  }

  _updateFastScroll(value) {
    this.scrollbox.scrollTo(value, { reason: "autoscroll" });
  }
}
