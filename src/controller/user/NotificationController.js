import pushNotification from "../../../config/pushNotification.js";
import handleResponse from "../../../utils/http-response.js";
import Notification from "../../models/NotificationModel.js";
import User from "../../models/UserModel.js";


class notificationController {


  static mine = async (req, res) => {
    try {


       const role = req.user?.role?.name ;

      const notification = await Notification.find({
        user_id: req.user._id,
        for: "User"
      }).sort({ id: -1 });

      return handleResponse(200, "notification", notification, res);
    } catch (e) {
      console.error("Error approving innovation:", e);
      return handleResponse(500, "Error approving innovation", {}, res);
    }
  };


   static vendorNotifications = async (req, res) => {
    try {


       const role = req.user?.role?.name ;

      const notification = await Notification.find({
        user_id: req.user._id,
        for: "Vendor"
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
        for: "User"

      });

      return handleResponse(200, "unread notification", unreadCount, res);
      
    } catch (e) {
      console.error("Error approving innovation:", e);
      return handleResponse(500, "Error approving innovation", {}, res);
    }
  };


   static vendorUnread = async (req, res) => {
    try {
      const unreadCount = await Notification.find({
        user_id: req.user._id,
        is_read: false,
        for: "Vendor"

      });

      return handleResponse(200, "unread notification", unreadCount, res);
      
    } catch (e) {
      console.error("Error approving innovation:", e);
      return handleResponse(500, "Error approving innovation", {}, res);
    }
  };






  static markAsRead = async (req, res) => {
    try {  
    const { id} = req.params ;
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
      return handleResponse(404, "Not found", {}, res);
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
       
      const title = "Nouveau message";
      const body = `Vous avez un nouveau message de ${req.user.first_name} !`;
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
