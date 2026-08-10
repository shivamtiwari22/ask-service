

// import minioClient from "../config/minio.js";


// async function initBucket() {
//   const exists = await minioClient.bucketExists("public");

//   if (!exists) {
//     await minioClient.makeBucket("public", 'us-east-1');
//     console.log('✅ Bucket created');
//   } else {
//     console.log('✅ Bucket already exists');
//   }
// }


import { HeadBucketCommand } from "@aws-sdk/client-s3";
import s3 from '../config/s3.js';

async function initBucket() {
  try {
    await s3.send(
      new HeadBucketCommand({
        Bucket: process.env.S3_BUCKET_PUBLIC,
      })
    );

    console.log("✅ Cloudflare R2 Public bucket accessible");
  } catch (err) {
    console.error("❌ Cannot access Cloudflare R2 public bucket");
    console.error(err);
  }
}


export default initBucket;