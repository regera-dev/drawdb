import ReactDOM from "react-dom/client";
import { LocaleProvider } from "@douyinfe/semi-ui";
import en_US from "@douyinfe/semi-ui/lib/es/locale/source/en_US";
import { loader } from "@monaco-editor/react";
import "./styles.js";
import "../i18n/i18n.js";
import { queryConfig } from "../utils/queryConfig";
import OrbitProviders from "./Providers";
import EmbedEditor, { EMBED_EXTENSIONS } from "./EmbedEditor";
import { embedMode } from "./bridge";

// Monaco's AMD build, copied into dist/monaco/vs by vite.orbit.config.js, so
// the code editors load from this origin and not from jsDelivr.
loader.config({ paths: { vs: `${import.meta.env.BASE_URL}monaco/vs` } });

const mode = embedMode();
const query = new URLSearchParams();
if (mode === "view") {
  for (const control of ["hideHeader", "hideSidebar", "hideToolbar"]) {
    query.set(queryConfig[control].key, "force");
  }
}
const theme = new URLSearchParams(window.location.search).get("theme");
if (queryConfig.theme.isValid(theme)) query.set(queryConfig.theme.key, theme);

ReactDOM.createRoot(document.getElementById("root")).render(
  <LocaleProvider locale={en_US}>
    <OrbitProviders query={query.toString()} extensions={EMBED_EXTENSIONS}>
      <EmbedEditor mode={mode} />
    </OrbitProviders>
  </LocaleProvider>,
);
