import { execSync } from "node:child_process";
import { cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The build Orbit serves at /erd-app/: the embed entry of
// docs/orbit/bridge.md. `npm run build:orbit`; see docs/orbit/README.md.

const root = fileURLToPath(new URL(".", import.meta.url));
const git = (args) => execSync(`git ${args}`, { cwd: root }).toString().trim();

const commit = git("rev-parse HEAD");
if (git("status --porcelain") !== "") {
  console.warn(
    `\nThe working tree has uncommitted changes. The Source link names ${commit}, which does not contain them.\n`,
  );
}

// Monaco's own AMD build, served from this origin instead of jsDelivr.
function monacoFiles() {
  return {
    name: "orbit-monaco-files",
    apply: "build",
    writeBundle({ dir }) {
      cpSync(`${root}node_modules/monaco-editor/min/vs`, `${dir}/monaco/vs`, {
        recursive: true,
      });
    },
  };
}

export default defineConfig({
  base: "/erd-app/",
  publicDir: false,
  plugins: [react(), monacoFiles()],
  define: {
    __ORBIT_COMMIT__: JSON.stringify(commit),
  },
  build: {
    rolldownOptions: {
      input: {
        embed: `${root}embed.html`,
      },
    },
  },
});
