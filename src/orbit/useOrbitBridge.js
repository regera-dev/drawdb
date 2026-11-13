import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { ObjectType } from "../data/constants";
import {
  useAreas,
  useDiagram,
  useEnums,
  useLayout,
  useNotes,
  useSelect,
  useSettings,
  useTransform,
  useTypes,
  useUndoRedo,
  useViews,
} from "../hooks";
import { BRIDGE_VERSION, THEMES, postToHost, readHostMessage } from "./bridge";
import { fitTransform, parseDiagram, sameEdits, toErdDiagram } from "./diagram";

// Edits closer together than this go out as one `change`. The contract allows
// up to 300 ms after the last edit.
const COALESCE_MS = 150;

// The collection a selected canvas element lives in, to drop a selection whose
// entity a `remote` removed.
const SELECTED_COLLECTION = {
  [ObjectType.TABLE]: "tables",
  [ObjectType.AREA]: "subjectAreas",
  [ObjectType.NOTE]: "notes",
  [ObjectType.RELATIONSHIP]: "relationships",
  [ObjectType.VIEW]: "views",
};

/**
 * Speaks docs/orbit/bridge.md for the embed. A `change` is the editor state
 * differing from `synced`, the diagram the host last sent or was last sent.
 * `init` and `remote` move `synced` along with the state they apply, so only
 * a person's edits (undo and redo included) ever differ from it.
 */
export function useOrbitBridge({ readOnlyMode, title, setTitle }) {
  const {
    database,
    setDatabase,
    sqlHeader,
    setSqlHeader,
    tables,
    setTables,
    relationships,
    setRelationships,
  } = useDiagram();
  const { notes, setNotes } = useNotes();
  const { areas, setAreas } = useAreas();
  const { types, setTypes } = useTypes();
  const { enums, setEnums } = useEnums();
  const { views, setViews } = useViews();
  const { setUndoStack, setRedoStack } = useUndoRedo();
  const { setSelectedElement, setBulkSelectedElements } = useSelect();
  const { setLayout } = useLayout();
  const { settings, setSettings } = useSettings();
  const { setTransform } = useTransform();

  const liveRef = useRef(null);
  liveRef.current = toErdDiagram({
    database,
    title,
    sqlHeader,
    tables,
    relationships,
    notes,
    subjectAreas: areas,
    types,
    enums,
    views,
  });
  const syncedRef = useRef(null);
  const timerRef = useRef(null);

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    const live = liveRef.current;
    if (!syncedRef.current || sameEdits(syncedRef.current, live)) return;
    syncedRef.current = live;
    postToHost("change", { diagram: live });
  }, []);

  useEffect(() => {
    if (!syncedRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, COALESCE_MS);
  }, [
    database,
    title,
    sqlHeader,
    tables,
    relationships,
    notes,
    areas,
    types,
    enums,
    views,
    flush,
  ]);

  useLayoutEffect(() => {
    if (readOnlyMode) setLayout((prev) => ({ ...prev, readOnly: true }));
  }, [readOnlyMode, setLayout]);

  const applyTheme = (theme) => {
    if (!THEMES.has(theme)) return;
    setSettings((prev) =>
      prev.mode === theme ? prev : { ...prev, mode: theme },
    );
  };

  const applyDiagram = (diagram) => {
    setDatabase(diagram.database);
    setTitle(diagram.title);
    setSqlHeader(diagram.sqlHeader);
    setTables(diagram.tables);
    setRelationships(diagram.relationships);
    setNotes(diagram.notes);
    setAreas(diagram.subjectAreas);
    setTypes(diagram.types);
    setEnums(diagram.enums);
    setViews(diagram.views);
  };

  const parsedOrError = (message) => {
    try {
      return parseDiagram(message.diagram);
    } catch (error) {
      postToHost("error", { message: `${message.type}: ${error.message}` });
      return null;
    }
  };

  const init = (message) => {
    const diagram = parsedOrError(message);
    if (!diagram) return;
    clearTimeout(timerRef.current);
    syncedRef.current = diagram;
    applyDiagram(diagram);
    setUndoStack([]);
    setRedoStack([]);
    setSelectedElement((prev) => ({
      ...prev,
      element: ObjectType.NONE,
      id: -1,
      open: false,
    }));
    setBulkSelectedElements([]);
    setLayout((prev) => ({
      ...prev,
      readOnly: readOnlyMode || message.readOnly === true,
    }));
    applyTheme(message.theme);
    setTransform(
      fitTransform(
        diagram,
        settings,
        document.getElementById("canvas")?.getBoundingClientRect(),
      ),
    );
  };

  const remote = (message) => {
    const diagram = parsedOrError(message);
    if (!diagram) return;
    flush();
    syncedRef.current = diagram;
    applyDiagram(diagram);
    setSelectedElement((prev) => {
      const collection = SELECTED_COLLECTION[prev.element];
      if (!collection || diagram[collection].some((e) => e.id === prev.id)) {
        return prev;
      }
      return { ...prev, element: ObjectType.NONE, id: -1, open: false };
    });
  };

  const handlers = { init, remote, theme: (m) => applyTheme(m.theme) };
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onMessage = (event) => {
      const message = readHostMessage(event);
      const handlers = handlersRef.current;
      if (message && Object.hasOwn(handlers, message.type)) {
        handlers[message.type](message);
      }
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("pagehide", flush);
    postToHost("ready", { version: BRIDGE_VERSION });
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("pagehide", flush);
    };
  }, [flush]);
}
