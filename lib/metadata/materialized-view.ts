"use strict";

import { TableMetadata, ColumnMetadata } from "./table-metadata";

/**
 * Describes a CQL materialized view.
 * @alias module:metadata~MaterializedView
 * @extends TableMetadata
 */
class MaterializedView extends TableMetadata {
    /**
     * Name of the table.
     */
    tableName: string;

    /**
     * Constructs a MaterializedView instance.
     *
     * @param {Record<string, ColumnMetadata>} columns Columns of the view, keyed by name.
     * @param {string[]} partitionKey Names of the view's partition key columns.
     * @param {string[]} clusteringKey Names of the view's clustering key columns.
     * @param {string | null} partitioner Partitioner of the view, if it overrides the default.
     * @param {string} tableName Name of the table the view is built from.
     * @internal
     * @ignore
     */
    constructor(
        columns: Record<string, ColumnMetadata>,
        partitionKey: string[],
        clusteringKey: string[],
        partitioner: string | null,
        tableName: string,
    ) {
        super(columns, partitionKey, clusteringKey, partitioner);
        this.tableName = tableName;
    }
}

export { MaterializedView };
