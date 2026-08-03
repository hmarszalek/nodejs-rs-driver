"use strict";

const { assert } = require("chai");
const path = require("path");
const { Worker } = require("worker_threads");

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
    });

    describe("NapiRef pinning", function () {
        afterEach(function () {
            rust.testsClearPinned();
        });

        it("should return the same underlying object across multiple get() calls", function () {
            rust.testsPinAndStore("bravo", 20);
            const first = rust.testsGetPinned();
            const second = rust.testsGetPinned();
            assert.strictEqual(first, second);
            assert.deepEqual(first, { name: "bravo", value: 20 });
        });
    });

    describe("NapiRef pinning survives GC while pinned, and releases after clear", function () {
        before(function () {
            if (!global.gc) {
                console.warn(
                    "Test skipped: To run this test add --expose-gc flag",
                );
                this.skip();
            }
        });

        afterEach(function () {
            rust.testsClearPinned();
        });

        it("expose-gc: keeps the pinned object alive across a forced GC, and lets it be collected once cleared", async function () {
            this.timeout(20000);

            rust.testsPinAndStore("gc-test", 1);

            // Obtain a WeakRef/FinalizationRegistry registration for the pinned object without
            // retaining any other JS-side strong reference to it - the IIFE scope ensures `obj`
            // itself is not kept alive by this test function's own frame.
            let weakRef;
            let finalized = false;
            const registry = new FinalizationRegistry(() => {
                finalized = true;
            });
            (function () {
                const obj = rust.testsGetPinned();
                weakRef = new WeakRef(obj);
                registry.register(obj, "gc-test-token");
            })();

            // Force GC repeatedly to reliably reach a full collection pass.
            for (let i = 0; i < 20; i++) {
                global.gc();
                await new Promise((resolve) => setTimeout(resolve, 0));
            }

            // WeakRef alone can't prove liveness would persist forever, but it does prove the
            // object was not prematurely collected while still strongly pinned by the NapiRef.
            assert.isDefined(
                weakRef.deref(),
                "object pinned by NapiRef should survive a forced GC",
            );

            // Drops the NapiRef (napi_delete_reference), releasing the object.
            rust.testsClearPinned();

            for (let i = 0; i < 20 && !finalized; i++) {
                global.gc();
                await new Promise((resolve) => setTimeout(resolve, 0));
            }

            assert.isUndefined(
                weakRef.deref(),
                "object should become collectible once the NapiRef is dropped",
            );
            assert.isTrue(
                finalized,
                "FinalizationRegistry callback should have run once the NapiRef was dropped, " +
                    "proving GC actually collected the object rather than merely deref() racing it",
            );
        });
    });

    describe("N-API environment threads", function () {
        this.timeout(10000);

        it("separate threads require separate registration", function (done) {
            const worker = new Worker(
                path.resolve(__dirname, "js-instance-ctor-worker.js.worker"),
            );

            worker.on("message", (result) => {
                worker.terminate().then(() => {
                    try {
                        assert.isTrue(
                            result.ok,
                            `worker failed: ${result.error}\n${result.stack || ""}`,
                        );
                        assert.match(
                            result.notRegisteredMessage,
                            /constructor is not registered yet/,
                        );
                        assert.deepEqual(result.built, {
                            name: "worker",
                            value: 1,
                        });
                        assert.match(
                            result.duplicateMessage,
                            /constructor is already registered/,
                        );
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
            worker.on("error", done);
        });
    });
});
