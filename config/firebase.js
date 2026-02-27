// firebase.js
import admin from 'firebase-admin';

const serviceAccount = {
  type: "service_account",
  project_id: "skip-e0649",
  private_key_id: "d3deb31603a2c110467529a3434919068af09e60",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDA87Ch/DYPKHg/\nCg1IEFyOg2WeSUQF6lCACfdPtbBQsd29FNzysVfvzRiziamvo/C/oCy+dfk1SbZs\nsjzPOUY4+Mg0/5AnBBr+ZKzRP5e+Z1DohkhiuvHTLKyOxPSynZOXltUwvUm0HwgZ\noe10KIL3ClK9FU3aiCvKMhXbA0AnIa5U4ZwJ/08vvOnlMnXy6P/rewIEiqf3uWUU\nIhyTvdJjCt2BvlEnG+Sgrp6w24Xx+0evh9sRcI7B9qGXYKZsH1AeXw4QjWodEHk7\n+P8QjgsXWMnaWb3gFQdr3Tdpt2pRfxwvi/r2/53AqJJ05XYewAW9ziS13Q9CWibL\nfxa5yNIhAgMBAAECggEAKUCQfXlaJ3B8EOI5x7PzzeZKxgYc/HTFpDI9RTXvjbkR\nUrkQqfR/e/3p74yZkjsnIBkDJ+86CgoJ7gBHXvh8Snbp+ua+r5DBoqzsg8ooS6V0\nF1qKRE16oS72b4mtVTi6UtkFGGgHx3Iw/aXwifqVUXLMEK/q1rNxRUfjA1GVGChM\nvOlBF7SRyAO+1k1sOOBVw7CJiS1YiqqsXl7++sTJMrJT2C6TDveDkYAjkhTgdwr2\nHUWDiDRPRNHIbVVtIzqfe61HuHZx1xWpsCjND9LECR6IpJ7epVNb534WP+TPC+pz\ntM+Y/wLPoVh4y3s31Rpo4yyhUUbzFyxEMBzH7NwsaQKBgQDh3RkRbZ/QiVMZut5H\n9NqZ4pLLy8tHpYIcFds5Gx6M3bGJZYcswkX6BAKdzKdgnDBROfVhl5eZ5Q+oIiE9\nN4KKxWBRGx1fAUJ6sZZuTEOybNLXM2w2QokWO9iSr1B8OHdCkrtJmbetK61DSmfg\nFv1Jp/uFPnrA+Rqm2dRgmcvsbQKBgQDasmoJQUW3CoJHw7c+M8MOhtwcy0fhwCfv\n5TZD03fobpVK0cOFT2JtOqCjRwWSrXmsabilRqfmb5HDtmwHTuiGyIPAMC8hlL9f\nbJqdsOYys6FB/WJ1GDBNHDZ9nGQwyCDE4TARxuOj4PC1rLSl8oaUHdWJiLfQrDty\nO+toRVmEBQKBgH0y+fpXMgd+l7njg+OPLr2ugoDFbuFANWcsFmEJT132ZbsrtEpz\nRibYojqmfwFmksHzxrlaNobwGkWw5YvxgUM7NbC/vwAyyo8IccKiM8Rr3lO8BXfu\nWd8hPWPSGmNBSZp1i6u4scAkPd7XF8138N8rZpjtkU32x3dFuBv0JL3hAoGBAMON\nL0WRSO4wBmh3N9312N+fdSiGGINjGBLpaQljCOAcKYBaarNEVaWH++Wj9va+CYNC\nkWmv8Sga8UMIVjZ+t2r11uE99JbZc/m2mdaRPHVvq6zfDm/XrjD1HkBZXDlGag7B\nsQLkTd7Wn0ZD5NBSOUYuGye8yWhc6Vbu/0MgZ7elAoGBAMxD0ZHbKX6YTKNbenA9\n0zd23cLfzOo6n/WU34GOPLi9hOohrn+PRJibk5xl1ycIg/m18+bWgkFCo8PxCJ0F\nH+RwVoUV0okspIarEpST0BCoK4M+v1kQ11rubv/XCiJHhCQHeMT59ZaclDr5Zo7A\nCxvsKFVfean/nkc1dv3YHtuk\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-3l1nl@skip-e0649.iam.gserviceaccount.com",
  client_id: "118206947181092917455",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-3l1nl%40skip-e0649.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
