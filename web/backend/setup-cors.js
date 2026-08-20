const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

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

async function setupCORS() {
  try {
    console.log('Đang cấu hình CORS cho bucket:', BUCKET_NAME);
    const command = new PutBucketCorsCommand({
      Bucket: BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedOrigins: ['*'], // Cho phép upload từ mọi nguồn (localhost, render.com)
            ExposeHeaders: ['ETag', 'Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    });

    await r2Client.send(command);
    console.log('✅ Đã cấu hình CORS thành công trên Cloudflare R2!');
  } catch (err) {
    console.error('❌ Lỗi cấu hình CORS:', err);
  }
}

setupCORS();
