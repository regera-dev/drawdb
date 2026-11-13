/* global __ORBIT_COMMIT__ */

// AGPL-3.0 §13: people who use the editor over a network get a link to the
// Corresponding Source of the exact build they run. vite.orbit.config.js bakes
// in the commit. Callers place it in the editor's chrome (the header, the view
// controls), never over the canvas, so no table or toolbar covers it.
export const SOURCE_URL = `https://github.com/regera-dev/drawdb/tree/${__ORBIT_COMMIT__}`;

export default function SourceLink({ className = "" }) {
  return (
    <a
      href={SOURCE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Source code of this drawDB build (AGPL-3.0)"
      className={`text-xs text-zinc-500 hover:underline ${className}`}
    >
      Source
    </a>
  );
}
