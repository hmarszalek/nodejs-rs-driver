"use strict";
const cassandra = require("@scylladb/driver");
const { getClientArgs } = require("../util");

const client = new cassandra.Client(getClientArgs());

async function example() {
    await client.connect();
    console.log(
        "Connected to cluster with %d host(s): %j",
        client.hosts.length,
        client.hosts.keys(),
    );
    // Currently the driver does not support that metadata field.
    // console.log("Keyspaces: %j", Object.keys(client.metadata.keyspaces));
    console.log("Connected to cluster.");
}

example().catch(function (err) {
    console.error("There was an error", err);
    process.exitCode = 1;
});
