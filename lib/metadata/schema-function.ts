"use strict";

import { ColumnInfo } from "../types/cql-utils";

/**
 * Describes a CQL function.
 * @alias module:metadata~SchemaFunction
 */
class SchemaFunction {
    /**
     * Name of the cql function.
     */
    name: string | null;

    /**
     * Name of the keyspace where the cql function is declared.
     */
    keyspaceName: string | null;

    /**
     * Signature of the function.
     */
    signature: string[] | null;

    /**
     * List of the function argument names.
     */
    argumentNames: string[] | null;

    /**
     * List of the function argument types.
     */
    argumentTypes: ColumnInfo[] | null;

    /**
     * Body of the function.
     */
    body: string | null;

    /**
     * Determines if the function is called when the input is null.
     */
    calledOnNullInput: boolean | null;

    /**
     * Name of the programming language, for example: java, javascript, ...
     */
    language: string | null;

    /**
     * Type of the return value.
     */
    returnType: ColumnInfo | null;

    /**
     * Indicates whether or not this function is deterministic.  This means that
     * given a particular input, the function will always produce the same output.
     */
    deterministic: boolean | null;

    /**
     * Indicates whether or not this function is monotonic on all of its
     * arguments.  This means that it is either entirely non-increasing or
     * non-decreasing.  Even if the function is not monotonic on all of its
     * arguments, it's possible to specify that it is monotonic on one of
     * its arguments, meaning that partial applications of the function over
     * that argument will be monotonic.
     *
     * Monotonicity is required to use the function in a GROUP BY clause.
     */
    monotonic: boolean | null;

    /**
     * The argument names that the function is monotonic on.
     *
     * If {@link monotonic} is true, this will return all argument names.
     * Otherwise, this will return either one argument or an empty array.
     */
    monotonicOn: string[] | null;

    /**
     * Creates a new SchemaFunction.
     * @internal
     * @ignore
     */
    constructor(
        name: string | null,
        keyspaceName: string | null,
        signature: string[] | null,
        argumentNames: string[] | null,
        argumentTypes: ColumnInfo[] | null,
        body: string | null,
        calledOnNullInput: boolean | null,
        language: string | null,
        returnType: ColumnInfo | null,
        deterministic: boolean | null,
        monotonic: boolean | null,
        monotonicOn: string[] | null,
    ) {
        this.name = name;
        this.keyspaceName = keyspaceName;
        this.signature = signature;
        this.argumentNames = argumentNames;
        this.argumentTypes = argumentTypes;
        this.body = body;
        this.calledOnNullInput = calledOnNullInput;
        this.language = language;
        this.returnType = returnType;
        this.deterministic = deterministic;
        this.monotonic = monotonic;
        this.monotonicOn = monotonicOn;
    }
}

export { SchemaFunction };
