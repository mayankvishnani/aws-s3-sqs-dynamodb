import { createUploadUrl } from "../infrastructure/aws/s3/document-storage";

async function main(): Promise<void> {
  const upload = await createUploadUrl("image/png");
  console.log(JSON.stringify(upload, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});