import{ DeleteMessageCommand, GetQueueUrlCommand, ReceiveMessageCommand, SendMessageCommand, type Message } from "@aws-sdk/client-sqs";
import { sqs } from "./clients";
import { config } from "./config";
import type { QuoteMessage } from "./types";

let cachedUrl: string | undefined;

async function getQueueUrl(): Promise<string> {
    if (!cachedUrl){
        const out = await sqs.send(new GetQueueUrlCommand({ QueueName: config.queueName }));
        if (!out.QueueUrl) throw new Error("queue not found. Did you run `npm run setup`?");
        cachedUrl = out.QueueUrl;
    }        
    return cachedUrl;
}

export async function enqueueQuote(message: QuoteMessage): Promise<void> {
    await sqs.send(
        new SendMessageCommand({
            QueueUrl: await getQueueUrl(),
            MessageBody: JSON.stringify(message),
        })
    );
}

export async function receiveMessages(): Promise<Message[]> {
    const out = await sqs.send(
        new ReceiveMessageCommand({
            QueueUrl: await getQueueUrl(),
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
        })
    );
    return out.Messages ?? [];
}

export async function deleteMessage(receiptHandle: string): Promise<void> {
    await sqs.send(
        new DeleteMessageCommand({
            QueueUrl: await getQueueUrl(),
            ReceiptHandle: receiptHandle,
        }),
    );
}