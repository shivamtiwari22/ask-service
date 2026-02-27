import handleResponse from "../../../utils/http-response.js";
import Notification from "../../models/NotificationModel.js";
import User from "../../models/UserModel.js";


class notificationController {


  static mine = async (req, res) => {
    try {
      const notification = await Notification.find({
        user_id: req.user._id,
      }).sort({ id: -1 });
      return handleResponse(200, "notification", notification, res);
    } catch (e) {
      console.error("Error approving innovation:", e);
      return handleResponse(500, "Error approving innovation", {}, res);
    }
  };

  static count = async (req, res) => {
    try {
      const unreadCount = await Notification.countDocuments({
        user_id: req.user._id,
        is_read: false,
      });

      return handleResponse(200, "notification count", unreadCount, res);
      
    } catch (e) {
      console.error("Error approving innovation:", e);
      return handleResponse(500, "Error approving innovation", {}, res);
    }
  };


   static unread = async (req, res) => {
    try {
      const unreadCount = await Notification.find({
        user_id: req.user._id,
        is_read: false,
      });

      return handleResponse(200, "unread notification", unreadCount, res);
      
    } catch (e) {
      console.error("Error approving innovation:", e);
      return handleResponse(500, "Error approving innovation", {}, res);
    }
  };


  static markAsRead = async (req, res) => {
    try {  
    const { id} = req.body ;
    const notification = await Notification.findById(id);

      if (!notification) {
        return handleResponse(200, 'Invalid notification.', {}, res);
      }

        notification.is_read = true;
        await notification.save();
      
      return handleResponse(200, "notification read ", {}, res);

    } catch (e) {
      console.error("Error approving innovation:", e);
      return handleResponse(500, "Error approving innovation", {}, res);
    }
  };



    static older = async (req, res) => {
    try {
      const notification = await Notification.find({
        user_id: req.user._id,
      }).sort({ id: 1 });
      return handleResponse(200, "notification", notification, res);
    } catch (e) {
      console.error("Error approving innovation:", e);
      return handleResponse(500, "Error approving innovation", {}, res);
    }
  };





    static testPush = async (req, res) => {
    try {
  
      const title = "New Message";
      const body = "This is the dummy push notification!";
      const tokens = [
        'cC4g-YnRTwGSmdO4nlLrOg:APA91bEex6a9ZWl7gAiHAbHiqyZdHB6O1rxBWg1EjUBROi9iAxJipMnTav5oTq07hmgqIcTNFYQk2Ailm9HBuZh6y8-hu7s4tnhRQxklOCqCcmU-AwxN2MY'
        // 'cvN-_psvT7-w_0Izc9dFON:APA91bEMQENf9607D6Danc1ZCz9xBmvUVprNkoypcwhXK3cPvvQ7iE3vqVV84jqoNnmHqlQbb-rRRWepnamlXtlc5Z9pKx-RE-Ez4CQxpebRnd-e69RcVE_yqSBVgD_G5jXnWlR6RlT3',
        // 'fCnp3HovsVjARzfhejzxpy:APA91bE_XhYyKB3w7yOoj8sGxGkwLP8-oFjarAlIG5j4dJg2g2YhQ1XK0eNZ6QVv0wBnKrsI2UpfYNurcEI-kZFG2JqnqV10AepaB2njgdKkt7PR8Wv3LpPKf9BV3C8BVO1LH3t6d7Ti'
      ];

        // pushNotification(tokens,title,body)

    // const not =   notifications(1,"testing titile","description");


      return handleResponse(200, "send", {}, res);

    } catch (error) {
      console.log(error);
      return handleResponse(500, error.message, {}, res);
    }
  };


  static ChatMessages = async (req,res) => {
        const {user_id} = req.params
    try {
      const requiredFields = [
        { field: "user id", value: user_id },
      ];
   
       const user = await User.findById(user_id);

       if (!user) {
        return handleResponse(404, "Not Found", {}, res);
      }
       
      const title = "New Message";
      const body = `You have a new message from ${req.user.first_name}!`;
      const token =  user.fcm_token;
      
      // console.log(pushNotification(token,title,body));
      

      return handleResponse(200, "send", {}, res);

    } catch (error) {
      console.log(error);
      return handleResponse(500, error.message, {}, res);
    }
  }



  
}

export default notificationController;
