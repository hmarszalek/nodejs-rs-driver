"use strict";

import { ColumnInfo } from "../types/cql-utils";

/**
 * Describes a field of a user-defined type.
 * @alias module:metadata~UdtField
 */
class UdtField {
    /**
     * Name of the field.
     */
    name: string;

    /**
     * CQL type of the field.
     */
    type: ColumnInfo;

    /**
     * Constructs a UdtField instance.
     *
     * @param {string} name Name of the field.
     * @param {ColumnInfo} typ CQL type of the field.
     * @internal
     * @ignore
     */
    constructor(name: string, typ: ColumnInfo) {
        this.name = name;
        this.type = typ;
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
    name: string;

    /**
     * Name of the keyspace the type belongs to.
     */
    keyspace: string;

    /**
     * Fields of the user-defined type.
     */
    fields: UdtField[];

    /**
     * Constructs a UserDefinedType instance.
     *
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
