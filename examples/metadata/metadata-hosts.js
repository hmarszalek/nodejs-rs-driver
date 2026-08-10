"use strict";
const cassandra = require("@scylladb/driver");
const { getClientArgs } = require("../util");

function socketAddressToString(address) {
    return address.family === "ipv6"
        ? `[${address.address}]:${address.port}`
        : `${address.address}:${address.port}`;
}

const client = new cassandra.Client(getClientArgs());
client
    .connect()
    .then(function () {
        console.log(
            "Connected to cluster with %d host(s)",
            client.hosts.length,
        );

        // HostMap#forEach() visits every Host, with its id as the second argument.
        client.hosts.forEach(function (host, hostId) {
            console.log(
                "Host %s: %s on dc %s, rack %s",
                hostId,
                socketAddressToString(host.address),
                host.datacenter,
                host.rack,
            );
        });

        // A specific Host can also be looked up directly, by address or by id.
        const first = client.hosts.values()[0];
        console.log(
            "Looked up by address: %s",
            client.hosts.get(socketAddressToString(first.address)) === first,
        );
        console.log(
            "Looked up by id: %s",
            client.hosts.get(first.hostId) === first,
        );

        console.log("Shutting down");
    })
    .catch(function (err) {
        console.error("There was an error when connecting", err);
    });
