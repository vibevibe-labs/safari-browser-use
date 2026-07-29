function googleSheetsTarget(value) {
  if (typeof value === "string") {
    return parseGoogleSheetsUrl(value);
  }

  if (
    !value ||
    typeof value !== "object" ||
    !/^[A-Za-z0-9_-]+$/.test(String(value.spreadsheetId || ""))
  ) {
    throw new Error("invalid_google_sheets_target");
  }

  const target = {
    spreadsheetId: String(value.spreadsheetId)
  };

  if (value.uid !== undefined) {
    const uid = Number(value.uid);

    if (!Number.isInteger(uid) || uid < 0) {
      throw new Error("invalid_google_account_uid");
    }

    target.uid = uid;
  }

  if (value.gid !== undefined) {
    target.gid = String(value.gid);
  }

  return target;
}

function tsvCell(value) {
  const text = value === undefined || value === null
    ? ""
    : String(value);

  return /[\t\n\r"]/.test(text)
    ? `"${text.replace(/"/g, "\"\"")}"`
    : text;
}

export function matrixToTsv(data) {
  if (!Array.isArray(data)) {
    throw new Error("invalid_google_sheets_matrix");
  }

  return data
    .map(row => {
      if (!Array.isArray(row)) {
        throw new Error("invalid_google_sheets_matrix");
      }

      return row.map(tsvCell).join("\t");
    })
    .join("\n");
}

function parseTsvRows(tsv) {
  const source = String(tsv).replace(/\r\n?/g, "\n");
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < source.length; index++) {
    const character = source[index];

    if (quoted) {
      if (character === "\"" && source[index + 1] === "\"") {
        value += "\"";
        index++;
      } else if (character === "\"") {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }

    if (character === "\"" && value === "") {
      quoted = true;
    } else if (character === "\t") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value);
  rows.push(row);
  return rows;
}

function columnLetter(index) {
  let number = Number(index) + 1;
  let result = "";

  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }

  return result;
}

function typedCellValue(value) {
  if (value === "TRUE" || value === "FALSE") {
    return {
      value: value === "TRUE",
      valueType: "boolean"
    };
  }

  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) {
    return {
      value: Number(value),
      valueType: "number"
    };
  }

  return { value, valueType: "string" };
}

export function tsvToSheetData(tsv, sheet) {
  const rows = parseTsvRows(tsv);
  const cols = rows.reduce(
    (maximum, row) => Math.max(maximum, row.length),
    0
  );
  const cells = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((value, col) => {
      if (value === "") {
        return;
      }

      const typed = typedCellValue(value);
      const colLetter = columnLetter(col);

      cells.push({
        cell: `${colLetter}${rowIndex + 1}`,
        row: rowIndex + 1,
        col,
        colLetter,
        value: typed.value,
        valueType: typed.valueType
      });
    });
  });

  return {
    name: String(sheet.name || ""),
    gid: String(sheet.gid || "0"),
    gridId: String(sheet.gridId || sheet.gid || "0"),
    size: { rows: rows.length, cols },
    cells
  };
}

export function parseGoogleSheetsBootstrap(html) {
  const match =
    /var\s+bootstrapData\s*=\s*(\{[\s\S]*?\});\s*function\s+loadWaffle\b/
      .exec(String(html));

  if (!match) {
    throw new Error("google_sheets_bootstrap_not_found");
  }

  const bootstrap = JSON.parse(match[1]);
  const sheets = [];
  const seen = {};

  function visit(value) {
    if (Array.isArray(value)) {
      if (
        value[0] === 21350203 &&
        typeof value[1] === "string"
      ) {
        try {
          const model = JSON.parse(value[1]);
          const gid = String(model[2]);
          const properties = Array.isArray(model[3])
            ? model[3]
            : [];
          let name = "";

          for (const property of properties) {
            const commands = property && property["1"];

            if (!Array.isArray(commands)) {
              continue;
            }

            for (const command of commands) {
              if (
                Array.isArray(command) &&
                command[0] === 0 &&
                command[1] === 0 &&
                typeof command[2] === "string"
              ) {
                name = command[2];
                break;
              }
            }

            if (name) {
              break;
            }
          }

          if (
            name &&
            !Object.prototype.hasOwnProperty.call(seen, gid)
          ) {
            seen[gid] = true;
            sheets.push({
              name,
              gid,
              gridId: gid,
              size: {
                rows: Number(model[4]),
                cols: Number(model[5])
              }
            });
          }
        } catch (error) {
          // Ignore unrelated or partial structure commands.
        }
      }

      value.forEach(visit);
      return;
    }

    if (value && typeof value === "object") {
      Object.keys(value).forEach(key => visit(value[key]));
    }
  }

  visit(bootstrap);

  if (sheets.length === 0) {
    throw new Error("google_sheets_metadata_not_found");
  }

  return sheets;
}

export function parseGoogleSheetsUrl(url) {
  const source = String(url);
  const match =
    /^https:\/\/docs\.google\.com\/spreadsheets(?:\/u\/(\d+))?\/d\/([A-Za-z0-9_-]+)(?:[/?#]|$)/i
      .exec(source);

  if (!match) {
    throw new Error("invalid_google_sheets_url");
  }

  const result = { spreadsheetId: match[2] };
  const gid = /[#&?]gid=([^&#]+)/i.exec(source);

  if (match[1] !== undefined) {
    result.uid = Number(match[1]);
  }

  if (gid) {
    result.gid = decodeURIComponent(gid[1]);
  }

  return result;
}

export function createGoogleSheets({
  readSpreadsheet,
  readSheet,
  openEditor
}) {
  let session = null;

  function connected() {
    if (!session) {
      throw new Error("google_sheets_not_connected");
    }

    return session;
  }

  function connect(url) {
    if (session) {
      throw new Error("google_sheets_already_connected");
    }

    session = openEditor(String(url));
  }

  function create(uid) {
    const target = googleSheetsTarget({
      spreadsheetId: "create",
      uid
    });
    const url =
      `https://docs.google.com/spreadsheets/u/${target.uid}/create`;

    connect(url);

    const finalUrl = connected().url();
    const created = parseGoogleSheetsUrl(finalUrl);
    const result = {
      spreadsheetId: created.spreadsheetId,
      uid: created.uid === undefined ? target.uid : created.uid
    };

    if (created.gid !== undefined) {
      result.gid = created.gid;
    }

    result.url = finalUrl;
    return result;
  }

  return Object.freeze({
    parseUrl: parseGoogleSheetsUrl,
    getSpreadsheetInfo(target) {
      return readSpreadsheet(googleSheetsTarget(target));
    },
    readSheet(target, gid) {
      const parsed = googleSheetsTarget(target);
      const selectedGid = gid === undefined ? parsed.gid : String(gid);
      return readSheet(parsed, selectedGid);
    },
    readAllSheets(target) {
      const parsed = googleSheetsTarget(target);
      const info = readSpreadsheet(parsed);

      return info.sheets.map(sheet =>
        readSheet(parsed, String(sheet.gid))
      );
    },
    connect,
    create,
    dispose() {
      if (!session) {
        return;
      }

      const active = session;
      session = null;
      active.close();
    },
    writeMatrix(range, data) {
      return connected().writeTsv(
        String(range),
        matrixToTsv(data)
      );
    },
    writeTsv(range, tsv) {
      return connected().writeTsv(String(range), String(tsv));
    },
    writeHtml(range, html) {
      return connected().writeHtml(String(range), String(html));
    },
    navigateToCell(cell) {
      return connected().navigateToCell(String(cell));
    },
    switchSheet(gid) {
      return connected().switchSheet(String(gid));
    },
    readSelection() {
      return connected().readSelection();
    }
  });
}
