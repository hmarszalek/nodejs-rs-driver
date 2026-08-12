"use strict";

import { ColumnInfo } from "../types/cql-utils";

/**
 * Describes a CQL aggregate.
 * @alias module:metadata~Aggregate
 */
class Aggregate {
    /**
     * Name of the aggregate.
     */
    name: string | null;

    /**
     * Name of the keyspace where the aggregate is declared.
     */
    keyspaceName: string | null;

    /**
     * Signature of the aggregate.
     */
    signature: string[] | null;

    /**
     * List of the CQL aggregate argument types.
     */
    argumentTypes: ColumnInfo[] | null;

    /**
     * State Function.
     */
    stateFunction: string | null;

    /**
     * State Type.
     */
    stateType: ColumnInfo | null;

    /**
     * Final Function.
     */
    finalFunction: string | null;

    initConditionRaw: string | null;

    /**
     * Initial state value of this aggregate.
     */
    initCondition: string | null;

    /**
     * Type of the return value.
     */
    returnType: ColumnInfo | null;

    /**
     * Indicates whether or not this aggregate is deterministic.  This means that
     * given a particular input, the aggregate will always produce the same output.
     */
    deterministic: boolean | null;

    /**
     * Creates a new Aggregate.
     * @internal
     * @ignore
     */
    constructor(
        name: string | null,
        keyspaceName: string | null,
        signature: string[] | null,
        argumentTypes: ColumnInfo[] | null,
        stateFunction: string | null,
        stateType: ColumnInfo | null,
        finalFunction: string | null,
        initConditionRaw: string | null,
        initCondition: string | null,
        returnType: ColumnInfo | null,
        deterministic: boolean | null,
    ) {
        this.name = name;
        this.keyspaceName = keyspaceName;
        this.signature = signature;
        this.argumentTypes = argumentTypes;
        this.stateFunction = stateFunction;
        this.stateType = stateType;
        this.finalFunction = finalFunction;
        this.initConditionRaw = initConditionRaw;
        this.initCondition = initCondition;
        this.returnType = returnType;
        this.deterministic = deterministic;
    }
}

export { Aggregate };
