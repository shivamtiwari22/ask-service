import Notification from "../src/models/NotificationModel.js";

const notifications = async(send_to,title,msg) => {
  
    const notification = new Notification({
        title: title,
        user_id: send_to,
        body: msg,
      });
      await notification.save();

      return notification;
  };


  export default notifications