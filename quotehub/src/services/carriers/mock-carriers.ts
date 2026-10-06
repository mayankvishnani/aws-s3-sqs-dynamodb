import type { CarrierQuote, QuoteInput } from "../../shared/types";

export interface Carrier {
    name: string;
    timeoutMs: number;
    maxAttempts: number;
    retryDelayMs: number;
    getQuote(input: QuoteInput, signal: AbortSignal): Promise<CarrierQuote>;
}

export class CarrierRequestError extends Error {
    constructor(
        message: string,
        readonly retryable: boolean,
    ) {
        super(message);
        this.name = "CarrierRequestError";
    }
}

interface MockCarrierOptions {
    name: string;
    timeoutMs: number;
    maxAttempts: number;
    retryDelayMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    transientFailureRate: number;
    permanentFailureRate: number;
    quote(input: QuoteInput): CarrierQuote;
}

function waitForLatency(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new CarrierRequestError("request was aborted", true));
            return;
        }

        const timeout = setTimeout(() => {
            signal.removeEventListener("abort", onAbort);
            resolve();
        }, ms);

        function onAbort(): void {
            clearTimeout(timeout);
            reject(new CarrierRequestError("request was aborted", true));
        }

        signal.addEventListener("abort", onAbort, { once: true });
    });
}

function mockCarrier(options: MockCarrierOptions): Carrier {
    return {
        name: options.name,
        timeoutMs: options.timeoutMs,
        maxAttempts: options.maxAttempts,
        retryDelayMs: options.retryDelayMs,
        async getQuote(input, signal): Promise<CarrierQuote> {
            const latency =
                options.minLatencyMs +
                Math.random() * (options.maxLatencyMs - options.minLatencyMs);
            await waitForLatency(latency, signal);

            const failure = Math.random();
            if (failure < options.permanentFailureRate) {
                throw new CarrierRequestError(`${options.name} rejected the request`, false);
            }
            if (failure < options.permanentFailureRate + options.transientFailureRate) {
                throw new CarrierRequestError(`${options.name} temporary service failure`, true);
            }

            return options.quote(input);
        },
    };
}

function quote(
    carrier: string,
    input: QuoteInput,
    rate: number,
    coverageLimit: number,
): CarrierQuote {
    return {
        carrier,
        premium: Math.round(input.annualRevenue * rate),
        currency: "USD",
        coverageLimit,
    };
}

export const carriers: Carrier[] = [
    mockCarrier({
        name: "Acme Mutual",
        timeoutMs: 700,
        maxAttempts: 2,
        retryDelayMs: 100,
        minLatencyMs: 100,
        maxLatencyMs: 350,
        transientFailureRate: 0.04,
        permanentFailureRate: 0.01,
        quote: (input) => quote("Acme Mutual", input, 0.004, 1_000_000),
    }),
    mockCarrier({
        name: "Globex Corporation",
        timeoutMs: 650,
        maxAttempts: 3,
        retryDelayMs: 150,
        minLatencyMs: 250,
        maxLatencyMs: 850,
        transientFailureRate: 0.2,
        permanentFailureRate: 0.03,
        quote: (input) => quote("Globex Corporation", input, 0.003, 750_000),
    }),
    mockCarrier({
        name: "Initech Speciality",
        timeoutMs: 900,
        maxAttempts: 2,
        retryDelayMs: 200,
        minLatencyMs: 500,
        maxLatencyMs: 1_100,
        transientFailureRate: 0.08,
        permanentFailureRate: 0.02,
        quote: (input) => quote("Initech Speciality", input, 0.005, 1_500_000),
    }),
];

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function getQuoteWithTimeout(
    carrier: Carrier,
    input: QuoteInput,
): Promise<CarrierQuote> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
            reject(new CarrierRequestError(`request timed out after ${carrier.timeoutMs}ms`, true));
            controller.abort();
        }, carrier.timeoutMs);
    });

    try {
        return await Promise.race([
            carrier.getQuote(input, controller.signal),
            deadline,
        ]);
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

export async function requestCarrierQuote(
    carrier: Carrier,
    input: QuoteInput,
): Promise<CarrierQuote> {
    for (let attempt = 1; attempt <= carrier.maxAttempts; attempt += 1) {
        try {
            return await getQuoteWithTimeout(carrier, input);
        } catch (error) {
            const canRetry =
                error instanceof CarrierRequestError && error.retryable;
            if (!canRetry || attempt === carrier.maxAttempts) throw error;

            const delayMs = carrier.retryDelayMs * 2 ** (attempt - 1);
            console.warn(
                `carrier ${carrier.name} attempt ${attempt}/${carrier.maxAttempts} failed ` +
                `(${errorMessage(error)}); retrying in ${delayMs}ms`,
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    throw new Error(`carrier ${carrier.name} did not return a quote`);
}
