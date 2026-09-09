/**
 * Computes a token, finds the ranges of the ring, and then scans a whole table range by range.
 *
 * This assumes the keyspace uses vnodes on purpose: with vnodes, the ring is divided once for
 * the whole cluster, so `client.metadata.getTokenRanges()` alone is enough to enumerate every
 * range. Where a keyspace uses tablets instead, each table is divided into ranges of its own,
 * which are not covered by this example.
 */
"use strict";
const cassandra = require("@scylladb/driver");
const { getClientArgs } = require("../util");

const { executeConcurrent } = cassandra.concurrent;

const client = new cassandra.Client(getClientArgs());

const keyspace = "examples_tokens";
const table = "readings";

/**
 * Determines whether the cluster supports tablets: ScyllaDB advertises the features it supports
 * in `system.local`, while Cassandra has no such column, and no tablets either. A cluster with no
 * tablets support at all uses vnodes for every keyspace regardless, so the keyspace only needs to
 * opt out of tablets explicitly where the feature exists in the first place.
 */
async function supportsTablets() {
    const result = await client.execute(
        "SELECT * FROM system.local WHERE key = 'local'",
    );
    const features = result.first()["supported_features"];
    return (
        typeof features === "string" && features.split(",").includes("TABLETS")
    );
}

async function example() {
    await client.connect();

    const tabletsSupported = await supportsTablets();
    await client.execute(
        `CREATE KEYSPACE IF NOT EXISTS ${keyspace} WITH replication =` +
            " {'class': 'NetworkTopologyStrategy', 'replication_factor': 1}" +
            (tabletsSupported ? " AND tablets = {'enabled': false}" : ""),
    );
    await client.execute(
        `CREATE TABLE IF NOT EXISTS ${keyspace}.${table}` +
            " (user_id text PRIMARY KEY, value double)",
    );

    const users = ["user-1", "user-2", "user-3", "user-4"];
    for (const [index, user] of users.entries()) {
        await client.execute(
            `INSERT INTO ${keyspace}.${table} (user_id, value) VALUES (?, ?)`,
            [user, index * 10.5],
            { prepare: true },
        );
    }

    // Computing a token: the driver reads the partitioner from the table's own metadata and
    // frames the partition key the same way the server does, so this matches token(user_id)
    // computed by the server itself for the same row.
    const token = client.metadata.newToken(
        Buffer.from(users[0], "utf8"),
        keyspace,
        table,
    );
    console.log("'%s' hashes to token %s", users[0], token.toString());

    // With vnodes, the ring is divided once for the whole cluster: every keyspace and table sees
    // the same ranges, and only who replicates each range depends on the keyspace's replication
    // strategy.
    const ranges = client.metadata.getTokenRanges();
    console.log("the ring is divided into %d ranges", ranges.size);

    // Executing range queries: a full table scan can be done range by range, each one a plain
    // CQL query bounded by token(). A TokenRange is start-exclusive, end-inclusive, which is
    // exactly what "token(user_id) > ? AND token(user_id) <= ?" selects. A range that wraps
    // around the end of the ring cannot be expressed by a single such query – split it into
    // the one or two ranges that don't.
    const pieces = [...ranges].flatMap((range) => range.unwrap());
    const rangeParams = pieces.map((piece) => [
        piece.start.getValue(),
        piece.end.getValue(),
    ]);

    console.log("scanning %s.%s range by range:", keyspace, table);
    const { resultItems } = await executeConcurrent(
        client,
        `SELECT user_id, value FROM ${keyspace}.${table}` +
            " WHERE token(user_id) > ? AND token(user_id) <= ?",
        rangeParams,
        { collectResults: true },
    );

    let totalRows = 0;
    resultItems.forEach((result, index) => {
        if (result.rowLength > 0) {
            console.log("  %s: %d row(s)", pieces[index], result.rowLength);
        }
        totalRows += result.rowLength;
    });
    console.log("read %d row(s) in total, across all ranges", totalRows);
}

example().catch(function (err) {
    console.error("There was an error", err);
    process.exitCode = 1;
});
