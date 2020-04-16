const gulp = require("gulp");
const htmlreplace = require("gulp-html-replace");
const rollup = require("rollup");
const resolve = require("rollup-plugin-node-resolve");
const commonjs = require("rollup-plugin-commonjs");
const babelRollup = require("rollup-plugin-babel");
const del = require("del");
const uglify = require("gulp-uglify");
const pump = require("pump");
const transform = require("gulp-transform");
const csvparse = require("csv-parse/lib/sync");
const rename = require("gulp-rename");
const useref = require("gulp-useref");
const exec = require("child_process").exec;
const fs = require("fs");
const download = require("gulp-download-stream");
const template = require("gulp-template");
const git = require("git-rev-sync");
const babel = require("gulp-babel");
const concat = require("gulp-concat");
const _ = require("underscore");

// Read the name of the game from the package.json file
const PACKAGE = JSON.parse(fs.readFileSync("./package.json"));
const SITE_DIR =
  process.env.SITE_DIR ||
  `${process.env.HOME}/projects/play-curious/play-curious-site`;
const DEPLOY_DIR = `${SITE_DIR}/games/${PACKAGE.name}/`;

const TEXT_ASSETS = {
  fr: {
    spreadsheet: "1EZ1FCgR_gkZKu-hn9wGwl575V77PmdN238p-W1G1cZY",
    sheets: {
      messages: 0,
      inventory: 2064973196,
      notifications: 1108172738,
      heros: 983500148,
      objectives: 157890220,
      interface: 361404265,
      subtitles: 1145429321,
      tooltips: 1017031843,
      teasers: 785765249
    }
  },
  en: {
    spreadsheet: "1RLBpJCza0rpWXiSVl7EXPpDypdZgO4j5C6L7nvjXHhQ",
    sheets: {
      messages: 0,
      inventory: 2064973196,
      notifications: 1108172738,
      heros: 983500148,
      objectives: 157890220,
      interface: 361404265,
      subtitles: 1145429321,
      tooltips: 1017031843,
      teasers: 785765249
    }
  }
};

function clean() {
  return del(["build", "dist", "electron"]);
}
exports.clean = clean;

async function bundleFile(filename) {
  const rolledUp = await rollup.rollup({
    input: `src/${filename}.js`,
    plugins: [
      resolve(),
      commonjs(),
      babelRollup({
        exclude: ["node_modules/**", "booyah/project_files/**"]
      })
    ]
  });

  await rolledUp.write({
    file: `build/bundle-${filename}.js`,
    format: "umd",
    name: "bundle"
  });
}

async function bundle() {
  // Create a bundle task for each episode
  await ["episode1", "episode2"].map(bundleFile);
}
exports.bundle = bundle;

// Neither useref nor htmlreplace does the complete job, so combine them
// First use html-replace to rename the bundle file, then have useref concat the dependencies
function writeHtmlFile(filename, bundleName) {
  return gulp
    .src(filename)
    .pipe(
      template({ date: new Date(), commit: git.short(), branch: git.branch() })
    )
    .pipe(
      htmlreplace({
        "js-bundle": bundleName
      })
    )
    .pipe(useref())
    .pipe(gulp.dest("build/"));
}
async function writeHtml() {
  await writeHtmlFile("index.html", "bundle-episode1.js");
  await writeHtmlFile("index_fr.html", "bundle-episode1.js");
  await writeHtmlFile("embed.html", "bundle-episode1.js");

  await writeHtmlFile("episode2.html", "bundle-episode2.js");
  await writeHtmlFile("episode2_fr.html", "bundle-episode2.js");
}
exports.writeHtml = writeHtml;

function copyBuildAssets() {
  return gulp
    .src(
      [
        "./*.css",
        "./audio/**",
        "./fonts/**/*.{css,woff,woff2}",
        "./images/**",
        "./text/**",
        "./video/**",
        "./shaders/**",
        "./booyah/fonts/**/*.{css,woff,woff2}",
        "./booyah/images/**"
      ],
      { base: "." }
    )
    .pipe(gulp.dest("build/"));
}
exports.copyBuildAssets = copyBuildAssets;

function compress(cb) {
  pump([gulp.src("build/**/*.js"), uglify(), gulp.dest("dist")], cb);
}
exports.compress = compress;

function copyDistAssets() {
  return gulp
    .src(
      [
        "./build/*.html",
        "./build/*.css",
        "./build/audio/**",
        "./build/fonts/**",
        "./build/images/**",
        "./build/text/**",
        "./build/video/**",
        "./build/shaders/**",
        "./build/booyah/**"
      ],
      { base: "./build" }
    )
    .pipe(gulp.dest("dist/"));
}
exports.copyDistAssets = copyDistAssets;

async function deployInfo() {
  console.log(`Set to deploy to ${DEPLOY_DIR}`);
}
exports.deployInfo = deployInfo;

exports.cleanSite = function cleanSite() {
  return del(DEPLOY_DIR, { force: true });
};

function copyToSite() {
  return gulp.src("dist/**").pipe(gulp.dest(DEPLOY_DIR));
}
exports.copyToSite = copyToSite;

function deploySite(cb) {
  const command = `git add games/${PACKAGE.name} && git commit -m "Updated game ${PACKAGE.name}" && git push && ./build-and-deploy.sh`;
  exec(command, { cwd: SITE_DIR }, (err, stdout, stderr) => {
    console.log(stdout);
    console.error(stderr);

    cb(err);
  });
}
exports.deploySite = deploySite;

function watchFiles() {
  gulp.watch("src/*", bundle);
  gulp.watch("index.html", writeHtml);
  gulp.watch(["images/*", "deps/*", "*.css"], copyBuildAssets);
}
exports.watchFiles = watchFiles;

function convertTsvToJson(csvText) {
  const lines = csvparse(csvText, {
    columns: true,
    delimiter: "\t",
    quote: null
  });

  const output = {};
  for (const line of lines) {
    if (line.ID === "") continue;

    const obj = {};
    for (const key in line) {
      obj[key.toLowerCase()] = line[key];
    }
    output[line.ID] = obj;
  }

  return JSON.stringify(output, null, 2);
}

function convertTextToJson() {
  return gulp
    .src(["text_src/*.tsv"])
    .pipe(transform("utf8", convertTsvToJson))
    .pipe(rename({ extname: ".json" }))
    .pipe(gulp.dest("text/"));
}
exports.convertTextToJson = convertTextToJson;

exports.convertVoices = function convertVoices(cb) {
  const command = `
    for wav in voices_src/fr/*.wav
    do
      output_filename=$(basename $wav .wav)
      ffmpeg -y -i $wav audio/voices/fr/$output_filename.mp3
    done`;
  exec(command, {}, (err, stdout, stderr) => {
    console.log(stdout);
    console.error(stderr);

    cb(err);
  });
};

function downloadText() {
  const downloadCommands = _.chain(TEXT_ASSETS)
    .map((info, language) => {
      return _.map(info.sheets, (gid, name) => ({
        file: `${name}_${language}.tsv`,
        url: `https://docs.google.com/spreadsheets/d/${info.spreadsheet}/export?format=tsv&sheet&gid=${gid}`
      }));
    })
    .flatten(true)
    .value();

  return download(downloadCommands).pipe(gulp.dest("text_src/"));
}
exports.downloadText = downloadText;

// Electron

exports.testElectron = function testElectron(cb) {
  exec("npx electron index.js");
  cb();
};

exports.packElectron = function packElectron(cb) {
  exec("npx electron-builder --dir", {}, err => cb(err));
};

exports.buildElectron = function buildElectron(cb) {
  exec("npx electron-builder -w", {}, err => cb(err));
};

// Meta-tasks

const build = gulp.series(
  clean,
  gulp.parallel([bundle, writeHtml, copyBuildAssets])
);
exports.build = build;

const dist = gulp.series(build, gulp.parallel([compress, copyDistAssets]));
exports.dist = dist;

const deploy = gulp.series(deployInfo, dist, copyToSite, deploySite);
exports.deploy = deploy;

const watch = gulp.series(build, watchFiles);
exports.watch = watch;

const downloadAndConvertText = gulp.series(downloadText, convertTextToJson);
exports.downloadAndConvertText = downloadAndConvertText;

const distElectron = gulp.series(dist, this.buildElectron);
exports.distElectron = distElectron;

exports.default = build;
