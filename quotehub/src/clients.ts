import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { awsClientConfig } from "./config";

export const s3 = new S3Client({ ...awsClientConfig, forcePathStyle: true });
export const sqs = new SQSClient(awsClientConfig);

export const rawDdb = new DynamoDBClient(awsClientConfig);
export const ddb = DynamoDBDocumentClient.from(rawDdb, {
  marshallOptions: { removeUndefinedValues: true },
});