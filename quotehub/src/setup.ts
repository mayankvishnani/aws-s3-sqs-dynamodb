import { CreateTableCommand } from "@aws-sdk/client-dynamodb";
import { CreateBucketCommand } from "@aws-sdk/client-s3";
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";
import { rawDdb, s3, sqs } from "./clients";
import { config } from "./config";

async function safely(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    console.log(`created ${label}`);
  } catch (error: unknown) {
    const errorName =
      typeof error === "object" && error !== null && "name" in error
        ? String(error.name)
        : "";

    if (
      ["BucketAlreadyOwnedByYou", "BucketAlreadyExists", "ResourceInUseException"].includes(
        errorName,
      )
    ) {
      console.log(`${label} already exists`);
      return;
    }

    throw error;
  }
}

async function main(): Promise<void> {
  await safely("bucket", () =>
    s3.send(new CreateBucketCommand({ Bucket: config.bucket })),
  );

  await safely("table", () =>
    rawDdb.send(
      new CreateTableCommand({
        TableName: config.table,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "sk", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ],
      }),
    ),
  );

  const dlq = await sqs.send(new CreateQueueCommand({ QueueName: config.dlqName }));
  if (!dlq.QueueUrl) throw new Error("could not create or find the DLQ");

  const dlqAttrs = await sqs.send(
    new GetQueueAttributesCommand({
      QueueUrl: dlq.QueueUrl,
      AttributeNames: ["QueueArn"],
    }),
  );
  const dlqArn = dlqAttrs.Attributes?.QueueArn;
  if (!dlqArn) throw new Error("could not read DLQ ARN");

  await sqs.send(
    new CreateQueueCommand({
      QueueName: config.queueName,
      Attributes: {
        VisibilityTimeout: "30",
        ReceiveMessageWaitTimeSeconds: "20",
        RedrivePolicy: JSON.stringify({
          deadLetterTargetArn: dlqArn,
          maxReceiveCount: 3,
        }),
      },
    }),
  );
  console.log("queues ready");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});