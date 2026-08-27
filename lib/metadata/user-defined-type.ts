"use strict";

import { ColumnInfo, convertComplexType } from "../types/cql-utils";
import rust = require("../../index");

/**
 * Describes a field of a user-defined type.
 * @alias module:metadata~UdtField
 */
class UdtField {
    /**
     * Name of the field.
     */
    readonly name: string;

    /**
     * CQL type of the field.
     */
    readonly type: ColumnInfo;

    /**
     * Constructs a UdtField instance.
     *
     * Instances of this class are constructed directly from the native code when reading cluster metadata.
     * @param {string} name Name of the field.
     * @param {ColumnInfo} typ CQL type of the field.
     * @internal
     * @ignore
     */
    constructor(name: string, typ: rust.ComplexType) {
        this.name = name;
        this.type = convertComplexType(typ);
    }
}

/**
 * Describes a user-defined type (UDT) in the cluster.
 * @alias module:metadata~Udt
 */
class Udt {
    /**
     * Name of the user-defined type (UDT).
     * UDT is composed of fields, each with a name and an optional value of its own type.
     */
    readonly name: string;

    /**
     * Name of the keyspace the type belongs to.
     */
    readonly keyspace: string;

    /**
     * Fields of the user-defined type.
     */
    readonly fields: readonly UdtField[];

    /**
     * Constructs a UserDefinedType instance.
     *
     * Instances of this class are constructed directly from the native code when reading cluster metadata.
     * @param {string} name Name of the type.
     * @param {string} keyspace Name of the keyspace the type belongs to.
     * @param {UdtField[]} fields Fields the type is composed of, in declaration order.
     * @internal
     * @ignore
     */
    constructor(name: string, keyspace: string, fields: UdtField[]) {
        this.name = name;
        this.keyspace = keyspace;
        this.fields = fields;
    }
}

export { Udt, UdtField };

// Registers the UdtField/Udt constructors, so that Rust can construct fully-formed
// instances directly when reading cluster metadata.
rust.registerUdtFieldCtor(UdtField);
rust.registerUdtCtor(Udt);
