import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb } from './clients'
import { config } from './config'
import { CarrierQuote, QuoteInput, QuoteStatus } from './types'

const pk = (quoteId: string) => `QUOTE#${quoteId}`;

export async function createQuote(
    quoteId: string,
    input: QuoteInput,
    documentKey?: string,
): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: config.table,
            Item: {
                pk: pk(quoteId),
                sk: "META",
                status: "PENDING" satisfies QuoteStatus,
                input,
                documentKey,
                createdAt: new Date().toISOString(),
            },
            ConditionExpression: "attribute_not_exists(pk)",
        }),
    );
}

export async function setStatus(quoteId: string, status: QuoteStatus): Promise<void> {
    await ddb.send(
        new UpdateCommand({
            TableName: config.table,
            Key: {
                pk: pk(quoteId),
                sk: "META",
            },
            UpdateExpression: "SET #s = :s, updatedAt = :u",
            ExpressionAttributeNames: {
                "#s": "status",
            },
            ExpressionAttributeValues: {
                ":s": status,
                ":u": new Date().toISOString(),
            },
        }),
    );
}

export async function saveCarrierResult(quoteId: string, result: CarrierQuote): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: config.table,
            Item: {
                pk: pk(quoteId),
                sk: `RESULT#${result.carrier}`,
                ...result,
            },
        })

    )
}


export async function getQuoteItems(quoteId: string): Promise<Record<string, any>[]> {
    const out = await ddb.send(
        new QueryCommand({
            TableName: config.table,
            KeyConditionExpression: "pk = :pk",
            ExpressionAttributeValues: {
                ":pk": pk(quoteId),
            },
        })
    );

    return out.Items ?? []
}