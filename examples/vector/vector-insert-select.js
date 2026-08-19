"use strict";
const cassandra = require("@scylladb/driver");
const { getClientArgs } = require("../util");

const client = new cassandra.Client(getClientArgs());

/**
 * Creates a table with a vector column, inserts a row and selects a row.
 */
async function example() {
    await client.connect();

    await client.execute(
        "CREATE KEYSPACE IF NOT EXISTS examples WITH replication =" +
            "{'class': 'NetworkTopologyStrategy', 'replication_factor': '1' }",
    );

    await client.execute(
        "CREATE TABLE IF NOT EXISTS examples.vector_comments " +
            "(id uuid PRIMARY KEY, comment text, comment_vector vector<float, 5>)",
    );

    // A Vector can be built from a plain Array (with an explicit subtype)...
    const commentVector = new cassandra.types.Vector(
        [0.12, 0.34, 0.56, 0.78, 0.91],
        "float",
    );
    const id1 = cassandra.types.Uuid.random();

    console.log(`Inserting comment for id ${id1} from plain Array`);
    await client.execute(
        "INSERT INTO examples.vector_comments (id, comment, comment_vector) VALUES (?, ?, ?)",
        [id1, "Great product, fast shipping!", commentVector],
        { prepare: true },
    );

    const result = await client.execute(
        "SELECT comment, comment_vector FROM examples.vector_comments WHERE id = ?",
        [id1],
        { prepare: true },
    );
    const row = result.first();
    console.log(`Retrieved comment for id ${id1}: "${row["comment"]}"`);
    console.log(`Retrieved vector for id ${id1}: ${row["comment_vector"]}`);

    // ...or from a Float32Array.
    const commentVectorArray = new Float32Array([0.11, 0.22, 0.33, 0.44, 0.55]);
    const id2 = cassandra.types.Uuid.random();

    console.log(`Inserting comment for id ${id2} from Float32Array`);
    await client.execute(
        "INSERT INTO examples.vector_comments (id, comment, comment_vector) VALUES (?, ?, ?)",
        [id2, "Exactly as described", commentVectorArray],
        { prepare: true },
    );

    const result2 = await client.execute(
        "SELECT comment, comment_vector FROM examples.vector_comments WHERE id = ?",
        [id2],
        { prepare: true },
    );
    const row2 = result2.first();
    console.log(`Retrieved comment for id ${id2}: "${row2["comment"]}"`);
    console.log(`Retrieved vector for id ${id2}: ${row2["comment_vector"]}`);
}

example().catch(function (err) {
    console.error("There was an error", err);
    process.exitCode = 1;
});
