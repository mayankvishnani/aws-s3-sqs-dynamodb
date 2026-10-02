import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "./clients";
import { config } from "./config";

export async function createUploadUrl(
  contentType: string,
): Promise<{ key: string; url: string }> {
  const key = `uploads/${randomUUID()}`;
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(s3, command, {
    expiresIn: 300,
    signableHeaders: new Set(["content-type"]),
  });
  return { key, url };
}

export async function createDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: config.bucket, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 300 });
}