"use strict";
const cassandra = require("@scylladb/driver");
const { getClientArgs } = require("../util");

const client = new cassandra.Client(getClientArgs());

const comments = [
    { text: "Great product, fast shipping!", vector: [0.9, 0.1, 0.0] },
    { text: "Arrived quickly, very happy", vector: [0.8, 0.2, 0.0] },
    { text: "The colour is completely wrong", vector: [0.1, 0.9, 0.0] },
    { text: "Broke after a single use", vector: [0.0, 0.2, 0.9] },
];

// The embedding we search with. Closest in meaning to the "fast shipping"
// comments, so those are the ones the ANN query should return first.
const queryVector = [0.95, 0.05, 0.0];

/**
 * Stores comment embeddings in a `vector` column and finds the ones most
 * similar to a query embedding with an `ORDER BY ... ANN OF` query.
 */
async function example() {
    await client.connect();

    await client.execute(
        "CREATE KEYSPACE IF NOT EXISTS examples WITH replication =" +
            "{'class': 'NetworkTopologyStrategy', 'replication_factor': '1' }",
    );

    await client.execute(
        "CREATE TABLE IF NOT EXISTS examples.vector_search_comments " +
            "(id uuid PRIMARY KEY, comment text, comment_vector vector<float, 3>)",
    );

    console.log("Inserting comments");
    for (const comment of comments) {
        await client.execute(
            "INSERT INTO examples.vector_search_comments (id, comment, comment_vector) " +
                "VALUES (?, ?, ?)",
            [
                cassandra.types.Uuid.random(),
                comment.text,
                new cassandra.types.Vector(comment.vector, "float"),
            ],
            { prepare: true },
        );
    }

    await client.execute(
        "CREATE CUSTOM INDEX IF NOT EXISTS comment_ann_index " +
            "ON examples.vector_search_comments (comment_vector) " +
            "USING 'vector_index' WITH OPTIONS = { 'similarity_function': 'COSINE' }",
    );

    const matches = await annSearch(
        "SELECT comment FROM examples.vector_search_comments " +
            "ORDER BY comment_vector ANN OF ? LIMIT 2",
        [new cassandra.types.Vector(queryVector, "float")],
    );

    console.log("Comments most similar to the query embedding:");
    for (const match of matches) {
        console.log(`  ${match["comment"]}`);
    }
}

example().catch(function (err) {
    console.error("There was an error", err);
    process.exitCode = 1;
});

// Vector search takes a moment to become usable: the Vector Store service has
// to be reachable, and it builds its index asynchronously.
const vectorSearchTimeout = 6000;

/**
 * Runs an ANN query, waiting for vector search to become available.
 * @returns {Promise<Array<Row>>}
 */
async function annSearch(query, params) {
    const deadline = Date.now() + vectorSearchTimeout;
    let lastError;
    for (;;) {
        try {
            const result = await client.execute(query, params, {
                prepare: true,
            });
            if (result.rows.length > 0) {
                return result.rows;
            }
        } catch (err) {
            // Report the last failure as the cause if we run out of time.
            lastError = err;
        }
        if (Date.now() > deadline) {
            throw new Error("Vector search did not become available.", {
                cause: lastError,
            });
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
}
