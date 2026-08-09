"use strict";
const assert = require("chai").assert;

const helper = require("../../test-helper");
const types = require("../../../lib/types");
const { QueryTrace, TracingEvent } = require("../../../lib/metadata");

describe("Client#metadata.getTrace()", function () {
    this.timeout(120000);

    describe("with a single node", function () {
        const setupInfo = helper.setup("1:0");

        /**
         * Executes a traced query and waits until the trace session has been persisted and is
         * readable, so a subsequent `getTrace()` call is guaranteed to find it.
         * @returns {Promise<Uuid>} the trace id
         */
        async function executeTracedQuery() {
            const client = setupInfo.client;
            const result = await client.execute(helper.queries.basic, [], {
                traceQuery: true,
            });

            const traceId = result.info.traceId;
            assert.instanceOf(traceId, types.Uuid);

            await helper.wait.until(async () => {
                const sessionRs = await client.execute(
                    "SELECT * FROM system_traces.sessions WHERE session_id=?",
                    [traceId],
                    { consistency: types.consistencies.one },
                );
                const row = sessionRs.first();
                return row && typeof row["duration"] === "number";
            });

            return traceId;
        }

        it("should retrieve a real QueryTrace instance", async () => {
            const traceId = await executeTracedQuery();
            const trace = await setupInfo.client.metadata.getTrace(traceId);

            assert.instanceOf(trace, QueryTrace);
            assert.isString(trace.requestType);
            assert.instanceOf(trace.coordinator, types.InetAddress);
            assert.isObject(trace.parameters);
            assert.isNotEmpty(trace.parameters);
            Object.values(trace.parameters).forEach((value) =>
                assert.isString(value),
            );
            assert.instanceOf(trace.startedAt, Date);
            assert.isNumber(trace.duration);
            assert.instanceOf(trace.clientAddress, types.InetAddress);
        });

        it("should populate the events array with real TracingEvent instances", async () => {
            const traceId = await executeTracedQuery();
            const trace = await setupInfo.client.metadata.getTrace(traceId);

            assert.isArray(trace.events);
            assert.isAbove(trace.events.length, 0);

            trace.events.forEach((event) => {
                assert.instanceOf(event, TracingEvent);
                assert.instanceOf(event.id, types.TimeUuid);
                assert.isString(event.activity);
                assert.instanceOf(event.source, types.InetAddress);
                assert.isNumber(event.elapsed);
                assert.isString(event.thread);
            });
        });

        it("should resolve the promise for the QueryTrace instance", async () => {
            const traceId = await executeTracedQuery();
            const trace = await setupInfo.client.metadata.getTrace(traceId);

            assert.instanceOf(trace, QueryTrace);
            assert.isString(trace.requestType);
            assert.isArray(trace.events);
        });

        it("should resolve the promise when a consistency level is provided", async () => {
            const traceId = await executeTracedQuery();
            const trace = await setupInfo.client.metadata.getTrace(
                traceId,
                types.consistencies.all,
            );

            assert.instanceOf(trace, QueryTrace);
            assert.isString(trace.requestType);
            assert.isArray(trace.events);
        });

        it("should reject the promise when the trace does not exist", async () => {
            await helper.assertThrowsAsync(
                setupInfo.client.metadata.getTrace(types.Uuid.random()),
            );
        });

        it("should invoke the callback with the QueryTrace instance", function (done) {
            executeTracedQuery().then(function (traceId) {
                setupInfo.client.metadata.getTrace(
                    traceId,
                    function (err, trace) {
                        assert.ifError(err);
                        assert.instanceOf(trace, QueryTrace);
                        assert.isString(trace.requestType);
                        assert.isArray(trace.events);
                        done();
                    },
                );
            }, done);
        });

        it("should invoke the callback when a consistency level is provided", function (done) {
            executeTracedQuery().then(function (traceId) {
                setupInfo.client.metadata.getTrace(
                    traceId,
                    types.consistencies.all,
                    function (err, trace) {
                        assert.ifError(err);
                        assert.instanceOf(trace, QueryTrace);
                        assert.isString(trace.requestType);
                        assert.isArray(trace.events);
                        done();
                    },
                );
            }, done);
        });

        it("should invoke the callback with an error when the trace does not exist", function (done) {
            setupInfo.client.metadata.getTrace(
                types.Uuid.random(),
                function (err, trace) {
                    assert.instanceOf(err, Error);
                    assert.isUndefined(trace);
                    done();
                },
            );
        });
    });
});
