"use strict";

/**
 * Module containing classes and fields related to metadata.
 * @module metadata
 */

import { token, ValueCallback } from "../..";
// TODO: remove once `lib/promise-utils.js` is converted to typescript.
// @ts-ignore
import promiseUtils = require("../promise-utils");
import { Host } from "../host";
import types = require("../types");
import { ColumnInfo } from "../types/cql-utils";

import { Udt } from "./user-defined-type";
import { TableMetadata } from "./table-metadata";
import { MaterializedView } from "./materialized-view";
import { KeyspaceMetadata } from "../../index";
import { SchemaFunction } from "./schema-function";
import { Aggregate } from "./aggregate";
import { QueryTrace } from "./query-trace";
import ClientState = require("./client-state");
import { SessionWrapper as RustClient } from "../../index";

export { QueryTrace, TracingEvent } from "./query-trace";
export { Aggregate } from "./aggregate";
export { SchemaFunction } from "./schema-function";
export { Index, IndexKind } from "./schema-index";
export { TableMetadata, ColumnMetadata, ColumnKind } from "./table-metadata";
export { MaterializedView } from "./materialized-view";
export { Udt, UdtField } from "./user-defined-type";
export { KeyspaceMetadata } from "../../index";
export type {
    SimpleStrategy,
    NetworkTopologyStrategy,
    LocalStrategy,
    OtherStrategy,
    Strategy,
} from "./strategy";
export { StrategyKind } from "./strategy";
export { ClientState };

/**
 * @const
 * @private
 */
const _selectSchemaVersionPeers = "SELECT schema_version FROM system.peers";
/**
 * @const
 * @private
 */
const _selectSchemaVersionLocal = "SELECT schema_version FROM system.local";

/**
 * Represents cluster and schema information.
 * The metadata class acts as a internal state of the driver.
 */
class Metadata {
    #rustClient: RustClient;

    /**
     * Creates a new instance of {@link Metadata}.
     * @internal
     * @ignore
     */
    constructor(rustClient: RustClient) {
        this.#rustClient = rustClient;
    }

    /**
     * Gets the keyspace metadata by name.
     * @param {string} name Name of the keyspace.
     * @returns {KeyspaceMetadata | null} The keyspace metadata, or `null` if it does not exist.
     */
    getKeyspace(name: string): KeyspaceMetadata | null {
        return this.#rustClient.getKeyspaceMetadata(name);
    }

    /**
     * Gets all keyspace metadata.
     * @returns {Readonly<Record<string, KeyspaceMetadata>>} Every keyspace, keyed by name.
     */
    getKeyspaces(): Readonly<Record<string, KeyspaceMetadata>> {
        return this.#rustClient.getAllKeyspaces();
    }

    /**
     * Gets the host list representing the replicas that contain the given partition key, token or token range.
     *
     * It uses the pre-loaded keyspace metadata to retrieve the replicas for a token for a given keyspace.
     * When the keyspace metadata has not been loaded, it returns null.
     * @param {string} keyspaceName Name of the keyspace.
     * @param {Buffer | token.Token | token.TokenRange} token Can be Buffer (serialized partition key),
     * Token or TokenRange.
     * @returns {Host[]} The replicas.
     */
    getReplicas(
        keyspaceName: string,
        token: Buffer | token.Token | token.TokenRange,
    ): Host[] {
        throw new Error("TODO: Not implemented");
    }

    /**
     * Gets the token ranges that define data distribution in the ring.
     * @returns {Set<token.TokenRange>} The ranges of the ring or empty set if schema metadata is
     * not enabled.
     */
    getTokenRanges(): Set<token.TokenRange> {
        throw new Error("TODO: Not implemented");
    }

    /**
     * Gets the token ranges that are replicated on the given host, for the given keyspace.
     * @param {string} keyspaceName The name of the keyspace to get ranges for.
     * @param {Host} host The host.
     * @returns {Set<token.TokenRange> | null} Ranges for the keyspace on this host or null if
     * keyspace isn't found or hasn't been loaded.
     */
    getTokenRangesForHost(
        keyspaceName: string,
        host: Host,
    ): Set<token.TokenRange> | null {
        throw new Error("TODO: Not implemented");
    }

    /**
     * Constructs a Token from the input buffer(s) or string input. If a string is passed in
     * it is assumed this matches the token representation reported by cassandra.
     * @param {Buffer[] | Buffer | string} components The token components.
     * @returns {token.Token} Constructed token from the input buffer.
     */
    newToken(components: Buffer[] | Buffer | string): token.Token {
        throw new Error("TODO: Not implemented");
    }

    /**
     * Constructs a TokenRange from the given start and end tokens.
     * @param {token.Token} start The start token.
     * @param {token.Token} end The end token.
     * @returns {token.TokenRange} Build range spanning from start (exclusive) to end (inclusive).
     */
    newTokenRange(start: token.Token, end: token.Token): token.TokenRange {
        throw new Error("TODO: Not implemented");
    }

    /**
     * Gets the definition of an user-defined type.
     * @param {string} keyspaceName Name of the keyspace.
     * @param {string} name Name of the UDT.
     * @returns {Udt | null} The UDT definition, or `null` if it does not exist.
     */
    getUdt(keyspaceName: string, name: string): Udt | null {
        return this.#rustClient.getUdt(keyspaceName, name);
    }

    /**
     * Gets the definition of a table.
     * @param {string} keyspaceName Name of the keyspace.
     * @param {string} name Name of the Table.
     * @returns {TableMetadata | null} The table metadata, or `null` if it does not exist.
     */
    getTable(keyspaceName: string, name: string): TableMetadata | null {
        return this.#rustClient.getTable(keyspaceName, name);
    }

    /**
     * Gets the definition of CQL functions for a given name.
     * @param {string} keyspaceName Name of the keyspace.
     * @param {string} name Name of the Function.
     * @returns {ReadonlyArray<SchemaFunction>} An array of schema function metadata.
     */
    getFunctions(
        keyspaceName: string,
        name: string,
    ): readonly SchemaFunction[] {
        throw new Error("TODO: Not implemented");
    }

    /**
     * Gets a definition of CQL function for a given name and signature.
     * @param {string} keyspaceName Name of the keyspace.
     * @param {string} name Name of the Function.
     * @param {string[] | ColumnInfo[]} signature Array of types of the parameters.
     * @returns {SchemaFunction | null} The schema function metadata, or `null` if it does not
     * exist.
     */
    getFunction(
        keyspaceName: string,
        name: string,
        signature: string[] | ColumnInfo[],
    ): SchemaFunction | null {
        throw new Error("TODO: Not implemented");
    }

    /**
     * Gets the definition of CQL aggregate for a given name.
     * @param {string} keyspaceName Name of the keyspace.
     * @param {string} name Name of the aggregate.
     * @returns {ReadonlyArray<Aggregate>} An array of schema aggregate metadata.
     */
    getAggregates(keyspaceName: string, name: string): readonly Aggregate[] {
        throw new Error("TODO: Not implemented");
    }

    /**
     * Gets a definition of CQL aggregate for a given name and signature.
     * @param {string} keyspaceName Name of the keyspace.
     * @param {string} name Name of the aggregate.
     * @param {string[] | ColumnInfo[]} signature Array of types of the parameters.
     * @returns {Aggregate | null} The schema aggregate metadata, or `null` if it does not exist.
     */
    getAggregate(
        keyspaceName: string,
        name: string,
        signature: string[] | ColumnInfo[],
    ): Aggregate | null {
        throw new Error("TODO: Not implemented");
    }

    /**
     * Gets the definition of a CQL materialized view for a given name.
     *
     * Note that, unlike the rest of the {@link Metadata} methods, this method does not cache the result for following
     * calls, as the current version of the Cassandra native protocol does not support schema change events for
     * materialized views. Each call to this method will produce one or more queries to the cluster.
     * @param {string} keyspaceName Name of the keyspace.
     * @param {string} name Name of the materialized view.
     * @returns {MaterializedView | null} The materialized view definition, or `null` if it does
     * not exist.
     */
    getMaterializedView(
        keyspaceName: string,
        name: string,
    ): MaterializedView | null {
        return this.#rustClient.getMaterializedView(keyspaceName, name);
    }

    /**
     * Gets the trace session generated by Cassandra when query tracing is enabled for the
     * query. The trace itself is stored in Cassandra in the `sessions` and
     * `events` table in the `system_traces` keyspace and can be
     * retrieve manually using the trace identifier.
     *
     * Note: the `consistency` parameter is accepted for API compatibility but is currently not
     * supported – the underlying Rust driver always uses the consistency level configured for
     * tracing queries at the session level.
     * @param {types.Uuid} traceId Identifier of the trace session.
     * @param {types.consistencies} [consistency] The consistency level to obtain the trace.
     * @param {Function} [callback] Executes callback(err, result) when execution completed.
     * When not defined, the method will return a promise.
     */
    getTrace(traceId: types.Uuid): Promise<QueryTrace>;
    getTrace(
        traceId: types.Uuid,
        consistency: types.consistencies,
    ): Promise<QueryTrace>;
    getTrace(traceId: types.Uuid, callback: ValueCallback<QueryTrace>): void;
    getTrace(
        traceId: types.Uuid,
        consistency: types.consistencies,
        callback: ValueCallback<QueryTrace>,
    ): void;
    getTrace(
        traceId: types.Uuid,
        consistency?: types.consistencies | ValueCallback<QueryTrace>,
        callback?: ValueCallback<QueryTrace>,
    ): Promise<QueryTrace> | void {
        if (!callback && typeof consistency === "function") {
            callback = consistency;
            consistency = undefined;
        }

        return promiseUtils.optionalCallback(
            this.#getTrace(
                traceId,
                consistency as types.consistencies | undefined,
            ),
            callback,
        );
    }

    /**
     * Async-only version of {@link Metadata#getTrace()}, so that reading the trace id failing –
     * which throws synchronously – is reported like any other error: through the callback, when
     * one was provided.
     * @param {Uuid} traceId Identifier of the trace session.
     * @param {Number} [consistency] The consistency level to obtain the trace.
     */
    async #getTrace(
        traceId: types.Uuid,
        consistency: types.consistencies | undefined,
    ): Promise<QueryTrace> {
        throw new Error("TODO: Not implemented");
    }

    /**
     * Checks whether hosts that are currently up agree on the schema definition.
     *
     * This method performs a one-time check only, without any form of retry; therefore
     * `protocolOptions.maxSchemaAgreementWaitSeconds` setting does not apply in this case.
     * @returns {boolean} `true` when all hosts agree on the schema and `false` when there is no
     * agreement or when the check could not be performed (for example, if the control connection
     * is down).
     */
    checkSchemaAgreement(): boolean {
        throw new Error("TODO: Not implemented");
    }
}

export { Metadata };
