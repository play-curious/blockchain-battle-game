import * as util from "../booyah/src/util.js";

/**
 * If isOnDesktop is in the URL params, will use that
 * Otherwise will return true if in a window larger than 1000px in either dimension
 */
export function isOnDesktop() {
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.has("isOnDesktop"))
    return util.stringToBool(searchParams.get("isOnDesktop"));

  return window.innerWidth > 1000 || window.innerHeight > 1000;
}

export function makeBackButton(config) {
  const backButton = new PIXI.Sprite(
    config.app.loader.resources["images/btnBack.png"].texture
  );
  if (config.isOnDesktop) {
    backButton.anchor.set(0.5, 0.5);
    backButton.position.set(100, 35);
    backButton.scale.set(57 / 81, 1);
  } else {
    backButton.anchor.set(1, 0.5);
    backButton.position.set(25 + 81, 123 + 57 / 2);
  }
  backButton.interactive = true;
  return backButton;
}
