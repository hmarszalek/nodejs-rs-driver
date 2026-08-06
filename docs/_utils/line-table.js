/**
 * Precompute a {generated_line: original_line} table from the source maps
 * emitted by the docs build.
 *
 * JSDoc parses the compiled `.js`, whose line numbers drift from the `.ts`
 * sources because `tsc` strips blank lines and collapses statements.  The
 * drift is not constant, so the docs extension needs a real mapping.  This
 * script converts each `.js.map` down to a plain line lookup so that
 * `jsdoc_content.py` only has to read JSON.
 *
 * Usage: node _utils/line-table.js <sourcemap-dir> <source-path>
 *
 * Reads   <sourcemap-dir>/<source-path>/**\/*.js.map
 * Writes  <sourcemap-dir>/line-table.json
 *
 * Keys are paths relative to <source-path>, matching what JSDoc reports.
 */

const fs = require("fs");
const path = require("path");
const { SourceMap } = require("node:module");

const MAX_COLUMN = 512;

function firstEntryOnLine(sourceMap, line) {
    for (let column = 0; column < MAX_COLUMN; column += 1) {
        const entry = sourceMap.findEntry(line, column);
        if (entry && entry.generatedLine === line) {
            return entry;
        }
    }
    return null;
}

function buildLineMap(mapFile) {
    const payload = JSON.parse(fs.readFileSync(mapFile, "utf8"));
    const sourceMap = new SourceMap(payload);
    // One entry per line of the compiled file.
    const generated = (payload.mappings || "").split(";").length;
    const lineMap = {};
    for (let line = 0; line < generated; line += 1) {
        const entry = firstEntryOnLine(sourceMap, line);
        if (entry && entry.originalLine !== undefined) {
            // Source maps are 0-based; editors and GitHub anchors are 1-based.
            lineMap[line + 1] = entry.originalLine + 1;
        }
    }
    return lineMap;
}

function findMaps(dir, found = []) {
    if (!fs.existsSync(dir)) return found;
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) findMaps(full, found);
        else if (item.name.endsWith(".js.map")) found.push(full);
    }
    return found;
}

function main() {
    const [sourcemapDir, sourcePath = "lib"] = process.argv.slice(2);
    if (!sourcemapDir) {
        console.error("usage: line-table.js <sourcemap-dir> [source-path]");
        process.exit(2);
    }

    const root = path.join(sourcemapDir, sourcePath);
    const maps = findMaps(root);
    const table = {};

    for (const mapFile of maps) {
        // ".js.map" -> ".js", relative to the source path, as JSDoc reports it.
        const key = path.relative(root, mapFile).replace(/\.map$/, "");
        try {
            table[key] = buildLineMap(mapFile);
        } catch (err) {
            console.error(`line-table: skipping ${key}: ${err.message}`);
        }
    }

    const out = path.join(sourcemapDir, "line-table.json");
    fs.writeFileSync(out, JSON.stringify(table));
    console.log(`line-table: ${Object.keys(table).length} files -> ${out}`);
}

main();
