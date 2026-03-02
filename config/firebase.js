// firebase.js
import admin from "firebase-admin";

const serviceAccount = {
  type: "service_account",
  project_id: "ask-service-7eeda",
  private_key_id: "1917c0d51b4231ee402fb933345932dfe6c92f21",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC/8nHGvdYMbPD+\n8rnHgz0tpS3xvWAddmf8VgjcCMiqQ+aGVycsXB6CZbRyhTxki4FQP+6jalzIWoHg\nkqqZ/1Ip+FpZcvJNdlBdxRMQXqQw30YnmavpRHP3V8qkr88XFt7GM2KnyM1/BwLL\n/IMx9MYf5juX9fiZc1AgaWmsanViZpcvaoXTkgci9Q7NUBQTkjN+u3iDil4vcpEl\nBk8FedYluPAjjo5XqCxXIUk9gBbP0hnnwv1uErQVe+Vx7j8g6dPIoas7naWYOet+\njUFfU1xeMbEa/5xANmE5IUddnoYm1uI060iOiF3XXUK/ofFYWnvQeBipgG3D1ysP\nRofgNWybAgMBAAECggEAAQtMFCUvN2UWUIS4fv3XRNrLq694iOB+g1BifvPrR4XU\nCLILrAGaRuJPv3m7EN7zZqDaZvgqpgpb/4E8vVa2tzS7JRZrfAFjQYdTabjiEsP8\nKTX8SeoN6XAIUaoFKd59er2H0VrVx1Wd7ccjXY+zzjOd6l8zqX4Hlw2LvhzcI5th\n1XlDjdrBBjUlq9bYber76bjQTKg5/KS8ZVkjCfcycmnqW+c4Mewc69lr1yfGKSzE\ndQIbgSH/TPNONBbwyx4uwolCefqL8K79i0OcPZQKP3P0/MVnf1/j4zVEEkUaXhHx\nVtMuRU7GhhxincdTRXWGJYIbkFM8DJuiJ4utrjnqVQKBgQD1xRa20UoR50mNjCJX\nxEt2XcDdlzsAVqYQNThcsBseeZEOFnteyFKrKQep+2ulPsj0PPeE/oobkclR3pEW\nYpwwFun395RhA6yUL3KB+JjRt7orCwORCdVq7lVZVKbYPotPjirTYvQeEkVw6/G0\nDKDYqoXI7cePKpk03kprrRWQlwKBgQDH79KIMRhKtrMhwhB1v1xnKzqAA/0KpDfU\niLwTSsnGrEEt8KdmwE1b3clrJDJgXnYz1MHEYYeRAxU0JQiCGphop0qKhbmeLTJW\nxGbctSiI3C0+cszQ2L+P5LefYM8CKLNnA7sA2Pcblnt4qnCnAqBtoI7NzomQzHRZ\nKNjC3ZpAnQKBgFg0uRc5/Ax65vIPRlAbmj3MHikpWrqfXpBYmXbimYkRdlcJCJQW\n71yQqDiAjLzM0NCfhPJNbIHCi+9/IrFXCNlVj/k3+R/scqbodH9jGm3CM+W42TnX\nvqnXCfi6ofrgT51o18PwMs8MHbIObDwDgELiyIs5k7K1RjEsSqdkgmXXAoGAeEaU\nTyvBokiQMHGvNzZcHxBJS/OaSMmLcIalJbHq+mJrf3hzLAPpRaeBYLvQtlp9HycR\nPdMyG5FQMyNIIARhxStGU1io1jf4PWw/OOyeKt7RNO0Yu1Z4vtZnhDBXt8PGUOVU\nnOjolqcLNgbKaB3TZr+cyMBDz2C/aVeCNo/bGJ0CgYAn5eYUk/BSGi2Ym5napiMN\njz7oPJ/THSQBGSmgwRvUE8DV4eYZBW1MqbOECxiVAs5hdS2lWmoqWROBpDEVijHX\nCVGl5i9/OZKs9hWEW4KylAtVEEQFl3x6pDvq7wEhHIzNzK0CxFs7xrf1yMk+bwvW\npCfUTBRXsfhJjlmuN2V4IA==\n-----END PRIVATE KEY-----\n",
  client_email:
    "firebase-adminsdk-fbsvc@ask-service-7eeda.iam.gserviceaccount.com",
  client_id: "108740307096112156640",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40ask-service-7eeda.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
