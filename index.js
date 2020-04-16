const { app, BrowserWindow } = require("electron");
const { shell } = require("electron");

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 960,
    height: 700,
    autoHideMenuBar: true
  });

  // win.removeMenu(); // Doesn't work on macos

  win.loadFile("dist/index.html");

  // win.webContents.openDevTools();

  // Exit when window closed
  win.on("closed", () => {
    win = null;
  });

  // Open external links into new browser
  // Based on https://github.com/electron/electron/issues/1344#issuecomment-359309049
  win.webContents.on("will-navigate", (event, link) => {
    const currentUrl = new URL(win.webContents.getURL());
    const newUrl = new URL(link);
    if (newUrl.host === currentUrl.host) return;

    // Open link in new browser
    event.preventDefault();
    shell.openExternal(link);
  });
}

app.on("ready", createWindow);
