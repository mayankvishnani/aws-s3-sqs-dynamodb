import type { CarrierQuote, QuoteInput } from "../../shared/types";

export interface Carrier {
    name: string;
    getQuote(input: QuoteInput): Promise<CarrierQuote>;
}

function mockCarrier(name: string, rate: number, failureRate: number): Carrier {
    return {
        name,
        async getQuote(input: QuoteInput): Promise<CarrierQuote> {
            await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 700));
            if (Math.random() < failureRate) throw new Error(`${name} API timeout`);
            return {
                carrier: name,
                premium: Math.round(input.annualRevenue * rate),
                currency: "USD",
                coverageLimit: 1_000_000,
            };
        }
    }
}

export const carriers: Carrier[] = [
    mockCarrier("Acme Mutual", 0.004, 0.09),
    mockCarrier("Globex Corporation", 0.003, 0.3),
    mockCarrier("Initech Speciality", 0.005, 1),
]