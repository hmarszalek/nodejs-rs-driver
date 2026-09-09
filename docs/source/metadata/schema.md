# Schema Metadata

The driver keeps a snapshot of the cluster's schema in memory and refreshes it in the background
whenever the schema changes. `client.metadata` exposes that snapshot: which keyspaces exist, how
they replicate, and the tables, materialized views and user-defined types they contain.

Because the snapshot is already in memory, every lookup below is **synchronous** – there is no
round trip to the cluster, no callback and no promise.

```javascript
const { Client } = require("@scylladb/driver");

const client = new Client({ contactPoints: ["127.0.0.1:9042"] });
await client.connect();

const keyspace = client.metadata.getKeyspace("my_keyspace");
console.log(keyspace.durableWrites);
```

:::{note}
`client.metadata` is created during `connect()`. Before the client is connected it is `undefined`,
so read it only after `connect()` has resolved.
:::

## Keyspaces

`getKeyspace(name)` returns a single keyspace, or `null` if it does not exist.
`getKeyspaces()` returns every keyspace as a read-only record keyed by name.

```javascript
const keyspace = client.metadata.getKeyspace("my_keyspace");
if (keyspace === null) {
  throw new Error("no such keyspace");
}

for (const [name, ks] of Object.entries(client.metadata.getKeyspaces())) {
  console.log(name, ks.durableWrites);
}
```

A keyspace exposes its replication strategy, whether durable writes are enabled, and its schema
objects keyed by name:

```javascript
keyspace.strategy; // Strategy – see below
keyspace.durableWrites; // boolean
keyspace.tables; // Readonly<Record<string, TableMetadata>>
keyspace.views; // Readonly<Record<string, MaterializedView>>
keyspace.udts; // Readonly<Record<string, Udt>>
```

It also has a lookup method for each of those, returning `null` when there is no such object:

```javascript
keyspace.getTable("users");
keyspace.getMaterializedView("users_by_email");
keyspace.getUdt("address");
```

Both forms give you the same object, so use whichever reads better.

The keyspace does not carry its own name – you already have it, since you looked the keyspace up
by name or read it as the map key.

## Replication strategy

`keyspace.strategy` is a *discriminated union*: its `kind` field says which strategy the keyspace
uses, and each variant carries only the fields meaningful for that strategy. `kind` values come
from the `StrategyKind` enum.

```javascript
const { metadata } = require("@scylladb/driver");
const { StrategyKind } = metadata;

const strategy = keyspace.strategy;

switch (strategy.kind) {
  case StrategyKind.SimpleStrategy:
    console.log("replication factor:", strategy.replicationFactor);
    break;
  case StrategyKind.NetworkTopologyStrategy:
    console.log("per datacenter:", strategy.datacenterRepfactors);
    break;
  case StrategyKind.LocalStrategy:
    console.log("system keyspace");
    break;
  case StrategyKind.Other:
    console.log("unsupported strategy:", strategy.name, strategy.data);
    break;
}
```

In TypeScript, narrowing on `kind` gives you exactly the fields of that variant – reading
`strategy.replicationFactor` without first checking `kind` is a compile error.

`StrategyKind` is a numeric enum, so `StrategyKind[strategy.kind]` gives the variant's name for
logging.

:::{note}
The four variants are exported as *types* only, so `kind` is the way to tell them apart –
`instanceof` is not available for them.
:::

## Tables

`getTable(keyspaceName, tableName)` returns a table, or `null` if it does not exist. The same
object is reachable from a keyspace, as `keyspace.getTable(tableName)` or `keyspace.tables[tableName]`.

```javascript
const table = client.metadata.getTable("my_keyspace", "users");

table.partitionKey; // readonly string[] – column names
table.clusteringKey; // readonly string[] – column names
table.partitioner; // string | null – set only when the table overrides the cluster default
table.columns; // Readonly<Record<string, ColumnMetadata>>
```

Columns are keyed by name, and each one carries its CQL type and the role it plays in the table:

```javascript
const { metadata, types } = require("@scylladb/driver");

for (const [name, column] of Object.entries(table.columns)) {
  console.log(name, metadata.ColumnKind[column.kind], column.type.code);
}
```

`column.kind` is a `ColumnKind`: `Regular`, `Static`, `ClusteringKey` or `PartitionKey`.
`column.type` is a `ColumnInfo`, the same representation the driver uses elsewhere for CQL types –
`type.code` is a `dataTypes` value, and `type.info` carries the element types of collections,
tuples, UDTs and vectors.

## Materialized views

`getMaterializedView(keyspaceName, viewName)` returns a view, or `null`. A `MaterializedView` is a
`TableMetadata` – it has the same columns and keys – plus the name of the table it is built from:

```javascript
const view = client.metadata.getMaterializedView("my_keyspace", "users_by_email");

console.log(view.tableName); // "users"
console.log(view.partitionKey); // the view's own partition key
```

Views are also available as `keyspace.getMaterializedView(viewName)` and `keyspace.views`.

## User-defined types

`getUdt(keyspaceName, typeName)` returns a UDT, or `null`. Its fields are an ordered array, and
each field has a name and a `ColumnInfo` type:

```javascript
const udt = client.metadata.getUdt("my_keyspace", "address");

console.log(udt.name, udt.keyspace);
for (const field of udt.fields) {
  console.log(field.name, field.type.code);
}
```

UDTs are also available as `keyspace.getUdt(typeName)` and `keyspace.udts`.

## Object identity and refreshes

`client.metadata` is a live view: every call on it reads the driver's current cluster state.
Everything it hands out is a snapshot of that state, and within one snapshot the same object is
returned every time – both for the schema objects themselves and for the records that hold them:

```javascript
const keyspace = client.metadata.getKeyspace("my_keyspace");

// the same table, by any route
client.metadata.getTable("my_keyspace", "users") === keyspace.getTable("users"); // true
keyspace.getTable("users") === keyspace.tables["users"]; // true

// and the same records
keyspace.tables === keyspace.tables; // true
client.metadata.getKeyspaces() === client.metadata.getKeyspaces(); // true
client.metadata.getKeyspaces()["my_keyspace"] === keyspace; // true
```

This holds whichever call comes first: looking a table up on its own and then reading
`keyspace.tables` gives you the same object as doing it the other way round.

When the schema changes, the next call on `client.metadata` builds everything afresh:

```javascript
const before = client.metadata.getTable("my_keyspace", "users");
await client.execute("ALTER TABLE my_keyspace.users ADD nickname text");
const after = client.metadata.getTable("my_keyspace", "users");

before === after; // false
```

A metadata object you are holding is a snapshot: it will not change under you, and it will not pick
up schema changes either. Re-read it from `client.metadata` when you need current information.

:::{caution}
Because `client.metadata` is live, two calls on it are not guaranteed to see the same cluster
state – a refresh can land between them. Objects reached through a single `KeyspaceMetadata` are
always mutually consistent; separate `client.metadata` calls are only consistent if no refresh
intervened. Read the keyspace once and work from it when that matters.
:::

:::{note}
Refreshes happen in the background, so immediately after a DDL statement the driver may still
report the previous schema for a short while.
:::

## Metadata is read-only

Every metadata object is read-only, all the way down: fields cannot be reassigned, the `columns`,
`tables`, `views` and `udts` records cannot gain or lose entries, and `partitionKey`,
`clusteringKey` and `fields` are readonly arrays. In TypeScript, mutating any of them is a compile
error.

:::{caution}
`readonly` is a TypeScript-only guarantee and is erased at runtime; plain JavaScript can still
write to these objects. Treat them as immutable regardless.
:::

## Example

A complete, runnable program covering keyspaces, tables, UDTs, materialized views and the caching
behaviour lives in
[`examples/metadata/metadata-schema.js`](https://github.com/scylladb/nodejs-rs-driver/blob/main/examples/metadata/metadata-schema.js).
