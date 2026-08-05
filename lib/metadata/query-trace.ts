import InetAddress = require("../types/inet-address");
// TODO: remove once `lib/types/time-uuid.js` is converted to typescript.
// @ts-ignore
import TimeUuid = require("../types/time-uuid");

/**
 * A single event that happened during a traced query execution.
 * @alias module:metadata~TracingEvent
 */
class TracingEvent {
    readonly id: TimeUuid;
    readonly activity: string | null;
    readonly source: InetAddress | null;
    readonly elapsed: number | null;
    readonly thread: string | null;

    /**
     * Constructs a TracingEvent instance.
     *
     * @param {Uuid} id
     * @param {string | null} activity
     * @param {InetAddress | null} source
     * @param {number | null} elapsed
     * @param {string | null} thread
     * @internal
     * @ignore
     */
    constructor(
        id: TimeUuid,
        activity: string | null,
        source: InetAddress | null,
        elapsed: number | null,
        thread: string | null,
    ) {
        this.id = id;
        this.activity = activity;
        this.source = source;
        this.elapsed = elapsed;
        this.thread = thread;
    }
}

/**
 * Tracing information retrieved for a query that was executed with tracing enabled.
 * @alias module:metadata~QueryTrace
 */
class QueryTrace {
    readonly requestType: string | null;
    readonly coordinator: InetAddress | null;
    readonly parameters: Readonly<Record<string, string>>;
    readonly startedAt: Date | null;
    readonly duration: number | null;
    readonly clientAddress: InetAddress | null;
    readonly events: readonly TracingEvent[];

    /**
     * Constructs a QueryTrace instance.
     *
     * @param {string | null} requestType
     * @param {InetAddress | null} coordinator
     * @param {Record<string, string> | null} parameters
     * @param {Date | null} startedAt
     * @param {number | null} duration
     * @param {InetAddress | null} clientAddress
     * @param {TracingEvent[]} events
     * @internal
     * @ignore
     */
    constructor(
        requestType: string | null,
        coordinator: InetAddress | null,
        parameters: Record<string, string> | null,
        startedAt: Date | null,
        duration: number | null,
        clientAddress: InetAddress | null,
        events: TracingEvent[],
    ) {
        this.requestType = requestType;
        this.coordinator = coordinator;
        this.parameters = parameters || {};
        this.startedAt = startedAt;
        this.duration = duration;
        this.clientAddress = clientAddress;
        this.events = events;
    }
}

export { QueryTrace, TracingEvent };
