// firebase.js
import admin from "firebase-admin";

const serviceAccount = {
  type: "service_account",
  project_id: "ask-service--login",
  private_key_id: "5b53a0eab4d396924939640442c286c7ab65a33e",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC8MciTVd8+DA9t\nqMEXLUkAbd7x5uR2ATl2s4VuJZF3v2H0xG3gAOGX/zaB09pe4FF5YbjW39a+sAnB\n1UA1YTqf/mjji0XovaTcLgQHsvHGavlyu7Y7QCO/f/yY1o4FU7yS2ZWfUSsF+aY1\nZH82CMLfRFvk+Gs0sSERFYmkNVqcf4JUl/GK+cAbGnMIvVvJPmlJ//rZcIa+rEec\nLgg4gPG9G7hFJzRprKpO0duNPZD6QygkKqQjMmjVFBdTBwwdoSmw1HQL21M12kQw\n5O8ZExNJvVzEy4347TK+OwZAq2RLM+yPBQSGH1zY4qNlhgxyFkZVCVlbGm4vCpZx\nPDIcWlrXAgMBAAECggEACKLNT/tOFm006197JG1onuiy7DSDnltSlVl77fKIKt34\nQWRXvN7vQl1JRzWNZCuC7EgwcNfR84fXDXMwddRnGelxoNxcGUtwWOJ2IoyIO2oX\n1cWeK//94Ggt9vRoN+Mj36Zfq5v6+inUAh1WijMRDqkFAWjLXNckOgkxeu6FZ8dT\n3p0SZku7Nbfyk3EjtzMhZ4ueJIO6kgPPGulEniUA6djY6bxzCPxwahyAG+2Hj1Lp\n5ZHvCi11uk4UFUVCA1hcj/vmL1Kn+mvLHJQgg9K+zKoCK57/NPsqmwqcbkaUivci\nhVGOIbqg4OQ0THZkSoWZfEUTd7H9tamugMT+UhgpjQKBgQD2X5GgAbpG94gLaGqw\nCom8zdI/fdlzR74vze2X6UL0NOoqKDN7bjrYLQARwmlXbVcnDxpugmL/DcNqbjpY\nVAa6ft9ZEGF/1zT2xQnlBE/BtJWTDFmX+8nnJPG1occY2gwWCKA5CJ+EkonNID1z\nlkRFqzZUOImitFylMcOuktxifQKBgQDDjELm2+pgnj7P2cb6ncMFvb7hTpPA8xQ6\nRrUxXQDAzK1RJxft2EMpoCBqEAl03tnYOqGoV32JeVu8ndzRjGLoki3IjK1jxBhB\nIvXBadJpt9rdTCAO5ONuVJjGiAVcnTwL7NVnTv63nS4o36rjfbm0MhLdwtovLKAl\nznbzRMP+4wKBgDdQeaeM+7+XL6owBVQE6avEIiIzJTEmuGKPP3rN2kRt5O0WHYjm\n1LtYTx2tom0IlXqlf2+0Qnm1I1yv5tWR9/jDJ24dqWZEcRW+Y1xRvX5mBvb+3Nas\np0YIG2SGL+c6fWAtC5wCfZ4MMHgnduSOpkFmEUqTbwNirzI/nAmD24sZAoGBAJ2q\ndLLA9Avs64YY+FdPZlQ1tjbhbT5wf4mxQxzG+Pl6ze+VzrRl31krk5cQ0R8bI5g1\nRex+hmiWogHFYqrOP113p1SBILhE/q1eK7pDwXSd2ej+HQcFQ97MdNX2DCStXiHb\nVgFS7wtKv1ITbSy5TUbd7NpC5jqNB58UBlKEymazAoGBAM4eEYmnOI+KEADPgq8s\nQ0b26WKJ7gbPdPtF8b1Qqo/LlZHK9S+46bUlSh41bbv2I9Qx7IsgZReH34/MgR8E\nejMkJTkQkzdPO/NFLtRMQ1mi9nq40Y/dPR41SzcrehSvHLO8JL92gRetm5JdCAKh\n2Ld3CB9CiB/vvD+S6KrwvoKA\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@ask-service--login.iam.gserviceaccount.com",
  client_id: "111582468827369878083",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:  "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40ask-service--login.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
