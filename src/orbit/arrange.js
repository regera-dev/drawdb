import { tableWidth } from "../data/constants";
import { autoArrange } from "../utils/autoArrange";
import { getViewWidth } from "../utils/views";
import { diagramBounds, hasPosition } from "./diagram";

// The gap drawDB's own import leaves between the tables already on the canvas
// and the imported ones it lays out below them (Modal.jsx, arrangeImported).
const BELOW_GAP = 110;
const VIEW_GAP = 60;

const withWidth = (table) =>
  typeof table.width === "number" && table.width > 0
    ? table
    : { ...table, width: tableWidth };

/**
 * Places every table and view that has no finite x and y, and gives a width to
 * every table without one. Tables go through drawDB's dagre auto-arrange and
 * land below whatever is already positioned; views follow in a row under them.
 * Positioned entities never move. Returns a new diagram.
 */
export function arrangeDiagram(diagram, settings = { showComments: false }) {
  const tables = diagram.tables.map(withWidth);
  const views = diagram.views ?? [];
  const unplacedTables = tables.filter((t) => !hasPosition(t));
  const unplacedViews = views.filter((v) => !hasPosition(v));
  if (unplacedTables.length === 0 && unplacedViews.length === 0) {
    return { ...diagram, tables };
  }

  const placedBox = diagramBounds(
    {
      ...diagram,
      tables: tables.filter(hasPosition),
      views: views.filter(hasPosition),
    },
    settings,
  );
  const origin = placedBox
    ? { x: placedBox.x, y: placedBox.y + placedBox.height + BELOW_GAP }
    : { x: 0, y: 0 };

  const positions = new Map(
    autoArrange(
      unplacedTables.map((t) => ({ ...t, locked: false })),
      diagram.relationships ?? [],
      settings,
    ).map((p) => [p.id, { x: origin.x + p.x, y: origin.y + p.y }]),
  );
  const arrangedTables = tables.map((t) =>
    positions.has(t.id) ? { ...t, ...positions.get(t.id) } : t,
  );

  const tablesBox = diagramBounds(
    { ...diagram, tables: arrangedTables, views: views.filter(hasPosition) },
    settings,
  );
  let x = origin.x;
  const y = tablesBox ? tablesBox.y + tablesBox.height + BELOW_GAP : origin.y;
  const arrangedViews = views.map((view) => {
    if (hasPosition(view)) return view;
    const placed = { ...view, x, y };
    x += getViewWidth(view) + VIEW_GAP;
    return placed;
  });

  return { ...diagram, tables: arrangedTables, views: arrangedViews };
}
