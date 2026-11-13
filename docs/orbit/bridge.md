# ERD bridge contract (T-07659)

The contract between Orbit and the drawDB fork (`regera-dev/drawdb`, branch
`orbit/main`). Orbit never imports fork code: the fork is AGPL-3.0 and runs as
a separate program. The two talk only through this contract.

- Orbit side: `src/lib/erd/bridge.ts` holds these types (Orbit's copy).
- Fork side: `src/orbit/bridge.js` implements them, `docs/orbit/bridge.md`
  copies this file.

## Hosting

The fork builds with `npm run build:orbit` into `dist/` with Vite `base:
"/erd-app/"`. Orbit serves `dist/` same-origin at `/erd-app/` (like
`/design-app/`, see Orbit `docs/designs.md`, "Hosting the editor").

Two entry documents:

- `/erd-app/embed.html` (or the SPA route `/erd-app/embed`): the editor for an
  iframe. Query `?mode=edit` (default) or `?mode=view` (read-only, for share
  links: no side panel, no header menus, pan and zoom only).
- `/erd-app/headless.html`: no UI chrome; exposes `window.orbitErd` for
  Orbit's offline render browser (Playwright). It must work with every network
  request blocked except files under its own origin.

Neither entry touches IndexedDB, gists, analytics, or any third-party host.
Both show nothing from drawDB's landing page, templates, or bug report pages.

## Diagram JSON (`ErdDiagram`)

drawDB's own diagram JSON, the shape `src/data/schemas.js` `jsonSchema`
validates, with these keys and nothing else at the top level:

```ts
type ErdDiagram = {
  database: string;          // drawDB's DB enum value (src/data/constants.js): "generic", "mysql", "postgresql", "sqlite", "mariadb", "transactsql", "oraclesql"
  title?: string;
  sqlHeader?: string;
  tables: Table[];           // drawDB table objects, ids string | number
  relationships: Relationship[];
  notes: Note[];             // ids are stable strings (nanoid) in the fork; old numeric ids are accepted as given
  subjectAreas: Area[];
  types: Type[];
  enums: Enum[];
  views: View[];
};
```

Every entity keeps a stable id for its lifetime. The fork must never renumber
ids (upstream renumbers notes by index on delete; the fork stops that).
Unknown entity fields pass through unchanged in both directions.

## Messages

`window.postMessage` between the Orbit page and the iframe. Both sides accept
a message only when `event.origin === window.location.origin` and
`event.source` is the expected window. Every message is an object
`{ source: "orbit-erd", type, ... }`; anything else is ignored.

### Frame to host

| type | fields | when |
| --- | --- | --- |
| `ready` | `version: 2` | The editor mounted and can take `init`. Sent once per load. |
| `change` | `diagram: ErdDiagram`, `generation: number` | After a person's edit changed the diagram (including undo/redo). Never after `init` or `remote`. `generation` is that of the last `init` or `remote` the frame applied before the edit. The frame may coalesce edits but sends within 300 ms of the last one. |
| `applied` | `generation: number` | The frame applied the `init` or `remote` with this generation. Every later `change` names it or a newer one. |
| `error` | `message: string` | The frame could not apply `init` or `remote` (bad diagram or generation). |

### Host to frame

| type | fields | effect |
| --- | --- | --- |
| `init` | `generation`, `diagram`, `readOnly: boolean`, `theme: "light" \| "dark"` | Replaces the editor state, clears undo and redo, and fits the view to the diagram (an empty diagram stays at 100%). |
| `remote` | `generation`, `diagram` | The board's newer state (another person's or an agent's save). Replaces the editor state without entering the undo stack and without emitting `change`. Keeps the viewport, the selection when the selected entity still exists, and an open side-panel item. |
| `theme` | `theme` | Switches light or dark. |

### Generations

The host numbers each `init` and `remote` it sends, rising by one each time
(a whole number, 0 or more). Before the frame applies an `init` or `remote`,
it sends any edit still waiting to go out, as a `change` that names the
previous generation. Then it applies the new state and answers `applied`.

A `change` that names an older generation than the host's latest was made
before the frame saw the newer state. The host replays that change's edits,
measured from the diagram it sent under that generation, onto its latest
diagram, and sends the result as a new `remote`. The host keeps each diagram
it sent until an `applied` or `change` names a newer generation. A
`change` that names a generation the host never sent is a protocol error.

## `window.orbitErd` (headless entry)

```ts
interface OrbitErd {
  /** Resolves once the module is ready. */
  ready: Promise<void>;
  /** SQL DDL to a diagram, using drawDB's importer for that database. Throws an Error whose message names the parse failure. */
  fromSql(sql: string, database: string): ErdDiagram;
  /** DBML to a diagram. Throws like fromSql. */
  fromDbml(dbml: string): ErdDiagram;
  /** Places every table or view without a finite x and y, and gives a width to any table without one, with drawDB's own arrange. Never moves a table that already has a position. Pure: returns a new diagram. */
  arrange(diagram: ErdDiagram): ErdDiagram;
  /** Draws the diagram read-only into document.body at 1:1, sized to its bounding box plus 24 px padding, in the theme. Resolves with that box once fonts and layout settled, so the caller can screenshot `#orbit-erd-render`. `region` clips to that rectangle in diagram coordinates. */
  render(diagram: ErdDiagram, opts: { theme: "light" | "dark"; region?: { x: number; y: number; width: number; height: number } }): Promise<{ width: number; height: number }>;
}
```

## AGPL notice

The embed entry shows a small "Source" link (menu or footer, in both modes)
to `https://github.com/regera-dev/drawdb/tree/<commit>` where `<commit>` is
the build's git commit, baked in at build time. That is how users who interact
with the editor over the network get the Corresponding Source (AGPL-3.0 §13).
