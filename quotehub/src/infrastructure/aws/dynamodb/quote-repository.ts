import { PutCommand, QueryCommand, ScanCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb } from '../clients'
import { config } from '../../../config'
import { CarrierQuote, QuoteInput, QuoteStatus } from '../../../shared/types'

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

export async function updateQuoteInput(
    quoteId: string,
    input: QuoteInput,
): Promise<
    | { status: "updated"; updatedAt: string }
    | { status: "not-found" }
    | { status: "not-editable" }
> {
    const items = await getQuoteItems(quoteId);
    const meta = items.find((item) => item.sk === "META");
    if (!meta) return { status: "not-found" };
    if (meta.status !== "COMPLETED" && meta.status !== "FAILED") return { status: "not-editable" };

    const updatedAt = new Date().toISOString();
    const resultItems = items.filter((item) => typeof item.sk === "string" && item.sk.startsWith("RESULT#"));
    try {
        await ddb.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Update: {
                        TableName: config.table,
                        Key: { pk: pk(quoteId), sk: "META" },
                        UpdateExpression: "SET #input = :input, #status = :status, updatedAt = :updatedAt",
                        ConditionExpression: "#status IN (:completed, :failed)",
                        ExpressionAttributeNames: { "#input": "input", "#status": "status" },
                        ExpressionAttributeValues: {
                            ":input": input,
                            ":status": "PENDING",
                            ":updatedAt": updatedAt,
                            ":completed": "COMPLETED",
                            ":failed": "FAILED",
                        },
                    },
                },
                ...resultItems.map((item) => ({
                    Delete: {
                        TableName: config.table,
                        Key: { pk: pk(quoteId), sk: item.sk },
                    },
                })),
            ],
        }));
    } catch (error) {
        if (
            typeof error === "object" &&
            error !== null &&
            "name" in error &&
            error.name === "TransactionCanceledException"
        ) {
            const reasons = "CancellationReasons" in error ? error.CancellationReasons : undefined;
            if (
                Array.isArray(reasons) &&
                reasons[0]?.Code === "ConditionalCheckFailed"
            ) {
                return { status: "not-editable" };
            }
        }
        throw error;
    }
    return { status: "updated", updatedAt };
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

export async function getAllQuoteItems(): Promise<Record<string, any>[]> {
    const items: Record<string, any>[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
        const out = await ddb.send(
            new ScanCommand({
                TableName: config.table,
                ExclusiveStartKey: lastEvaluatedKey,
            }),
        );
        items.push(...(out.Items ?? []));
        lastEvaluatedKey = out.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items;
}