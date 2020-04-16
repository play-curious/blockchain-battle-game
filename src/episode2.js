import * as util from "../booyah/src/util.js";
import * as booyah from "../booyah/src/booyah.js";
import * as entity from "../booyah/src/entity.js";
import * as narration from "../booyah/src/narration.js";
import * as audio from "../booyah/src/audio.js";
import * as teaser from "./teaser.js";
import * as points from "./points.js";
import * as rsa from "./rsa.js";

import * as clipBoard from "./clipBoard.js";
import * as hero from "./hero.js";
import * as notification from "./notification.js";
import * as subtitles from "./subtitles.js";
import * as responsive from "./responsive.js";

import * as part4 from "./part4.js";
import * as part5 from "./part5.js";

const splashScreen = "images/splash.jpg";
const gameLogo = "images/game-logo.png";

const fontAssets = ["Teko", "Teko Light"];

const graphicalAssets = [
  "images/dialIntro.png",
  "images/btnIntro.png",

  "images/bgInventory.png",
  "images/copyPaste.png",
  "images/copy-paste-button.png",
  "images/home.png",
  "images/icoChat.png",
  "images/icoBlockchain.png",
  "images/icoInventory.png",
  "images/icoObjectives.png",
  "images/icoLedger.png",
  "images/icoNetwork.png",
  "images/icoTransactions.png",
  "images/icoToolbox.png",
  "images/menuHexa.png",
  "images/bgTilling.jpg",
  "images/bgLedger.png",
  "images/traitVertical.png",
  "images/traitHorizontal.png",
  "images/objective-success.png",
  "images/objective-failure.png",
  "images/btnBack.png",
  "images/btnToolbox.png",
  "images/bgCalcul.png",
  "images/calcuCrypt.png",
  "images/calcuDecrypt.png",
  "images/calcuUp.png",
  "images/unread.png",
  "images/notification.png",
  "images/close.png",
  "images/lineText.png",
  "images/key.png",
  "images/public-key.png",
  "images/private-key.png",
  "images/data.png",
  "images/virus.jpg",
  "images/cyberpol-card.jpg",
  "images/arrow-down.png",
  "images/animated-arrow.json",

  // Blockchain
  "images/block.png",
  "images/triple-arrow.png",
  "images/large-box.png",

  "images/screenMenu.png",
  "images/screenNormal.png",
  "images/screenScroll.png",
  "images/screenTool.png",
  "images/screenToolBack.png",
  "images/screenToolScroll.png",

  "images/rotation-octor.json",
  "images/logo-menu.png",

  "images/inventory/octor-1.0.jpg",
  "images/inventory/octor-2.0.jpg",
  "images/inventory/octor-3.0.jpg",
  "images/inventory/octor-4.0.jpg",
  "images/inventory/octor-5.0.jpg",
  "images/inventory/alan-turing-pixel.jpg",
  "images/inventory/cat1.json",
  "images/inventory/cat1-preview.png",
  "images/inventory/cat2.json",
  "images/inventory/cat2-preview.png",
  "images/inventory/cat3.json",
  "images/inventory/cat3-preview.png",
  "images/inventory/legend-of-lolcat.jpg",

  "images/chat/bg.png",
  "images/chat/bluehat.png",
  "images/chat/mudge.png",
  "images/chat/raven.png",
  "images/chat/smith.png",
  "images/chat/bluehatT.png",
  "images/chat/mudgeT.png",
  "images/chat/ravenT.png",
  "images/chat/smithT.png",
  "images/chat/cyberpol.png",
  "images/chat/cyberpolT.png",

  "images/network/bg.png",
  "images/network/computer.png",
  "images/network/iRaven.png",
  "images/network/iBluehat.png",
  "images/network/iMudge.png",
  "images/network/iDraper.png",
  "images/network/iCyberpol.png",

  "images/transaction/idTransaction.png",
  "images/transaction/recap.png",
  "images/transaction/button-left.png",
  "images/transaction/button-right.png",
  "images/transaction/btnTransac.png",
  "images/transaction/btnTransacD.png",
  "images/transaction/moins.png",
  "images/transaction/plus.png",
  "images/transaction/txtBox.png",
  "images/transaction/boxDebiteur.png",
  "images/transaction/boxCredit.png",
  "images/transaction/boxHash.png",
  "images/transaction/accepted-accepted.png",
  "images/transaction/accepted-rejected.png",
  "images/transaction/rejected-accepted.png",
  "images/transaction/rejected-rejected.png",
  "images/transaction/waiting-accepted.png",
  "images/transaction/waiting-rejected.png",
  "images/transaction/waiting-waiting.png",

  // Shaders
  "shaders/focus.glsl",
];

const videoAssets = [
  "Octor-4.0.mp4",
  "Octor-5.0.mp4",
  "game-by-play-curious.mp4",
];

const fxAssets = [
  "click",
  "error",
  "notif",
  "copy",
  "paste",
  "game-by-play-curious",
  "points-1",
  "points-2",
];

// Language dependant assets
const supportedLanguages = ["en", "fr"];
const language = util.determineLanguage(supportedLanguages, "en");

const jsonAssetNames = [
  "messages",
  "notifications",
  "heros",
  "objectives",
  "interface",
  "inventory",
  "subtitles",
  "tooltips",
  "teasers",
];
const jsonAssets = jsonAssetNames.map((key) => ({
  key,
  url: `text/${key}_${language}.json`,
}));

const musicAssets = ["principal", "fast"];
for (let i = 4; i <= 5; i++) {
  const key = `Octor-${i}.0`;
  musicAssets.push({
    key,
    url: `${key}_${language}`,
  });
}

const credits = {
  "Concept original": "Jesse Himmelstein",
  "Direction Artistique": "Jean-Christophe Letraublon",
  "Narative design": "Ronan Le Breton",
  Animations: "Mathilde Doré",
  Illustrations: ["Enzo Magny Carvalho", "Mathilde Doré"],
  "Sound design": "Jean-Baptiste Mar",
  Développement: ["Clément Baille", "Jesse Himmelstein"],
};

// Store the memento returned by parts 1 and 2 and feed them into parts 2 and 3
let memento;

let lastLevelParams;

const gameStates = {
  // Episode 2
  start: new hero.HeroScene(["4-1", "4-2"]),
  video4: new narration.VideoScene({
    video: "video/Octor-4.0.mp4",
    music: "Octor-4.0",
    narration: "4",
  }),
  part4: new part4.Part4(),
  points4: (params) =>
    new points.PointsScreen(_.extend(params.results, { part: 4 })),

  video5: new narration.VideoScene({
    video: "video/Octor-5.0.mp4",
    music: "Octor-5.0",
    narration: "5",
  }),
  part5: new part5.Part5(),
  points5: (params) =>
    new points.PointsScreen(_.extend(params.results, { part: 5 })),

  endLoseYes: new hero.HeroScene([
    "5-lose-1",
    "5-lose-2",
    "5-lose-3-yes",
    "5-lose-4",
    "5-lose-5",
    "5-lose-6",
  ]),
  endLoseId: new hero.HeroScene([
    "5-lose-1",
    "5-lose-2",
    "5-lose-3-id",
    "5-lose-4",
    "5-lose-5",
    "5-lose-6",
  ]),
  endWin: new hero.HeroScene(_.range(1, 6).map((i) => `5-win-${i}`)),

  teaser: new teaser.Teaser("subscribe"),

  gameByPlayCurious: new entity.ParallelEntity(
    [
      new entity.VideoEntity("video/game-by-play-curious.mp4"),
      new entity.FunctionCallEntity(function () {
        this.config.fxMachine.play("game-by-play-curious");
      }),
    ],
    { autoTransition: true }
  ),
};

let gameTransitions = {
  start: "video4",

  video4: "part4",
  part4: (name, params) => {
    memento = params._memento;
    return { name: "points4", params };
  },
  points4: "video5",

  video5: "part5",
  part5: (name, params) => {
    lastLevelParams = params;
    switch (name) {
      case "win":
        return "endWin";
      case "lose-yes":
        return "endLoseYes";
      case "lose-id":
        return "endLoseId";
      default:
        throw new Error(`Unknown transition ${name}`);
    }
  },
  endWin: () => ({ name: "points5", params: lastLevelParams }),
  endLoseYes: () => ({ name: "points5", params: lastLevelParams }),
  endLoseId: () => ({ name: "points5", params: lastLevelParams }),

  points5: "teaser",
  teaser: "gameByPlayCurious",

  gameByPlayCurious: "end",
};

const entityInstallers = [
  audio.makeInstallJukebox({ volume: 1 }),
  audio.installFxMachine,
  clipBoard.installClipBoard,
  subtitles.installSubtitleNarrator,
  notification.installNotifier,
  booyah.installMenu,
];

const isOnDesktop = responsive.isOnDesktop();

// Start
booyah.go({
  rootConfig: { isOnDesktop },

  states: gameStates,
  transitions: gameTransitions,
  entityInstallers,

  splashScreen,
  gameLogo,
  fontAssets,
  graphicalAssets,

  musicAssets,
  fxAssets,
  videoAssets,
  jsonAssets,

  language,
  supportedLanguages,

  credits,
  creditsTextSize: 24,

  menuButtonPosition: isOnDesktop
    ? new PIXI.Point(960 - 40, 50)
    : new PIXI.Point(960 - 50, 50),

  graphics: {
    menu: "images/play-curious-icon.png",
    play: "images/button-play.png",
    skip: "images/button-skip.png",
  },

  extraLogos: [
    "images/logo-science-animation.png",
    "images/logo-blaise-pascal.png",
    "images/logo-ioi.png",
  ],
});
