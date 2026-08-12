"use strict";
import util = require("util");
import types = require("../types");
import { Row } from "../types";

/**
 * Numeric value representing the kind of a CQL index.
 * @alias module:metadata~IndexKind
 */
enum IndexKind {
    custom = 0,
    keys = 1,
    composites = 2,
}

/**
 * Describes a CQL index.
 * @alias module:metadata~Index
 */
class Index {
    /**
     * Name of the index.
     */
    name: string;

    /**
     * Target of the index.
     */
    target: string;

    /**
     * A numeric value representing index kind (0: custom, 1: keys, 2: composite);
     */
    kind: IndexKind;

    /**
     * An associative array containing the index options
     */
    options: Record<string, any>;

    /**
     * Creates a new Index instance.
     * @internal
     * @ignore
     */
    constructor(
        name: string,
        target: string,
        kind: IndexKind | string,
        options: Record<string, any>,
    ) {
        this.name = name;
        this.target = target;
        this.kind = typeof kind === "string" ? getKindByName(kind) : kind;
        this.options = options;
    }
    /**
     * Parses Index information from rows in the 'system_schema.indexes' table
     * @deprecated It will be removed in the next major version.
     */
    static fromRows(indexRows: Row[]): Index[] {
        if (!indexRows || indexRows.length === 0) {
            return [];
        }
        return indexRows.map(function (row) {
            const options = row["options"];
            return new Index(
                row["index_name"],
                options["target"],
                getKindByName(row["kind"]),
                options,
            );
        });
    }
    /**
     * Parses Index information from rows in the legacy 'system.schema_columns' table.
     * @deprecated It will be removed in the next major version.
     */
    static fromColumnRows(
        columnRows: Row[],
        columnsByName: Record<string, any>,
    ): Index[] {
        const result: Index[] = [];
        for (let i = 0; i < columnRows.length; i++) {
            const row = columnRows[i];
            const indexName = row["index_name"];
            if (!indexName) {
                continue;
            }
            const c = columnsByName[row["column_name"]];
            let target;
            const options = JSON.parse(row["index_options"]);
            if (options !== null && options["index_keys"] !== undefined) {
                target = util.format("keys(%s)", c.name);
            } else if (
                options !== null &&
                options["index_keys_and_values"] !== undefined
            ) {
                target = util.format("entries(%s)", c.name);
            } else if (
                c.type.options?.frozen &&
                (c.type.code === types.dataTypes.map ||
                    c.type.code === types.dataTypes.list ||
                    c.type.code === types.dataTypes.set)
            ) {
                target = util.format("full(%s)", c.name);
            } else {
                target = c.name;
            }
            result.push(
                new Index(
                    indexName,
                    target,
                    getKindByName(row["index_type"]),
                    options,
                ),
            );
        }
        return result;
    }
    /**
     * Determines if the index is of composites kind
     */
    isCompositesKind(): boolean {
        return this.kind === IndexKind.composites;
    }
    /**
     * Determines if the index is of keys kind
     */
    isKeysKind(): boolean {
        return this.kind === IndexKind.keys;
    }
    /**
     * Determines if the index is of custom kind
     */
    isCustomKind(): boolean {
        return this.kind === IndexKind.custom;
    }
}

/**
 * Maps the lowercase index kind name (as it appears in schema rows) to its {@link IndexKind}.
 * @private
 */
const kindsByName: Record<string, IndexKind> = {
    custom: IndexKind.custom,
    keys: IndexKind.keys,
    composites: IndexKind.composites,
};

/**
 * Gets the number representing the kind based on the name
 * @private
 */
function getKindByName(name: string): IndexKind {
    if (!name) {
        return IndexKind.custom;
    }
    return kindsByName[name.toLowerCase()];
}

export { Index, IndexKind };
