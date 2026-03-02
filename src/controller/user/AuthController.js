import User from "../../models/UserModel.js";
import handleResponse from "../../../utils/http-response.js";
import {
  comparePassword,
  generateOTP,
  generateOneMinToken,
  generateToken,
  hashPassword,
} from "../../../utils/auth.js";
import Role from "../../models/RoleModel.js";
import moment from "moment";
import crypto from "crypto";
import { sendEmail } from "../../../config/emailConfig.js";
import { cookieOptions } from "../../../utils/helperFunction.js";
import VendorCreditWallet from "../../models/VendorCreditWalletModel.js";
import UserNotification from "../../models/userNotificationModel.js";
import { log } from "console";
import bcrypt from "bcryptjs";
import normalizePath from "../../../utils/imageNormalizer.js";

// SIGNUP
export const signup = async (req, resp) => {
  try {
    const { first_name, last_name, phone, email, password } = req.body;

    if (!phone && !email) {
      return handleResponse(400, "Phone or email are required", {}, resp);
    }

    const existingUser = await User.findOne({
      $or: [{ phone }, ...(email ? [{ email }] : [])],
    });

    // let existingUser ;
    // if(email){
    // let existingUser = await User.findOne({
    //      email:email,
    // });
    // }

    // if(phone){
    //      let existingUser = await User.findOne({
    //    phone:phone,
    // });
    // }




    if (existingUser) {
      return handleResponse(409, "User already exists", {}, resp);
    }

    const role = await Role.findOne({ name: "User" });

    const phoneOtp = generateOTP();
    const emailOtp = generateOTP() ;
    const emailToken = email ? crypto.randomBytes(32).toString("hex") : null;

 const user =   await User.create({
      first_name,
      last_name,
      phone,
      email: email || null,
      password: await hashPassword(password),
      role: role._id,
      status: "ACTIVE",
      is_phone_verified: false,
      is_email_verified: false,
      phone_otp: phoneOtp,
      phone_otp_expiry: moment().add(5, "minutes").toDate(),
      otp : emailOtp ,
      email_verification_token: emailToken,
    });

    await VendorCreditWallet.create({
      user_id: user._id,
    });

    if (email) {
      const link = `https://ask.webdesignnoida.in/api/user/verify-email?token=${emailToken}`;

      await sendEmail({
        to: email,
        subject: "Verification OTP",
        html: `<p>One time password:${emailOtp}</p>
                `,
      });
    }

    return handleResponse(
      201,
      "Signup successful. Verify to continue.",
      { flow: phone ?"PHONE_VERIFICATION_REQUIRED" : "EMAIL_VERIFICATION_REQUIRED" },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// VERIFY PHONE
export const verifyPhone = async (req, resp) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return handleResponse(400, "Phone and OTP are required", {}, resp);
    }

    const user = await User.findOne({ phone });
    if (!user) return handleResponse(404, "User not found", {}, resp);
         const role = await Role.findById(user.role).select("id name");

    // if (
    //   !user.phone_otp ||
    //   !user.phone_otp_expiry ||
    //   moment().isAfter(user.phone_otp_expiry)
    // ) {
    //   return handleResponse(400, "OTP expired", {}, resp);
    // }

    if (user.otp_phone !== otp) {
      return handleResponse(401, "Invalid OTP", {}, resp);
    }

    user.is_phone_verified = true;
    user.phone_otp = null;
    user.phone_otp_expiry = null;

    await user.save();


       const token = generateToken(user.toObject());



    return handleResponse(200, "verified successfully", {token,role}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

//  VERIFY EMAIL (LINK BASED)
export const verifyEmail = async (req, resp) => {
  try {
    const { email , otp} = req.body;

  
     const user = await User.findOne({ email });
    if (!user) return handleResponse(404, "User not found", {}, resp);
         const role = await Role.findById(user.role).select("id name");



    if (user.otp !== otp) {
      return handleResponse(401, "Invalid OTP", {}, resp);
    }

    user.is_email_verified = true;
    user.otp = null;

    await user.save();

       const token = generateToken(user.toObject());


    return handleResponse(200, "OTP Verified successfully", {token,role}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};



export const loginPhoneEmail = async (req, resp) => {
  try {
    const { email, phone, type } = req.body;
    if (!email && !phone)
      return handleResponse(400, "Email or phone is required", {}, resp);

    const user = await User.findOne({ $or: [{ email }, { phone }] });
    if (!user) return handleResponse(404, "User not found", {}, resp);
         const role = await Role.findById(user.role).select("id name");

        


    user.otp = generateOTP();
    user.otp_expires_at = moment().add(1, "minutes").toDate();
    user.otp_for = type;
    user.otp_phone = generateOTP() ;


    if(email){

       await sendEmail({
        to: email,
        subject: "Verification OTP",
        html: `<p>One time password:${user.otp}</p>
                `,
      });

    }


    if(role.name == "Vendor"  && (!user.is_email_verified || !user.is_phone_verified)){
        return handleResponse(
      400,
      "Please Verify Your account",
      {  role:role },
      resp,
    );
         
    }

    await user.save();
    return handleResponse(
      200,
      "OTP sent successfully",
      { otp: user.otp , role:role },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};


export const deleteAccount = async (req, resp) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    User.findByIdAndDelete(user._id);

    return handleResponse(200, "Account deleted successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};


  export const NewPassword = async (req, res) => {
    const { password, confirm_password } = req.body;
    try {
   
      if (password == confirm_password) {
        const salt = await bcrypt.genSalt(10);
        const hasPassword = await bcrypt.hash(password, salt);

        await User.findByIdAndUpdate(req.user._id, {
          $set: {
            password: hasPassword,
          },
        });



       return handleResponse(200, "Password Changed Successfully", {}, res);
      } else {
      return  handleResponse(
          400,
          "New password & confirm password does not match",
          {},
          res
        );
      }
    } catch (e) {
      return handleResponse(500, e.message, {}, res);
    }
  };






// REQUEST EMAIL LOGIN OTP
export const requestEmailLoginOTP = async (req, resp) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return handleResponse(404, "User not found", {}, resp);

    if (!user.is_phone_verified)
      return handleResponse(
        403,
        "Phone verification required",
        { flow: "PHONE_VERIFICATION_REQUIRED" },
        resp,
      );

    if (!user.is_email_verified)
      return handleResponse(
        403,
        "Email not verified",
        { flow: "EMAIL_VERIFICATION_REQUIRED" },
        resp,
      );

    const otp = generateOTP();

    user.email_login_otp = otp;
    user.email_login_otp_expiry = moment().add(5, "minutes").toDate();
    await user.save();

    await sendEmail({
      to: email,
      subject: "Login OTP",
      html: `<p>Your login OTP is <b>${otp}</b></p>`,
    });

    return handleResponse(
      200,
      "OTP sent to email",
      { flow: "OTP_REQUIRED" },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// LOGIN API
export const login = async (req, resp) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return handleResponse(
        400,
        "Identifier and password are required",
        {} ,
        resp,
      );
    }

    const user = await User.findOne({
      $or: [{ phone: identifier }, { email: identifier }],
    });

    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    const role = await Role.findById(user.role).select("id name");

    // Phone must exist
    // if (!user.phone) {
    //   const token = generateToken(user.toObject());
    //   return handleResponse(
    //     403,
    //     "Phone number required to access account",
    //     { flow: "PHONE_REQUIRED", user: user.toObject(), token },
    //     resp,
    //   );
    // }

    // Phone must be verified

      const isPhoneLogin = user.phone === identifier;

    if (!user.is_phone_verified && isPhoneLogin) {
      const otp = generateOTP();
      user.otp_phone = otp;
      user.otp_phone_expiry_at = moment().add(5, "minutes").toDate();
      user.otp_for = "VERIFY_PHONE";
      await user.save();

      return handleResponse(
        403,
        "Phone verification required",
        { flow: "PHONE_VERIFICATION_REQUIRED"  , role : role  },
        resp,
      );
    }

    const isEmailLogin = user.email === identifier;

    if (isEmailLogin && !user.is_email_verified) {
      const newToken = crypto.randomBytes(32).toString("hex");
   const otp = generateOTP();
      user.otp = otp;
      // user.otp_phone_expiry_at = moment().add(5, "minutes").toDate();
      user.otp_for = "VERIFY_EMAIL";
      await user.save();

   await sendEmail({
        to: user.email,
        subject: "Verification OTP",
        html: `<p>One time password:${otp}</p>
                `,
      });

      return handleResponse(
        403,
        "Email verification required",
        { flow: "EMAIL_VERIFICATION_REQUIRED" , role : role },
        resp,
      );
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return handleResponse(401, "Invalid credentials", {}, resp);
    }

    const token = generateToken(user.toObject());


    return handleResponse(
      200,
      "Login successful",
      { flow: "LOGIN_SUCCESS", token, user  , role},
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};



export const phoneSignUp = async (req, resp) => {
  try {
    const { phone , email } = req.body;

    if (!phone) {
      return handleResponse(
        400,
        "phone",
        {} ,
        resp,
      );
    }

    const user = await User.findOne({email:email});

    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    const role = await Role.findById(user.role).select("id name");

    user.phone = phone ;
    if (!user.is_phone_verified ) {
      const otp = generateOTP();
      user.otp_phone = otp;
      user.otp_phone_expiry_at = moment().add(5, "minutes").toDate();
      user.otp_for = "VERIFY_PHONE";
      await user.save(); 
    }

    return handleResponse(
      200,
      "OTP send successfully",
      {role} ,
      resp,
    );

  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};




// RESEND PHONE OTP
export const resendPhoneOTP = async (req, resp) => {
  try {
    const { phone, type } = req.body;

    if (!phone) {
      return handleResponse(400, "Phone is required", {}, resp);
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    // if (user.is_phone_verified) {
    //   return handleResponse(400, "Phone already verified", {}, resp);
    // }

    const otp = generateOTP();

    user.otp_phone = otp;
    user.otp_phone_expiry_at = moment().add(5, "minutes").toDate();
    user.otp_for = type;

    await user.save();

    return handleResponse(
      200,
      "Phone OTP resent successfully",
      { flow: "PHONE_VERIFICATION_REQUIRED" },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// RESEND EMAIL VERIFICATION LINK
export const resendEmailVerification = async (req, resp) => {
  try {
    const { email , type } = req.body;

    if (!email) {
      return handleResponse(400, "Email is required", {}, resp);
    }

    const user = await User.findOne({ email });
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (!user.email) {
      return handleResponse(400, "No email found for this user", {}, resp);
    }

    // if (user.is_email_verified) {
    //   return handleResponse(400, "Email already verified", {}, resp);
    // }

    const newToken = crypto.randomBytes(32).toString("hex");

    // user.email_verification_token = newToken;
    // const link = `${process.env.BASE_URL}/api/user/verify-email?token=${newToken}`;

       const otp = generateOTP();

    user.otp = otp;
    await user.save();


   await sendEmail({
        to: email,
        subject: "Verification OTP",
        html: `<p>One time password:${otp}</p>
                `,
      });

    return handleResponse(
      200,
      "Verification OTP Send successfully",
      { flow: "EMAIL_VERIFICATION_REQUIRED" },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// VERIFY PHONE + AUTO LOGIN
export const verifyPhoneAndLogin = async (req, resp) => {
  try {
    const { phone, otp, type } = req.body;

    if (!phone || !otp) {
      return handleResponse(400, "Phone and OTP are required", {}, resp);
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (type !== "VERIFY_PHONE") {
      return handleResponse(400, "Invalid type", {}, resp);
    }

    if (
      !user.otp_phone ||
      !user.otp_phone_expiry_at ||
      moment().isAfter(user.otp_phone_expiry_at)
    ) {
      return handleResponse(400, "OTP expired", {}, resp);
    }

    if (user.otp_phone !== otp) {
      return handleResponse(401, "Invalid OTP", {}, resp);
    }

    user.is_phone_verified = true;
    user.otp_phone = null;
    user.otp_phone_expiry_at = null;
    user.otp_for = null;

    await user.save();

    // resend email verification if email exists but not verified
    if (user.email && !user.is_email_verified) {
      const newToken = crypto.randomBytes(32).toString("hex");
      user.email_verification_token = newToken;
      await user.save();

      const link = `${process.env.BASE_URL}/api/user/verify-email?token=${newToken}`;

      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        html: `<p>Click below to verify your email:</p>
               <a href="${link}">${link}</a>`,
      });
    }

    const token = generateToken(user.toObject());

    return handleResponse(
      200,
      "Phone verified and login successful",
      { flow: "LOGIN_SUCCESS", token, user },
      resp,
    );
  } catch (err) {
    console.log("verifyPhoneAndLogin error : ", err);
    return handleResponse(500, err.message, {}, resp);
  }
};

// UPDATE PROFILE
export const updateUserProfile = async (req, resp) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return handleResponse(401, "Unauthorized", {}, resp);
    }

    const { first_name, last_name, email, phone, profile_pic , address , postal_code , city} = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (first_name !== undefined) user.first_name = first_name;
    if (last_name !== undefined) user.last_name = last_name;
    if(address !== undefined) user.address = address ;
    if(address !== undefined) user.postal_code = postal_code ;
    if(address !== undefined) user.city = city ;


    if (email !== undefined && email !== user.email) {
      const existingEmail = await User.findOne({
        email,
        _id: { $ne: userId },
      });
      if (existingEmail) {
        return handleResponse(409, "Email already in use", {}, resp);
      }

      user.email = email;
      user.is_email_verified = false;
           user.otp = generateOTP();
           user.otp_for = "VERIFY_EMAIL";

      await sendEmail({
        to: email,
        subject: "Verification OTP",
        html: `<p>One time password:${user.otp}</p>
                `,
      });

    }

    if (phone !== undefined && phone !== user.phone) {
      const existingPhone = await User.findOne({
        phone,
        _id: { $ne: userId },
      });
      if (existingPhone) {
        return handleResponse(409, "Phone already in use", {}, resp);
      }

      user.phone = phone;
      user.is_phone_verified = false;

      const otp = generateOTP();
      user.otp_phone = otp;
      user.otp_phone_expiry_at = moment().add(5, "minutes").toDate();
      user.otp_for = "VERIFY_PHONE";
    }

    user.profile_pic =
      req.files?.profile_pic?.[0]?.path || normalizePath(profile_pic) || null;

    await user.save();

    return handleResponse(
      200,
      "Profile updated successfully",
      {
        flow: "PROFILE_UPDATED",
        email_verified: user.is_email_verified,
        phone_verified: user.is_phone_verified,
      },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// change password
export const changePassword = async (req, resp) => {
  try {
    const { old_password, new_password } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }
    const isMatch = await comparePassword(old_password, user.password);
    if (!isMatch) {
      return handleResponse(401, "Invalid old password", {}, resp);
    }

    const hashedPassword = await hashPassword(new_password);
    user.password = hashedPassword;
    await user.save();
    return handleResponse(200, "Password changed successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// get profile
export const getProfile = async (req, resp) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return handleResponse(404, "User not found", {}, resp);
    return handleResponse(200, "Profile fetched successfully", user, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// forgot password
export const forgotPassword = async (req, resp) => {
  try {
    const { email, phone, type } = req.body;
    if (!email && !phone)
      return handleResponse(400, "Email or phone is required", {}, resp);

    const user = await User.findOne({ $or: [{ email }, { phone }] });
    if (!user) return handleResponse(404, "User not found", {}, resp);

    user.otp = generateOTP();
    user.otp_expires_at = moment().add(1, "minutes").toDate();
    user.otp_for = type;
    user.otp_phone = generateOTP() ;

       if(email){
       await sendEmail({
        to: email,
        subject: "Verification OTP",
        html: `<p>One time password:${user.otp}</p>
                `,
      });

    }


    await user.save();
    return handleResponse(
      200,
      "OTP sent successfully",
      { otp: user.otp },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// verify forgot password otp
export const verifyOTP = async (req, resp) => {
  try {
    const { email, phone, otp, type } = req.body;

    if (!email && !phone) {
      return handleResponse(400, "Email or phone is required", {}, resp);
    }

    const user = await User.findOne({ $or: [{ email }, { phone }] });
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (type !== "FORGOT_PASSWORD") {
      return handleResponse(400, "Invalid type", {}, resp);
    }

    if (user.otp != otp) {
      return handleResponse(401, "Invalid OTP", {}, resp);
    }
    user.otp = null;
    user.otp_expires_at = null;
    user.otp_for = null;
    await user.save();

    const token = generateOneMinToken(user.toObject());
    
    await resp.cookie("forgot-password", token, cookieOptions);

    return handleResponse(200, "OTP verified successfully", { token }, resp);

  } catch (err) {

    return handleResponse(500, err.message, {}, resp);

  }
};


  export const GoogleLogin = async (req, res) => {
    try {
      const users = req.user;
      const {role_type} = req.body ;


      if (!users) {
        return handleResponse(401, "Unauthorized user", {}, res);
      }

      console.log(users);

      let firstName = "First";
      let lastName = "Last";

      if (users.name) {
        const name = users.name.split(" ");
        firstName = name[0];
        lastName = name[1] || "Last";
      }

      // const requiredFields = [
      //   { field: "first_name", value: firstName },
      //   { field: "last_name", value: lastName },
      //   { field: "email", value: users.email },
      //   { field: "device_id", value: users.uid },
      // ];

      // const validationErrors = validateFields(requiredFields);
      // if (validationErrors.length > 0) {
      //   return handleResponse(
      //     400,
      //     "Validation error",
      //     { errors: validationErrors },
      //     res
      //   );
      // }

      let user = await User.findOne({
         email: users.email,
      }).populate("role");

      console.log(user);
      //   const role = await Role.findOne({ user_id: user.id });

      const password = Math.floor(
        1000000000 * Math.random() * 9000000000
      ).toString();

      const salt = await bcrypt.genSalt(10);
      const hasPassword = await bcrypt.hash(password, salt);
      if (!user) {
        const role = await Role.findOne({ name: role_type});

          if (!role) {
        return handleResponse(400, "Invalid role type", {}, res);
      }

    
        user = new User({
          first_name: firstName,
          last_name: lastName,
          email: users.email,
          device_id: users.uid,
          password: hasPassword,
          is_email_verified : true ,
          role : role?._id 
        });
        await user.save();

       user = await User.findById(user._id).populate("role");

      }

      if (user.role?.name == "Vendor") {
      if (!user.phone || !user.is_phone_verified) {
        const otp = generateOTP();

        user.otp_phone = otp;
        user.otp_phone_expiry_at = moment()
          .add(20, "minutes")
          .toDate();
        user.otp_for = "VERIFY_PHONE";

        await user.save();

        return handleResponse(
          403,
          "Phone verification required",
          {
            flow: "PHONE_VERIFICATION_REQUIRED",
            phone_verified: false,
          },
          res
        );
      }
    }

       const token = generateOneMinToken(user.toObject());

      return handleResponse(200, "Login successful", {token , role: user.role}, res);
    } catch (e) {
      console.log("e", e);

      return handleResponse(500, e.message, {}, res);
    }
  };




// resend phone email OTP
export const resendPhoneEmailOTP = async (req, resp) => {
  try {
    const { phone, email, type } = req.body;
    if (!phone && !email) {
      return handleResponse(400, "Phone or email is required", {}, resp);
    }
    const user = await User.findOne({ $or: [{ phone }, { email }] });
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }
    user.otp = generateOTP();
    user.otp_expires_at = moment().add(1, "minutes").toDate();
    user.otp_for = type;
    await user.save();
    return handleResponse(200, "OTP sent successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// reset password
export const resetPassword = async (req, resp) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return handleResponse(404, "User not found", {}, resp);
    user.password = await hashPassword(password);
    await user.save();
    return handleResponse(200, "Password reset successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};


export const saveNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;

    const preferences = await UserNotification.findOneAndUpdate(
      { user_id: userId },
      { ...req.body },
      { new: true, upsert: true },
    );
    return handleResponse(
      200,
      "Notification preferences saved successfully",
      preferences,
      res,
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

export const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    let preferences = await UserNotification.findOne({
      user_id: userId,
    }).lean();


    if (!preferences) {
      preferences = await UserNotification.create({
        user_id: userId,
      });
    }

    return handleResponse(
      200,
      "Notification preferences fetched successfully",
      preferences,
      res,
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }


};


    export const PostContactUs = async (req, res) => {
    try {
      const { name, email, message } = req.body;

      const post = new ContactUs({
         name ,
        email,
        message,
      });
      await post.save();

//       try {
//         transporter.sendMail({
//           from: process.env.EMAIL_FROM,
//           to: "st4272333@gmail.com",
//           subject: `New Contact Us Inquiry from ${first_name}`,
//           html: `<!DOCTYPE html>
// <html>
// <head>
//   <style>
//     body {
//       font-family: Arial, sans-serif;
//       background-color: #f4f4f4;
//       margin: 0;
//       padding: 0;
//     }
//     .container {
//       max-width: 600px;
//       margin: 50px auto;
//       background: #ffffff;
//       padding: 20px;
//       border-radius: 10px;
//       box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
//     }
//     h2 {
//       color: #333333;
//     }
//     .info {
//       margin-bottom: 20px;
//     }
//     .info p {
//       margin: 5px 0;
//       line-height: 1.5;
//     }
//     .footer {
//       text-align: center;
//       color: #777777;
//       font-size: 12px;
//       margin-top: 20px;
//     }
//   </style>
// </head>
// <body>
//   <div class="container">
//     <h2>New Contact Us Message</h2>
//     <div class="info">
//       <p><strong>Name:</strong> ${first_name}</p>
//       <p><strong>Email:</strong> ${email}</p>
//       <p><strong>Message:</strong></p>
//       <p>${message}</p>
//     </div>
//     <div class="footer">
//       <p>&copy; 2025 Fill My SKip. All rights reserved.</p>
//     </div>
//   </div>
// </body>
// </html>
// `,
//         });
//       } catch (e) {
//         console.log(e);
//       }

      return handleResponse(200, "Form Submit Successfully", post, res);
    } catch (e) {
      return handleResponse(500, error.message, {}, res);
    }
  };

