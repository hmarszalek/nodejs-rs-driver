"use strict";

const { assert } = require("chai");

const rust = require("../../index");

class TestJsClass {
    constructor(name, value) {
        this.name = name;
        this.value = value;
    }
}

describe("JsInstance / define_js_ctor!", function () {
    before(function () {
        rust.registerTestJsClassCtor(TestJsClass);
    });

    describe("register_fn / build_fn", function () {
        it("should reject re-registration in the same environment", function () {
            assert.throws(
                () => rust.registerTestJsClassCtor(TestJsClass),
                /TestJsClass constructor is already registered/,
            );
        });

        it("should build an instance of the registered class with the given arguments", function () {
            const obj = rust.testsBuildTestJsClass("alpha", 10);
            assert.instanceOf(obj, TestJsClass);
            assert.deepEqual(obj, { name: "alpha", value: 10 });
        });

        it("should build independent objects (not the same identity) on each call", function () {
            const a = rust.testsBuildTestJsClass("same", 11);
            const b = rust.testsBuildTestJsClass("same", 11);
            assert.notStrictEqual(a, b);
            assert.deepEqual(a, b);
        });

        it("should build independent objects (not the same identity) on each call", function () {
            const a = rust.testsBuildTestJsClass("same", 11);
            const b = rust.testsBuildTestJsClass("same", 11);
            assert.notStrictEqual(a, b);
            assert.deepEqual(a, b);
        });
    });
});
