const { S3Client, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'web/backend/../../.env') });

const BUCKET_NAME = 'my-storge-tool';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.Endpoint_URL,
  credentials: {
    accessKeyId: process.env.Access_Key_ID,
    secretAccessKey: process.env.Secret_Access_Key,
  },
  forcePathStyle: true,
});

async function checkBucket() {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    MaxKeys: 10,
  });
  const res = await r2Client.send(command);
  for (const obj of res.Contents || []) {
    if (obj.Key.endsWith('.mp4')) {
      const head = await r2Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: obj.Key }));
      console.log(`File: ${obj.Key} | Content-Type: ${head.ContentType}`);
    }
  }
}

checkBucket();
