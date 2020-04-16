import * as entity from "../booyah/src/entity.js";

export class ObjectiveEffect extends entity.Entity {
  _setup() {
    this.focusFilter = new PIXI.Filter(
      null,
      this.config.app.loader.resources["shaders/focus.glsl"].data,
      {
        progress: 0
      }
    );
    if (!this.config.container.filters) this.config.container.filters = [];
    this.config.container.filters.push(this.focusFilter);
  }

  _update(options) {
    this.focusFilter.uniforms.progress =
      this.focusFilter.uniforms.progress + 0.01;

    if (this.focusFilter.uniforms.progress >= 1)
      this.requestedTransition = true;
  }

  _teardown() {
    this.config.container.filters = _.without(
      this.config.container.filters,
      this.focusFilter
    );
  }
}
