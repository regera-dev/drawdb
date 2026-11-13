// PostgreSQL forms node-sql-parser rejects, rewritten into ones it parses
// before drawDB's importer sees them. Each rewrite keeps what drawDB can show:
//   REFERENCES t            -> REFERENCES t (<t's primary key>)
//   UNIQUE NULLS [NOT] DISTINCT -> UNIQUE
//   <col> <type> GENERATED ALWAYS AS (<expr>) STORED -> <col> <type>
// Line breaks survive every rewrite, so a parse error still names the line.

const IDENT = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][\w$]*)`;
const NAME = String.raw`${IDENT}(?:\s*\.\s*${IDENT})*`;
const CREATE_TABLE = new RegExp(
  String.raw`\bCREATE\s+(?:(?:GLOBAL|LOCAL)\s+)?(?:TEMP(?:ORARY)?\s+|UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(${NAME})\s*\(`,
  "gi",
);
const SHORT_REFERENCE = new RegExp(
  String.raw`\bREFERENCES\s+(${NAME})(?!\s*\(|\s*\.|[\w$"])`,
  "gi",
);
const TABLE_PRIMARY_KEY =
  /^\s*(?:CONSTRAINT\s+\S+\s+)?PRIMARY\s+KEY\s*\(([^)]*)\)/i;
const COLUMN_PRIMARY_KEY = new RegExp(
  String.raw`^\s*(${IDENT})\s[\s\S]*\bPRIMARY\s+KEY\b`,
  "i",
);
const GENERATED_STORED = /\s+GENERATED\s+ALWAYS\s+AS\s*\(/gi;

/** The index just past the parenthesis that closes the one at `open`. */
function closing(sql, open) {
  let depth = 0;
  for (let i = open; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" || c === '"') {
      i = sql.indexOf(c, i + 1);
      if (i < 0) return -1;
    } else if (c === "(") {
      depth++;
    } else if (c === ")" && --depth === 0) {
      return i + 1;
    }
  }
  return -1;
}

function topLevelItems(body) {
  const items = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "'" || c === '"') {
      const end = body.indexOf(c, i + 1);
      if (end < 0) break;
      i = end;
    } else if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      items.push(body.slice(start, i));
      start = i + 1;
    }
  }
  items.push(body.slice(start));
  return items;
}

/** A table name as PostgreSQL resolves it: the last part, quoted text as is,
 *  bare text folded to lower case. */
function tableKey(name) {
  const last = name.match(new RegExp(IDENT, "g")).at(-1);
  return last.startsWith('"')
    ? last.slice(1, -1).replace(/""/g, '"')
    : last.toLowerCase();
}

function primaryKeys(sql) {
  const keys = new Map();
  for (const match of sql.matchAll(CREATE_TABLE)) {
    const open = match.index + match[0].length - 1;
    const end = closing(sql, open);
    if (end < 0) continue;
    for (const item of topLevelItems(sql.slice(open + 1, end - 1))) {
      const columns =
        TABLE_PRIMARY_KEY.exec(item)?.[1].trim() ??
        COLUMN_PRIMARY_KEY.exec(item)?.[1];
      if (columns) {
        keys.set(tableKey(match[1]), columns);
        break;
      }
    }
  }
  return keys;
}

function withoutStoredGenerations(sql) {
  let out = "";
  let from = 0;
  for (const match of sql.matchAll(GENERATED_STORED)) {
    if (match.index < from) continue;
    const end = closing(sql, match.index + match[0].length - 1);
    const stored = end < 0 ? null : /^\s*STORED\b/i.exec(sql.slice(end));
    if (!stored) continue;
    const cut = sql.slice(match.index, end + stored[0].length);
    out += sql.slice(from, match.index) + cut.replace(/[^\n]/g, "");
    from = end + stored[0].length;
  }
  return out + sql.slice(from);
}

export function normalizePostgres(sql) {
  const generated = withoutStoredGenerations(sql).replace(
    /\bUNIQUE\s+NULLS\s+(?:NOT\s+)?DISTINCT\b/gi,
    "UNIQUE",
  );
  const keys = primaryKeys(generated);
  return generated.replace(SHORT_REFERENCE, (whole, name) => {
    const columns = keys.get(tableKey(name));
    return columns ? `REFERENCES ${name} (${columns})` : whole;
  });
}
