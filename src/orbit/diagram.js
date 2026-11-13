import { Validator } from "jsonschema";
import { isEqual, omit } from "lodash";
import { DB, noteWidth } from "../data/constants";
import { jsonSchema } from "../data/schemas";
import {
  getRelatedFieldKeysByTable,
  getTableHeight,
  getTableWidth,
} from "../utils/utils";
import {
  getViewHeight,
  getViewWidth,
  resolveViewColumns,
} from "../utils/views";

// The ErdDiagram of docs/orbit/bridge.md: drawDB's diagram JSON with exactly
// these top-level keys. Entities pass through untouched, unknown fields too.

export const COLLECTIONS = [
  "tables",
  "relationships",
  "notes",
  "subjectAreas",
  "types",
  "enums",
  "views",
];

const DATABASES = new Set(Object.values(DB));

/** Turns a diagram from the host into an ErdDiagram. Throws an Error naming what is wrong. */
export function parseDiagram(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("diagram must be an object");
  }
  const { errors } = new Validator().validate(input, jsonSchema);
  if (errors.length > 0) {
    throw new Error(
      errors
        .slice(0, 3)
        .map((e) => `${e.property} ${e.message}`)
        .join("; "),
    );
  }
  const database = input.database ?? DB.GENERIC;
  if (!DATABASES.has(database)) {
    throw new Error(`unknown database "${database}"`);
  }
  return toErdDiagram({
    ...input,
    database,
    types: input.types ?? [],
    enums: input.enums ?? [],
    views: input.views ?? [],
  });
}

/** Picks the contract's keys off an editor or input state. */
export function toErdDiagram(state) {
  return {
    database: state.database,
    ...(typeof state.title === "string" && { title: state.title }),
    sqlHeader: state.sqlHeader ?? "",
    tables: state.tables,
    relationships: state.relationships,
    notes: state.notes,
    subjectAreas: state.subjectAreas,
    types: state.types,
    enums: state.enums,
    views: state.views,
  };
}

// Fields the editor writes on its own rather than a person setting them: a note
// measures its text and stores the height (EditorCanvas/Note.jsx). A height
// change alone is never an edit; it rides along with the next real one.
const DERIVED_FIELDS = { notes: ["height"] };

function withoutDerived(collection, items) {
  const fields = DERIVED_FIELDS[collection];
  return fields ? items.map((item) => omit(item, fields)) : items;
}

/** True when b differs from a only in derived fields. */
export function sameEdits(a, b) {
  if (
    a.database !== b.database ||
    a.title !== b.title ||
    a.sqlHeader !== b.sqlHeader
  ) {
    return false;
  }
  return COLLECTIONS.every(
    (c) =>
      a[c] === b[c] ||
      isEqual(withoutDerived(c, a[c]), withoutDerived(c, b[c])),
  );
}

export const hasPosition = (entity) =>
  Number.isFinite(entity.x) && Number.isFinite(entity.y);

/** Every positioned entity's rectangle, sized the way the canvas draws it. */
function entityRects(diagram, { showComments = false } = {}) {
  const relatedFieldKeys = getRelatedFieldKeysByTable(diagram.relationships);
  const rects = [];
  for (const table of diagram.tables) {
    if (!hasPosition(table)) continue;
    rects.push({
      x: table.x,
      y: table.y,
      width: getTableWidth(table),
      height: getTableHeight(
        table,
        showComments,
        relatedFieldKeys.get(table.id),
      ),
    });
  }
  for (const view of diagram.views ?? []) {
    if (!hasPosition(view)) continue;
    rects.push({
      x: view.x,
      y: view.y,
      width: getViewWidth(view),
      height: getViewHeight(
        view,
        resolveViewColumns(view, diagram.tables),
        showComments,
      ),
    });
  }
  for (const area of diagram.subjectAreas ?? []) {
    if (!hasPosition(area)) continue;
    rects.push({
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
    });
  }
  for (const note of diagram.notes ?? []) {
    if (!hasPosition(note)) continue;
    rects.push({
      x: note.x,
      y: note.y,
      width: note.width ?? noteWidth,
      height: note.height ?? 0,
    });
  }
  return rects;
}

/** The box around every positioned entity, or null for an empty diagram. */
export function diagramBounds(diagram, settings) {
  const rects = entityRects(diagram, settings);
  if (rects.length === 0) return null;
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

const FIT_PADDING = 32;

/** The editor transform that shows the whole diagram in a viewport, never above 100%. */
export function fitTransform(diagram, settings, viewport) {
  const box = diagramBounds(diagram, settings);
  if (!box) return { zoom: 1, pan: { x: 0, y: 0 } };
  const pan = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  if (!viewport?.width || !viewport?.height) return { zoom: 1, pan };
  const zoom = Math.min(
    1,
    (viewport.width - 2 * FIT_PADDING) / Math.max(box.width, 1),
    (viewport.height - 2 * FIT_PADDING) / Math.max(box.height, 1),
  );
  const stepped = Math.floor(zoom * 20) / 20;
  return { zoom: stepped > 0 ? stepped : zoom, pan };
}
