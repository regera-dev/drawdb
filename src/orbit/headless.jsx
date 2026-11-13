import { useLayoutEffect } from "react";
import ReactDOM from "react-dom/client";
import { LocaleProvider } from "@douyinfe/semi-ui";
import en_US from "@douyinfe/semi-ui/lib/es/locale/source/en_US";
import "./styles.js";
import i18n from "../i18n/i18n.js";
import Canvas from "../components/EditorCanvas/Canvas";
import { CanvasContextProvider } from "../context/CanvasContext";
import {
  useAreas,
  useDiagram,
  useEnums,
  useLayout,
  useNotes,
  useSaveState,
  useSettings,
  useTransform,
  useTypes,
  useViews,
} from "../hooks";
import OrbitProviders from "./Providers";
import { arrangeDiagram } from "./arrange";
import { diagramBounds, parseDiagram } from "./diagram";
import { fromDbml, fromSql } from "./importers";

// window.orbitErd of docs/orbit/bridge.md, for Orbit's offline render browser.

const RENDER_ID = "orbit-erd-render";
const PADDING = 24;
const SETTLE_TIMEOUT_MS = 10000;

// The canvas switches a render depends on, pinned so a render never depends on
// what an earlier visit left in localStorage.
const RENDER_SETTINGS = {
  showGrid: false,
  showFieldSummary: false,
  showDataTypes: true,
  showCardinality: true,
  showRelationshipLabels: true,
  showDebugCoordinates: false,
  showComments: false,
};

function DrawnDiagram({ diagram, theme, center }) {
  const { setDatabase, setTables, setRelationships, setSqlHeader } =
    useDiagram();
  const { setNotes } = useNotes();
  const { setAreas } = useAreas();
  const { setTypes } = useTypes();
  const { setEnums } = useEnums();
  const { setViews } = useViews();
  const { setLayout } = useLayout();
  const { setSettings } = useSettings();
  const { setTransform } = useTransform();
  const { saveState, setSaveState } = useSaveState();

  useLayoutEffect(() => {
    setSettings((prev) => ({ ...prev, ...RENDER_SETTINGS, mode: theme }));
    setLayout((prev) => ({ ...prev, readOnly: true }));
    setTransform({ zoom: 1, pan: center });
    setDatabase(diagram.database);
    setSqlHeader(diagram.sqlHeader);
    setTables(diagram.tables);
    setRelationships(diagram.relationships);
    setNotes(diagram.notes);
    setAreas(diagram.subjectAreas);
    setTypes(diagram.types);
    setEnums(diagram.enums);
    setViews(diagram.views);
    // Draws one diagram once; render() mounts a new root for the next one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CanvasContextProvider className="h-full w-full">
      <Canvas saveState={saveState} setSaveState={setSaveState} />
    </CanvasContextProvider>
  );
}

const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(resolve));

/** Waits until the canvas shows `box` at 1:1, then for fonts and two more frames. */
async function settled(container, box) {
  const deadline = performance.now() + SETTLE_TIMEOUT_MS;
  const expected = [box.x, box.y, box.width, box.height];
  for (;;) {
    await nextFrame();
    const viewBox = container
      .querySelector("svg#diagram")
      ?.getAttribute("viewBox")
      ?.split(" ")
      .map(Number);
    if (viewBox && expected.every((v, i) => Math.abs(viewBox[i] - v) < 0.5)) {
      break;
    }
    if (performance.now() > deadline) {
      throw new Error("render: the canvas did not settle");
    }
  }
  await document.fonts.ready;
  await nextFrame();
  await nextFrame();
}

let current = null;

async function render(diagram, { theme = "light", region } = {}) {
  const parsed = parseDiagram(arrangeDiagram(diagram));
  const bounds = diagramBounds(parsed, RENDER_SETTINGS) ?? {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
  const area = region ?? {
    x: bounds.x - PADDING,
    y: bounds.y - PADDING,
    width: bounds.width + 2 * PADDING,
    height: bounds.height + 2 * PADDING,
  };
  const box = {
    x: area.x,
    y: area.y,
    width: Math.ceil(area.width),
    height: Math.ceil(area.height),
  };

  current?.root.unmount();
  current?.container.remove();
  const container = document.createElement("div");
  container.id = RENDER_ID;
  Object.assign(container.style, {
    position: "relative",
    width: `${box.width}px`,
    height: `${box.height}px`,
    overflow: "hidden",
  });
  document.body.appendChild(container);
  const root = ReactDOM.createRoot(container);
  current = { root, container };

  root.render(
    <LocaleProvider locale={en_US}>
      <OrbitProviders>
        <DrawnDiagram
          diagram={parsed}
          theme={theme === "dark" ? "dark" : "light"}
          center={{ x: box.x + box.width / 2, y: box.y + box.height / 2 }}
        />
      </OrbitProviders>
    </LocaleProvider>,
  );
  await settled(container, box);
  return { width: box.width, height: box.height };
}

const ready = i18n.changeLanguage("en").then(() => document.fonts.ready);

window.orbitErd = {
  ready: ready.then(() => undefined),
  fromSql,
  fromDbml,
  arrange: (diagram) => arrangeDiagram(diagram),
  render,
};
