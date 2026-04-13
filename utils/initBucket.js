

import minioClient from "../config/minio.js";


async function initBucket() {
  const exists = await minioClient.bucketExists("public");

  if (!exists) {
    await minioClient.makeBucket("public", 'us-east-1');
    console.log('✅ Bucket created');
  } else {
    console.log('✅ Bucket already exists');
  }
}

export default initBucket;