export const config = {
  region: "us-east-1",
  bucket: "quotehub-documents",
  table: "QuoteHub",
  queueName: "quote-requests",
  dlqName: "quote-requests-dlq",
};

export const awsClientConfig = {
  region: config.region,
  endpoint: "http://localhost:4566",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
};