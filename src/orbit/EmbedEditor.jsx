import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Divider, Tooltip } from "@douyinfe/semi-ui";
import ControlPanel from "../components/EditorHeader/ControlPanel";
import Canvas from "../components/EditorCanvas/Canvas";
import { CanvasContextProvider } from "../context/CanvasContext";
import SidePanel from "../components/EditorSidePanel/SidePanel";
import FloatingControls from "../components/FloatingControls";
import {
  useAreas,
  useDiagram,
  useLayout,
  useNotes,
  useSaveState,
  useSettings,
  useTransform,
  useViews,
} from "../hooks";
import { isRtl } from "../i18n/utils/rtl";
import { useOrbitBridge } from "./useOrbitBridge";
import { fitTransform } from "./diagram";
import SourceLink from "./SourceLink";

// Header and toolbar controls that make no sense inside Orbit: Orbit stores,
// shares, versions and themes the diagram, and drawDB's local diagram list,
// templates, gists and IndexedDB storage stay out of the frame.
export const EMBED_EXTENSIONS = {
  hiddenControls: new Set([
    "file.new",
    "file.new_window",
    "file.open",
    "file.open_recent",
    "file.save",
    "file.save_as",
    "file.save_as_template",
    "file.rename",
    "file.delete_diagram",
    "file.exit",
    "view.theme",
    "settings.autosave",
    "settings.configure_custom_types",
    "settings.export_saved_data",
    "settings.clear_cache",
    "settings.flush_storage",
    "help.ask_on_discord",
    "help.report_bug",
    "header.share",
    "header.save_state",
    "toolbar.save",
    "toolbar.versions",
    "toolbar.theme",
  ]),
};

const SIDEPANEL_MIN_WIDTH = 374;

export default function EmbedEditor({ mode }) {
  const [title, setTitle] = useState();
  useOrbitBridge({ readOnlyMode: mode === "view", title, setTitle });
  return mode === "view" ? (
    <ViewLayout />
  ) : (
    <EditLayout title={title} setTitle={setTitle} />
  );
}

function CanvasArea() {
  const { saveState, setSaveState } = useSaveState();
  return (
    <CanvasContextProvider className="h-full w-full">
      <Canvas saveState={saveState} setSaveState={setSaveState} />
    </CanvasContextProvider>
  );
}

// Workspace.jsx's layout without its IndexedDB and gist loading and saving.
function EditLayout({ title, setTitle }) {
  const { layout } = useLayout();
  const { i18n } = useTranslation();
  const [toolbarContainer, setToolbarContainer] = useState(null);
  const [width, setWidth] = useState(SIDEPANEL_MIN_WIDTH);
  const [resize, setResize] = useState(false);
  const [lastSaved, setLastSaved] = useState("");
  const [startWith, setStartWith] = useState(null);
  const rtl = isRtl(i18n.language);

  const handleResize = (e) => {
    if (!resize) return;
    const w = rtl ? window.innerWidth - e.clientX : e.clientX;
    if (w > SIDEPANEL_MIN_WIDTH) setWidth(w);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden theme">
      <ControlPanel
        title={title ?? ""}
        setTitle={setTitle}
        lastSaved={lastSaved}
        setLastSaved={setLastSaved}
        toolbarContainer={toolbarContainer}
        startWith={startWith}
        setStartWith={setStartWith}
        onBackToStart={() => {}}
      />
      <div
        className="flex h-full overflow-y-auto"
        onPointerUp={(e) => e.isPrimary && setResize(false)}
        onPointerLeave={(e) => e.isPrimary && setResize(false)}
        onPointerMove={(e) => e.isPrimary && handleResize(e)}
        onPointerDown={(e) => e.target.releasePointerCapture(e.pointerId)}
        style={rtl ? { direction: "rtl" } : {}}
      >
        {layout.sidebar && (
          <SidePanel resize={resize} setResize={setResize} width={width} />
        )}
        <div className="relative flex-1 min-w-0 h-full overflow-hidden">
          <CanvasArea />
          {layout.toolbar && (
            <div
              ref={setToolbarContainer}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20"
            />
          )}
          {!(layout.sidebar || layout.toolbar || layout.header) && (
            <div className="fixed right-5 bottom-4">
              <FloatingControls />
            </div>
          )}
          <SourceLink />
        </div>
      </div>
    </div>
  );
}

// The share view: the canvas read-only, with zoom and fit.
function ViewLayout() {
  return (
    <div className="h-full relative overflow-hidden theme">
      <CanvasArea />
      <div className="absolute right-4 bottom-4 z-20">
        <ViewControls />
      </div>
      <SourceLink />
    </div>
  );
}

function ViewControls() {
  const { t } = useTranslation();
  const { transform, setTransform } = useTransform();
  const { settings } = useSettings();
  const { tables, relationships } = useDiagram();
  const { notes } = useNotes();
  const { areas } = useAreas();
  const { views } = useViews();
  const zoomBy = (factor) =>
    setTransform((prev) => ({ ...prev, zoom: prev.zoom * factor }));
  const fit = () =>
    setTransform(
      fitTransform(
        { tables, relationships, notes, subjectAreas: areas, views },
        settings,
        document.getElementById("canvas")?.getBoundingClientRect(),
      ),
    );

  return (
    <div className="popover-theme flex rounded-lg items-center">
      <button
        className="px-3 py-2"
        aria-label={t("zoom_out")}
        onClick={() => zoomBy(1 / 1.2)}
      >
        <i className="bi bi-dash-lg" />
      </button>
      <Divider align="center" layout="vertical" />
      <div className="px-3 py-2">{Math.round(transform.zoom * 100)}%</div>
      <Divider align="center" layout="vertical" />
      <button
        className="px-3 py-2"
        aria-label={t("zoom_in")}
        onClick={() => zoomBy(1.2)}
      >
        <i className="bi bi-plus-lg" />
      </button>
      <Divider align="center" layout="vertical" />
      <Tooltip content={t("fit_window_reset")}>
        <button
          className="px-3 py-2"
          aria-label={t("fit_window_reset")}
          onClick={fit}
        >
          <i className="bi bi-arrows-fullscreen" />
        </button>
      </Tooltip>
    </div>
  );
}
