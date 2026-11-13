# drawDB for Orbit

This fork of [drawDB](https://github.com/drawdb-io/drawdb) (AGPL-3.0) is the
ERD editor that [Orbit](https://orbt.io) frames on its ERD pages. Orbit never
imports this code. It serves this fork's build as a separate program at
`/erd-app/` and talks to it only through the contract in
[bridge.md](bridge.md). Orbit owns storage, saving, merging and permissions.
The fork loads a diagram, reports a person's edits, and renders previews.

The fork lives at `regera-dev/drawdb` on the branch `orbit/main`. The editor
shows a "Source" link to the exact commit it was built from (AGPL-3.0 §13).

## Changes

Each entry names the date of the change (AGPL-3.0 §5(a)).

### 2026-11-13: PostgreSQL forms the SQL import parses (T-07665)

- `fromSql` with `postgresql` first rewrites three PostgreSQL forms that
  node-sql-parser rejects (`src/orbit/postgres.js`): a `REFERENCES t` with no
  column list names `t`'s primary key from the same DDL, `UNIQUE NULLS [NOT]
  DISTINCT` becomes `UNIQUE`, and a `GENERATED ALWAYS AS (...) STORED` clause
  is dropped so the column imports with its type. Line breaks survive, so a
  parse error still names its line.

### 2026-11-13: A slimmer embed header (T-07664)

- Orbit's page bar already names the page, so the embed hides drawDB's logo
  and its "Diagrams / <title>" line with two new `hiddenControls` ids,
  `header.logo` and `header.title`
  (`src/components/EditorHeader/ControlPanel.jsx`). The title line holds the
  database icon too. The File, Edit, View, Settings and Help menus stay.
- The Source link moved out of the canvas, where a table could sit under it:
  into the header's `header-actions-end` slot in edit mode, beside the zoom
  controls in view mode, and to the canvas corner only while a person has
  hidden the header (`src/orbit/EmbedEditor.jsx`, `src/orbit/SourceLink.jsx`).

### 2026-11-13: Orbit embed, headless render and stable ids (T-07661)

New code, all under `src/orbit/` unless named:

- `npm run build:orbit` (`vite.orbit.config.js`) builds `dist/` with base
  `/erd-app/` from two entry documents, `embed.html` and `headless.html`. It
  bakes the git commit into the Source link and copies Monaco's `min/vs` build
  to `dist/monaco/vs`. `npm run build` still builds upstream's app.
- `embed.html` is the editor for Orbit's iframe, in `?mode=edit` (default) or
  `?mode=view` (read-only: no header, no side panel, pan, zoom and inspect).
  It speaks the postMessage bridge of [bridge.md](bridge.md)
  (`useOrbitBridge.js`). A `change` is the editor state differing from the
  diagram Orbit last sent or was last sent, so `init` and `remote` never
  cause one. A note's measured `height` alone is not an edit.
- `headless.html` exposes `window.orbitErd` (`fromSql`, `fromDbml`, `arrange`,
  `render`) for Orbit's offline render browser.
- Neither entry touches IndexedDB, GitHub gists, analytics, the AI import, the
  landing, templates or bug-report pages, or any host but its own. Font
  Awesome and Bootstrap Icons come from npm (`src/orbit/styles.js`), not from
  the CDNs in `index.html`, and Monaco loads from `/erd-app/monaco/vs`, not
  jsDelivr.

Changes to upstream files, kept narrow so upstream merges stay easy:

- `src/components/EditorHeader/ControlPanel.jsx`: an embedder can hide menu
  items, header items and toolbar buttons with the extension
  `hiddenControls`, a `Set` of ids such as `file.open`, `header.share` or
  `toolbar.versions`. A hidden item's hotkey does nothing. The embed hides
  open, new, save, save as, rename, delete, templates, share, version history,
  the theme switch, autosave, custom types and the local storage tools, and,
  since T-07664, the logo and the title line.
- `src/components/EditorHeader/Modal/Open/hooks/useDiagramList.js`: takes
  `{ enabled }`, so the recent-diagrams list does not query IndexedDB when
  that menu item is hidden.
- Notes keep their id for life. Upstream gave a note its array index as id and
  renumbered every note when one was added or deleted. New notes get a nanoid,
  numeric ids from older diagrams are kept as given, and undo, redo, copy,
  paste, duplicate and the notes tab find notes by id
  (`src/context/NotesContext.jsx`, `ControlPanel.jsx`,
  `src/components/EditorSidePanel/NotesTab/`). `src/data/schemas.js` accepts
  string note ids.
- Importing SQL into an existing diagram no longer renumbers every
  relationship by index (`src/components/EditorHeader/Modal/Modal.jsx`). The
  AI import gives its relationships nanoid ids (`src/utils/importAiDiagram.js`),
  as the other importers already do.
- `README.md` links here.

Indices, unique constraints and a type's fields still use their position as
id, as upstream does. Orbit matches them by name, not id.

## Build and publish

```bash
npm ci
npm run build:orbit
```

Build from a clean checkout at the commit you publish. The build warns when
the tree has uncommitted changes, because the Source link would name a commit
that does not contain them.

Orbit serves `dist/` same-origin at `/erd-app/` and answers `/erd-app/embed`
with `embed.html`, the way it hosts its design editor at `/design-app/`.
