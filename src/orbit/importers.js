import { Parser } from "node-sql-parser";
import { Parser as OracleParser } from "oracle-sql-parser";
import { DB } from "../data/constants";
import { importSQL } from "../utils/importSQL";
import { fromDBML } from "../utils/importFrom/dbml";
import { arrangeDiagram } from "./arrange";
import { normalizePostgres } from "./postgres";

function located(error) {
  const at = error.location?.start;
  return at
    ? `${error.name ?? "Error"} at line ${at.line}, column ${at.column}: ${error.message}`
    : error.message;
}

// The importers place tables on a placeholder grid that the editor always
// replaces with its auto-arrange (Modal.jsx, arrangeImported). Drop the grid
// and let arrangeDiagram place them the same way.
function placed({ tables, relationships, types, enums }, database) {
  return arrangeDiagram({
    database,
    sqlHeader: "",
    tables: tables.map((table) => {
      const unplaced = { ...table };
      delete unplaced.x;
      delete unplaced.y;
      return unplaced;
    }),
    relationships,
    notes: [],
    subjectAreas: [],
    types: types ?? [],
    enums: enums ?? [],
    views: [],
  });
}

/** SQL DDL in the given database's dialect to an arranged ErdDiagram. */
export function fromSql(sql, database) {
  if (database === DB.GENERIC || !Object.values(DB).includes(database)) {
    throw new Error(
      `fromSql needs the dialect the SQL is written in (one of ${Object.values(
        DB,
      )
        .filter((db) => db !== DB.GENERIC)
        .join(", ")}), got "${database}"`,
    );
  }
  let ast;
  try {
    ast =
      database === DB.ORACLESQL
        ? new OracleParser().parse(sql)
        : new Parser().astify(
            database === DB.POSTGRES ? normalizePostgres(sql) : sql,
            { database },
          );
  } catch (error) {
    throw new Error(located(error));
  }
  let imported;
  try {
    imported = importSQL(ast, database, database);
  } catch (error) {
    throw new Error(`could not convert the parsed SQL: ${error.message}`);
  }
  return placed(imported, database);
}

const DBML_DATABASE_TYPES = [
  [/postgres/i, DB.POSTGRES],
  [/mariadb/i, DB.MARIADB],
  [/mysql/i, DB.MYSQL],
  [/sqlite/i, DB.SQLITE],
  [/sql ?server|mssql/i, DB.MSSQL],
  [/oracle/i, DB.ORACLESQL],
];

/** The database a DBML `Project { database_type: '...' }` names, else generic. */
function dbmlDatabase(dbml) {
  const type = /database_type\s*:\s*['"]([^'"]+)['"]/i.exec(dbml)?.[1];
  if (!type) return DB.GENERIC;
  return (
    DBML_DATABASE_TYPES.find(([name]) => name.test(type))?.[1] ?? DB.GENERIC
  );
}

/** DBML to an arranged ErdDiagram, for the database its Project names. */
export function fromDbml(dbml) {
  const database = dbmlDatabase(dbml);
  let imported;
  try {
    imported = fromDBML(dbml, database);
  } catch (error) {
    const diag = error.diags?.[0];
    throw new Error(
      diag
        ? located({
            name: diag.name,
            location: diag.location,
            message: diag.message,
          })
        : error.message,
    );
  }
  return placed(imported, database);
}
