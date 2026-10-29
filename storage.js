// Storage layer.
// If the S3_BUCKET environment variable is set, tasks are stored as a JSON
// object in Amazon S3 (cloud storage). Otherwise a local file is used, so you
// can test the app on your own computer before deploying.

const fs = require("fs/promises");
const path = require("path");

const BUCKET = process.env.S3_BUCKET;
const KEY = process.env.S3_KEY || "tasks.json";
const REGION = process.env.AWS_REGION || "us-east-1";
const LOCAL_FILE = path.join(__dirname, "data", "tasks.json");

let s3, GetObjectCommand, PutObjectCommand;
if (BUCKET) {
  const sdk = require("@aws-sdk/client-s3");
  s3 = new sdk.S3Client({ region: REGION });
  GetObjectCommand = sdk.GetObjectCommand;
  PutObjectCommand = sdk.PutObjectCommand;
}

async function read() {
  if (BUCKET) {
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
      return JSON.parse(await res.Body.transformToString());
    } catch (err) {
      if (err.name === "NoSuchKey") return []; // first run: nothing saved yet
      throw err;
    }
  }
  try {
    return JSON.parse(await fs.readFile(LOCAL_FILE, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function write(tasks) {
  const body = JSON.stringify(tasks, null, 2);
  if (BUCKET) {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: KEY,
      Body: body,
      ContentType: "application/json",
    }));
    return;
  }
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, body);
}

const mode = BUCKET ? `Amazon S3 (bucket: ${BUCKET}, region: ${REGION})` : "Local file (development mode)";

module.exports = { read, write, mode };
