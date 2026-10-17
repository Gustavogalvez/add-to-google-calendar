import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

const REPO = "https://github.com/Gustavogalvez/add-to-google-calendar";
const SCRIPT_URL = "https://raw.githubusercontent.com/Gustavogalvez/add-to-google-calendar/main/dist/add-to-google-calendar.user.js";

export default defineConfig({
  plugins: [
    monkey({
      entry: "src/main.ts",
      userscript: {
        name: "Add to Google Calendar",
        namespace: REPO,
        version: "0.1.1",
        description: "Detects events (JSON-LD) on ticket and event pages and adds a button to send them to Google Calendar.",
        author: "Gustavo Galvez (Gustavogalvez)",
        license: "MIT",
        homepageURL: REPO,
        supportURL: `${REPO}/issues`,
        updateURL: SCRIPT_URL,
        downloadURL: SCRIPT_URL,
        match: ["*://*/*"],
        "run-at": "document-idle",
        noframes: true,
        grant: [],
      },
    }),
  ],
});
