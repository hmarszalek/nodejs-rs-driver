"use strict";

import rust = require("../../index");

/**
 * Identifies the replication strategy variant.
 * @alias module:metadata~StrategyKind
 */
enum StrategyKind {
    /**
     * Deprecated in ScyllaDB.
     *
     * **Use only for a single datacenter and one rack.**
     *
     * Places the first replica on a node determined by the partitioner.
     * Additional replicas are placed on the next nodes clockwise in the ring
     * without considering topology (rack or datacenter location).
     */
    SimpleStrategy = 0,
    /**
     * Use this strategy when you have (or plan to have) your cluster deployed across
     * multiple datacenters. This strategy specifies how many replicas you want in each
     * datacenter.
     *
     * `NetworkTopologyStrategy` places replicas in the same datacenter by walking the ring
     * clockwise until reaching the first node in another rack. It attempts to place replicas
     * on distinct racks because nodes in the same rack (or similar physical grouping) often
     * fail at the same time due to power, cooling, or network issues.
     */
    NetworkTopologyStrategy = 1,
    /**
     * Used for internal purposes, e.g. for system tables.
     */
    LocalStrategy = 2,
    /**
     * Unknown other strategy, which is not supported by the driver.
     */
    Other = 3,
}

/**
 * Replication strategy placing replicas on consecutive nodes clockwise in the ring, without
 * regard for topology. See {@link StrategyKind.SimpleStrategy}.
 * @alias module:metadata~SimpleStrategy
 */
class SimpleStrategy {
    /**
     * Discriminates {@link Strategy}. Always {@link StrategyKind.SimpleStrategy}.
     */
    readonly kind: StrategyKind.SimpleStrategy = StrategyKind.SimpleStrategy;

    /**
     * How many replicas of each piece of data there are.
     */
    readonly replicationFactor: number;

    /**
     * Constructs a SimpleStrategy instance.
     *
     * Instances of this class are constructed directly from the native code when reading cluster
     * metadata.
     * @internal
     * @ignore
     */
    constructor(replicationFactor: number) {
        this.replicationFactor = replicationFactor;
    }
}

/**
 * Replication strategy specifying how many replicas to place in each datacenter.
 * See {@link StrategyKind.NetworkTopologyStrategy}.
 * @alias module:metadata~NetworkTopologyStrategy
 */
class NetworkTopologyStrategy {
    /**
     * Discriminates {@link Strategy}. Always {@link StrategyKind.NetworkTopologyStrategy}.
     */
    readonly kind: StrategyKind.NetworkTopologyStrategy =
        StrategyKind.NetworkTopologyStrategy;

    /**
     * How many replicas of each piece of data there are in each datacenter,
     * keyed by datacenter name.
     */
    readonly datacenterRepfactors: Readonly<Record<string, number>>;

    /**
     * Constructs a NetworkTopologyStrategy instance.
     *
     * Instances of this class are constructed directly from the native code when reading cluster
     * metadata, which passes an already-built `Record` keyed by datacenter name.
     * @internal
     * @ignore
     */
    constructor(datacenterRepfactors: Record<string, number>) {
        this.datacenterRepfactors = datacenterRepfactors;
    }
}

/**
 * Replication strategy used internally, e.g. for system tables.
 * See {@link StrategyKind.LocalStrategy}.
 * @alias module:metadata~LocalStrategy
 */
class LocalStrategy {
    /**
     * Discriminates {@link Strategy}. Always {@link StrategyKind.LocalStrategy}.
     */
    readonly kind: StrategyKind.LocalStrategy = StrategyKind.LocalStrategy;
}

/**
 * A replication strategy the driver does not interpret.
 * See {@link StrategyKind.Other}.
 * @alias module:metadata~OtherStrategy
 */
class OtherStrategy {
    /**
     * Discriminates {@link Strategy}. Always {@link StrategyKind.Other}.
     */
    readonly kind: StrategyKind.Other = StrategyKind.Other;

    /**
     * Name of the strategy, as reported by the server.
     */
    readonly name: string;

    /**
     * Additional parameters of the strategy, which the driver does not interpret.
     */
    readonly data: Readonly<Record<string, string>>;

    /**
     * Constructs an OtherStrategy instance.
     *
     * Instances of this class are constructed directly from the native code when reading cluster
     * metadata.
     * @internal
     * @ignore
     */
    constructor(name: string, data: Record<string, string>) {
        this.name = name;
        this.data = data;
    }
}

/**
 * Describes the replication strategy used by a keyspace.
 *
 * This is a discriminated union: narrowing on {@link Strategy.kind} yields exactly the fields
 * that are meaningful for that variant, and no others. Each class fixes its own `kind`, so the
 * discriminant cannot disagree with the class carrying it.
 * @alias module:metadata~Strategy
 */
type Strategy =
    | SimpleStrategy
    | NetworkTopologyStrategy
    | LocalStrategy
    | OtherStrategy;

export {
    Strategy,
    StrategyKind,
    SimpleStrategy,
    NetworkTopologyStrategy,
    LocalStrategy,
    OtherStrategy,
};

// Registers the strategy constructors, so that Rust can construct fully-formed instances directly
// when reading cluster metadata, rather than materialising a plain object property by property.
rust.registerSimpleStrategyCtor(SimpleStrategy);
rust.registerNetworkTopologyStrategyCtor(NetworkTopologyStrategy);
rust.registerLocalStrategyCtor(LocalStrategy);
rust.registerOtherStrategyCtor(OtherStrategy);
