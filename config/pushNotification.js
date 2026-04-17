import admin from "./firebase.js";
import { translateNotificationText } from "../utils/i18n.js";

const pushNotification = async (tokens, title, body, res, req) => {
  try {
    const localizedTitle = translateNotificationText(title);
    const localizedBody = translateNotificationText(body);
    const message = {
      notification: {
        title: localizedTitle,
        body: localizedBody,
      },
      tokens: tokens, 
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log("Successfully sent message:", response);

    const failedTokens = response.responses
    .map((resp, idx) => (!resp.success ? tokens[idx] : null))
    .filter(token => token !== null);

  if (failedTokens.length > 0) {
    console.log("List of tokens that caused failures:", failedTokens);
  }

    // return res.send({
    //   message: response,
    // });
  } catch (error) {
    console.error("Error sendring message:", error.message);
    // return res.send({
    //   message: error,
    // });
  }
};

export default pushNotification;
