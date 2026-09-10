# Topology

The driver maintains knowledge of the cluster's topology: which nodes exist, how to reach them, and whether they are currently reachable. `client.hosts` exposes this topology as a live `HostMap`, keyed by each node's id.

## Host

A `Host` represents a single node in the cluster. It carries:

```javascript
{
  address: SocketAddress,    // The IP address and port to reach this node
  datacenter: string | null, // The datacenter this node belongs to
  rack: string | null,       // The rack within the datacenter
  hostId: Uuid,              // The node's unique identifier
  isUp(): boolean            // Whether the driver currently has an open connection to this node
}
```

### Address

`host.address` is a Node.js `net.SocketAddress` object with `address` and `port` properties:

```javascript
const host = [...client.hosts.values()][0];
console.log(`${host.address.address}:${host.address.port}`);
```

### Connectivity

`host.isUp()` returns `true` when the driver currently maintains at least one working connection to this node.

```javascript
for (const host of client.hosts.values()) {
  if (host.isUp()) {
    console.log(`${host.address} is reachable`);
  }
}
```

A host being down does not mean the node is unavailable – it may mean the driver has not yet established a connection, or all connections were temporarily closed. The driver continually attempts to reconnect, and the status reflects the current moment only.

## HostMap

`client.hosts` is a read-only `HostMap` – a collection of all nodes the driver knows about, keyed by each node's `hostId` (a `Uuid`).

```javascript
// Get a specific host by id
const host = client.hosts.get(hostId);

// Iterate all hosts
for (const host of client.hosts.values()) {
  console.log(host.address);
}

// Or use forEach
client.hosts.forEach((host, hostId) => {
  console.log(hostId.toString(), host.address);
});
```

### Keying by address

While the map is keyed by `hostId` (UUID), `get()` also accepts addresses:

```javascript
// All three are equivalent:
const host = client.hosts.get(hostId);
const host = client.hosts.get(socketAddress);
const host = client.hosts.get("192.168.1.1:9042");
```

### Staleness

`client.hosts` is a snapshot of the cluster's topology at the moment it was retrieved. The actual set of hosts and their properties (address, datacenter, rack) can change at any time as the driver detects topology changes, so always read it fresh from the client when you need current information. Hosts returned from a single `client.hosts` access are mutually consistent, but separate accesses may see different cluster states if a topology change occurs between them. The `host.isUp()` always returns the current state of the host.

## Datacenter and rack awareness

Hosts report their datacenter and rack:

```javascript
for (const host of client.hosts.values()) {
  console.log(`${host.address} in dc="${host.datacenter}" rack="${host.rack}"`);
}
```

A host may belong to no datacenter or rack (both `null`) if the cluster or node has not reported that information.
