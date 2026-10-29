import assert from "node:assert/strict";
import test from "node:test";
import {
    CarrierRequestError,
    requestCarrierQuote,
    type Carrier,
} from "./mock-carriers";
import type { CarrierQuote, QuoteInput } from "../../shared/types";

const input: QuoteInput = {
    businessName: "Example Bakery",
    industry: "food",
    annualRevenue: 500_000,
    state: "NY",
};

const expectedQuote: CarrierQuote = {
    carrier: "Test Carrier",
    premium: 2_000,
    currency: "USD",
    coverageLimit: 1_000_000,
};

function carrier(getQuote: Carrier["getQuote"]): Carrier {
    return {
        name: "Test Carrier",
        timeoutMs: 100,
        maxAttempts: 3,
        retryDelayMs: 0,
        getQuote,
    };
}

test("retries a transient failure and returns the successful quote", async () => {
    let attempts = 0;
    const testCarrier = carrier(async () => {
        attempts += 1;
        if (attempts < 3) {
            throw new CarrierRequestError("temporary failure", true);
        }
        return expectedQuote;
    });

    assert.deepEqual(await requestCarrierQuote(testCarrier, input), expectedQuote);
    assert.equal(attempts, 3);
});

test("does not retry a permanent carrier failure", async () => {
    let attempts = 0;
    const testCarrier = carrier(async () => {
        attempts += 1;
        throw new CarrierRequestError("request rejected", false);
    });

    await assert.rejects(
        requestCarrierQuote(testCarrier, input),
        /request rejected/,
    );
    assert.equal(attempts, 1);
});

test("enforces the timeout and aborts the carrier request", async () => {
    let wasAborted = false;
    const testCarrier = carrier((_input, signal) => new Promise<CarrierQuote>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
            wasAborted = true;
            reject(new CarrierRequestError("request aborted", true));
        }, { once: true });
    }));
    testCarrier.timeoutMs = 10;
    testCarrier.maxAttempts = 1;

    await assert.rejects(
        requestCarrierQuote(testCarrier, input),
        /timed out after 10ms/,
    );
    assert.equal(wasAborted, true);
});
