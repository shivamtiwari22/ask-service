
import { Client } from 'minio';
// const Minio = require('minio');
const minioClient = new Client({
  endPoint: 'storage.webdesignnoida.in',
  port: 443,
  useSSL: true,
  accessKey: 'admin',
  secretKey: 'StrongPassword123',
});


export default minioClient;