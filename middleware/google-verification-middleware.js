import admin from "../config/firebase.js";
import handleResponse from "../utils/http-response.js";




// Middleware to verify Firebase ID token
async function firebaseAuthenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const idToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!idToken) {
    return handleResponse(401, "No token provided" ,{}, res);

  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;

    next();
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
}

export default firebaseAuthenticateToken