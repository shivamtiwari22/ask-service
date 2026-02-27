import moment from "moment";
import {
  comparePassword,
  generateOTP,
  generateOneMinToken,
  generate15minToken,
  generateToken,
  hashPassword,
} from "../../../utils/auth.js";
import handleResponse from "../../../utils/http-response.js";
import Role from "../../models/RoleModel.js";
import User from "../../models/UserModel.js";
import ServiceRequest from "../../models/ServiceRequestModel.js";
import normalizePath from "../../../utils/imageNormalizer.js";
import VendorCreditWallet from "../../models/VendorCreditWalletModel.js";
import ServiceCategory from "../../models/ServiceCategoryModel.js";
import ServiceDocumentRequirement from "../../models/ServiceDocumentRequirementModel.js";
import extractFiles from "../../../utils/extractNestedFiles.js";
import {
  cookieOptions,
  documentUploadCookieOptions,
} from "../../../utils/helperFunction.js";
import VendorDocument from "../../models/VendorDocumentModel.js";
import BusinessInformation from "../../models/BusinessInformationModel.js";
import VendorNotification from "../../models/vendorNotificationModel.js";
import VendorReview from "../../models/VendorReviewModel.js";
import Transaction from "../../models/TransactionModel.js";
import VendorLeadUnlock from "../../models/VendorLeadUnlockModel.js";
import VendorQuote from "../../models/VendorQuoteModel.js";
import { sendEmail } from "../../../config/emailConfig.js";
import bcrypt from "bcryptjs";


// register vendor
export const registerVendor = async (req, resp) => {
  try {
    const { first_name, last_name, email, phone, password } = req.body;

    const existingEmail = await User.findOne({ email });

    console.log(existingEmail);

    if (existingEmail)
      return handleResponse(
        400,
        "User already exists with this email",
        {},
        resp,
      );

    const existingPhone = await User.findOne({ phone });
    if (existingPhone)
      return handleResponse(
        400,
        "User already exists with this phone",
        {},
        resp,
      );

    const hashedPassword = await hashPassword(password);
    const role = await Role.findOne({ name: "Vendor" });

    const payload = {
      first_name,
      last_name,
      email,
      phone,
      password: hashedPassword,
      role: role._id,
      status: "ACTIVE",
      kyc_status: "PENDING",
      otp: generateOTP(),
      otp_phone: generateOTP(),
      otp_expires_at: moment().add(1, "minutes").toDate(),
      otp_phone_expiry_at: moment().add(1, "minutes").toDate(),
      otp_for: "SIGNUP",
      is_phone_verified: false,
      is_email_verified: false,
    };
    const user = await User.create(payload);

    await VendorCreditWallet.create({
      user_id: user._id,
      amount: 0,
    });


      try {

        await sendEmail({
               to: user.email,
               subject: "Verify your email",
               html: `<p>Your OTP :${user.otp } </p>`,
             });
      }
      catch(e){
         console.log(e);
         
      }



    if (!user) return handleResponse(400, "Failed to create user", {}, resp);

    return handleResponse(201, "Vendor registered successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};


export const NewPassword = async (req, res) => {
    const { password, confirm_password } = req.body;
    try {
      const requiredFields = [
        { field: "password", value: password },
        { field: "confirm_password", value: confirm_password },
      ];
      
      if (password == confirm_password) {
        const salt = await bcrypt.genSalt(10);
        const hasPassword = await bcrypt.hash(password, salt);

        await User.findByIdAndUpdate(req.user._id, {
          $set: {
            password: hasPassword,
          },
        });

    return     handleResponse(200, "Password Changed Successfully", {}, res);
      } else {
    return    handleResponse(
          400,
          "New password & confirm password does not match",
          {},
          res
        );
      }
    } catch (e) {
      console.log('====================================');
      console.log(e);
      console.log('====================================');
      return handleResponse(500, e.message, {}, res);
    }
  };




// resend otp
export const resendOTP = async (req, resp) => {
  try {
    const { identifier, identifierType, type } = req.body;

    if (!identifier || !identifierType || !type) {
      return handleResponse(
        400,
        "Identifier, identifier type and type are required",
        {},
        resp,
      );
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    });

    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (identifierType === "EMAIL") {
      user.otp = generateOTP();
      user.otp_expires_at = moment().add(2, "minutes").toDate();

      console.log("us");
      
      try {

        await sendEmail({
               to: user.email,
               subject: "Verify your email",
               html: `<p>Your OTP :${user.otp } </p>`,
             });
      }
      catch(e){
         console.log(e);
         
      }



    } else {
      user.otp_phone = generateOTP();
      user.otp_phone_expiry_at = moment().add(2, "minutes").toDate();
    }

    user.otp_for = type;
    await user.save();
    return handleResponse(200, "OTP sent successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// verify otp
export const verifyRegistrationOTP = async (req, resp) => {
  try {
    const { email, phone, otp_phone, otp_email, type } = req.body;
    console.log(email);

   let user;

if (email) {
  user = await User.findOne({ email });
} else if (phone) {
  user = await User.findOne({ phone });
}

    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (type !== "SIGNUP") {
      return handleResponse(400, "Invalid type", {}, resp);
    }
    let emailVerified = user.is_email_verified;
    let phoneVerified = user.is_phone_verified;

    if (otp_email) {
       console.log(user);
       
      if (user.otp != otp_email) {
        return handleResponse(401, "Invalid Email OTP", {}, resp);
      }
      // if (moment(user.otp_expires_at).isBefore(moment())) {
      //   return handleResponse(401, "Email Verification OTP expired", {}, resp);
      // }

      user.otp = null;
      user.otp_expires_at = null;
      user.is_email_verified = true;
      user.is_email_verified = true;
      emailVerified = true;
    }

    if (otp_phone) {
      if (user.otp_phone != otp_phone) {
        return handleResponse(401, "Invalid Phone OTP", {}, resp);
      }
      // if (moment(user.otp_phone_expiry_at).isBefore(moment())) {
      //   return handleResponse(401, "Phone Verification OTP expired", {}, resp);
      // }
      user.otp_phone = null;
      user.otp_phone_expiry_at = null;
      user.is_phone_verified = true;
      phoneVerified = true;
    }

    if (emailVerified && phoneVerified) {
      user.otp_for = null;
    }

    await user.save();

    if (emailVerified && phoneVerified) {
      const token = generate15minToken(user.toObject());
      await resp.cookie(
        "service-selection-document-upload",
        token,
        documentUploadCookieOptions,
      );
    }

    const fialResponse = {
      emailVerified,
      phoneVerified,
      userData: user.toObject(),
    };

    return handleResponse(200, "OTP verified successfully", fialResponse, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// login vendor
export const loginVendor = async (req, resp) => {
  try {
    const { identifier, password, identifierType, type } = req.body;
    if (!identifier || !type) {
      return handleResponse(
        400,
        "Identifier, password, identifier type and type are required",
        {},
        resp,
      );
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    });

    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    let emailVerified = user.is_email_verified;
    let phoneVerified = user.is_phone_verified;

    if (type == "OTP") {
      if (emailVerified && phoneVerified && user.status == "ACTIVE") {
        user.otp = generateOTP();
        user.otp_expires_at = moment().add(2, "minutes").toDate();
        user.otp_for = "LOGIN";
        await user.save();

        const fialResponse = {
          flow: "OTP_LOGIN",
          emailVerified,
          phoneVerified,
          userData: user.toObject(),
        };
        return handleResponse(
          200,
          "OTP Send Successfully for login",
          fialResponse,
          resp,
        );
      }

      if (!emailVerified) {
        user.otp = generateOTP();
        user.otp_expires_at = moment().add(1, "minutes").toDate();
      }
      if (!phoneVerified) {
        user.otp_phone = generateOTP();
        user.otp_phone_expiry_at = moment().add(1, "minutes").toDate();
      }
      user.otp_for = "SIGNUP";

      if (user.status !== "ACTIVE") {
        return handleResponse(401, "Your account is not active", {}, resp);
      }

      await user.save();

      const fialResponse = {
        emailVerified,
        phoneVerified,
        userData: user.toObject(),
        flow: "EMAIL_AND_PHONE_VERIFICATION_LOGIN",
      };

      return handleResponse(
        200,
        "OTP Send Successfully for verification",
        fialResponse,
        resp,
      );
    } else {
      const isPasswordMatch = await comparePassword(password, user.password);
      if (!isPasswordMatch) {
        return handleResponse(401, "Invalid password", {}, resp);
      }
      if (emailVerified && phoneVerified && user.status == "ACTIVE") {
        const token = generateToken(user.toObject());

        const fialResponse = {
          flow: "PASSWORD_LOGIN",
          emailVerified,
          phoneVerified,
          userData: user.toObject(),
          token,
        };
        return handleResponse(200, "Login Successful", fialResponse, resp);
      }



      if (!user.service) {
        const token = generate15minToken(user.toObject());
        await resp.cookie("forgot-password", token, cookieOptions);
        return handleResponse(
          401,
          "Please select a service",
          { flow: "SERVICE_SELECTION" },
          resp,
        );
      }
      if (user.status !== "ACTIVE") {
        return handleResponse(401, "Your account is not active", {}, resp);
      }

      if (!emailVerified) {
        user.otp = generateOTP();
        user.otp_expires_at = moment().add(1, "minutes").toDate();
      }
      if (!phoneVerified) {
        user.otp_phone = generateOTP();
        user.otp_phone_expiry_at = moment().add(1, "minutes").toDate();
      }



      user.otp_for = "SIGNUP";
      await user.save();
      const fialResponse = {
        emailVerified,
        phoneVerified,
        userData: user.toObject(),
        flow: "EMAIL_AND_PHONE_VERIFICATION_LOGIN",
      };

      return handleResponse(
        200,
        "OTP Send Successfully for verification",
        fialResponse,
        resp,
      );
    }
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// update Vendor Profile
export const updateVendorProfile = async (req, resp) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return handleResponse(401, "Unauthorized", {}, resp);
    }

    const { first_name, last_name, email, phone, profile_pic, service  ,
          business_name,
      postal_code,
      address,
      city,
      vat_number,
      company_registration_number,
      years_of_activity,
      company_size,
      about_company,
      website_link 
     } =
      req.body;

    const user = await User.findById(userId);
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    if (first_name !== undefined) user.first_name = first_name;
    if (last_name !== undefined) user.last_name = last_name;

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

    if (service !== undefined  && service) {
      const vendor_service = await ServiceCategory.findById(service);
      if (!vendor_service) {
        return handleResponse(404, "Service not found", {}, resp);
      }
      user.service = vendor_service._id;
    }

    user.profile_pic =
      req.files?.profile_pic?.[0]?.path || normalizePath(profile_pic) || null;



       if (business_name !== undefined) user.business_name = business_name;
    if (address !== undefined) user.address = address;
    if (postal_code !== undefined) user.postal_code = postal_code;
    if (city !== undefined) user.city = city;
    if (vat_number !== undefined) user.vat_number = vat_number;
    if (company_registration_number !== undefined)
      user.company_registration_number = company_registration_number;
    if (years_of_activity !== undefined)
      user.years_of_activity = years_of_activity;
    if (company_size !== undefined) user.company_size = company_size;
    if (about_company !== undefined) user.about_company = about_company;
    if (website_link !== undefined) user.website_link = website_link;


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
    user.password_updateAt = new Date();
    await user.save();

    return handleResponse(200, "Password changed successfully", {}, resp);
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


// get profile
export const getProfile = async (req, resp) => {
  try {

    const user = await User.findById(req.user._id).select(
      "-password -otp -otp_phone",
    ).populate("service","id title description");

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

// get all services
export const getAllServices = async (req, resp) => {
  try {
    const services = await ServiceCategory.find({
      status: "ACTIVE",
      parent_category: null,
    }).select("title image");

    return handleResponse(200, "Services fetched successfully", services, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// update user's service data
export const updateUserServiceData = async (req, resp) => {
  try {
    const { service } = req.body;
    const user = await User.findById(req?.user?._id);
    if (!user) {
      return handleResponse(404, "User not found", {}, resp);
    }

    user.service = service;
    await user.save();
    return handleResponse(200, "Service data updated successfully", user, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// get service required document
export const getDocumentRequiredForService = async (req, resp) => {
  try {
    const user = req.user;
    const service = await ServiceCategory.findById(user.service);
    if (!service) {
      return handleResponse(404, "Service not found", {}, resp);
    }
    const documents = await ServiceDocumentRequirement.find({
      service_category: service._id,
    });
    return handleResponse(
      200,
      "Documents fetched successfully",
      documents,
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// upload document required for service (per document type by document_id)
export const updateDocumentRequiredForService = async (req, resp) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("service");
    if (!user) return handleResponse(404, "User not found", {}, resp);
    if (!user.service) {
      return handleResponse(400, "Please select a service first", {}, resp);
    }

    const requirements = await ServiceDocumentRequirement.find({
      service_category: user.service,
      status: "ACTIVE",
      deletedAt: null,
    }).lean();

    const requirementIds = new Set(requirements.map((r) => r._id.toString()));
    const requirementMap = new Map(
      requirements.map((r) => [r._id.toString(), r]),
    );

    const files = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files || {}).flat();
    if (!files.length) {
      return handleResponse(
        400,
        "No files uploaded. Send files with fieldname = document_id (ServiceDocumentRequirement _id).",
        {},
        resp,
      );
    }

    const normalizedPath = (p) => (p ? p.replace(/\\/g, "/") : null);
    const updated = [];

    console.log(files);

    for (const file of files) {
      const documentId = file.fieldname || file.document_id;
      const path = file.path ?? null;
      const originalname = file.originalname || null;

      if (!documentId || !path) continue;
      if (!requirementIds.has(documentId.toString())) {
        continue;
      }

      const requirement = requirementMap.get(documentId.toString());
      const docPayload = {
        user_id: userId,
        document_id: requirement._id,
        file: path,
        file_name: originalname || requirement.name,
        name: requirement.name,
        required: requirement.is_required || false,
        status: "Pending",
      };

      const vendorDoc = await VendorDocument.findOneAndUpdate(
        { user_id: userId, document_id: requirement._id },
        { $set: docPayload },
        { new: true, upsert: true },
      );
      updated.push({
        document_id: vendorDoc.document_id,
        name: vendorDoc.name,
        status: vendorDoc.status,
        file_name: vendorDoc.file_name,
      });
    }

    return handleResponse(
      200,
      "Documents updated successfully",
      { uploaded: updated },
      resp,
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

function maskContactDetails(contact) {
  if (!contact) return contact;
  return {
    ...contact,
    first_name: contact.first_name ? contact.first_name[0] + "***" : "***",
    last_name: contact.last_name ? contact.last_name[0] + "***" : "***",
    phone: (contact.phone || "").slice(0, 3) + " *******",
    email: (contact.email || "").replace(/(.{2})(.*)(@.*)/, "$1*******$3"),
  };
}

export const availableLeads = async (req, resp) => {
  try {
    const vendorId = req?.user?._id;
    const { city, state, country, sort } = req.query;

    let filter = {
      service_category: req?.user?.service,
      deletedAt: null,
      status: "ACTIVE",
    };

    if (city) filter.city = city;
    if (state) filter.state = state;
    if (country) filter.country = country;

    let sortOption = {};

    // Default sort
    sortOption.createdAt = -1;

    const leads = await ServiceRequest.find(filter)
      .populate({
        path: "service_category",
        select: "title credit",
      })
      .lean();

    if (sort === "high_to_low") {
      leads.sort(
        (a, b) =>
          (b.service_category?.credit || 0) - (a.service_category?.credit || 0),
      );
    }

    if (sort === "low_to_high") {
      leads.sort(
        (a, b) =>
          (a.service_category?.credit || 0) - (b.service_category?.credit || 0),
      );
    }




    const leadObjectIds = leads.map((l) => l._id);
    const unlockedIds = new Set(
      vendorId
        ? (
            await VendorLeadUnlock.find({
              vendor_id: vendorId,
              service_request_id: { $in: leadObjectIds },
            }).distinct("service_request_id")
          )?.map((id) => id.toString()) || []
        : [],
    );

  const leadsWithMasking = await Promise.all(
  leads.map(async (lead) => {
    const unlocked = unlockedIds.has(lead._id.toString());
    const creditsToUnlock = lead.service_category?.credit ?? 3;

    const quotesCount = await VendorQuote.countDocuments({
      service_request_id: lead._id,
      status: "SENT",
    });

    if (unlocked) {
      return {
        ...lead,
        unlocked: true,
        creditsToUnlock,
        quotes_count: quotesCount,
      };
    }

    return {
      ...lead,
      contact_details: maskContactDetails(lead.contact_details),
      unlocked: false,
      creditsToUnlock,
      quotes_count: quotesCount,
    };
  })
);

    return handleResponse(200, "leads", leadsWithMasking, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const singleService = async (req, resp) => {
  try {
    const leads = await ServiceRequest.findById(req.params.id)
      .populate({
        path: "service_category",
        select: "title credit",
      })
      .lean();

    if (!leads) {
      return handleResponse(404, "service not found", {}, resp);
    }

    return handleResponse(200, "service", leads, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const createUpdateBusinessInfo = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      business_name,
      owner_name,
      service_category,
      email,
      phone,
      business_address,
      postcode,
      city,
      vat_number,
      company_registration_number,
      years_of_activity,
      company_size,
      about_company,
      website_link 
    } = req.body;

    if (!business_name || !business_address || !postcode || !city) {
      return handleResponse(400, "Required fields are missing", {}, res);
    }

    const business = await BusinessInformation.findOneAndUpdate(
      { user_id: userId },
      {
        business_name,
        owner_name,
        service_category,
        email,
        phone,
        business_address,
        postcode,
        city,
        vat_number,
        company_registration_number,
        years_of_activity,
        company_size,
        about_company,
        website_link
      },
      { new: true, upsert: true },
    );

    return handleResponse(
      200,
      "Business information saved successfully",
      business,
      res,
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

export const getBusinessInfo = async (req, res) => {
  try {
    const userId = req.user._id;

    const business = await BusinessInformation.findOne({
      user_id: userId,
      deletedAt: null,
    })
      .populate({
        path: "user_id",
        select: "-password -otp",
        populate: {
          path: "service",
          model: "ServiceCategory",
          select: "title credit description image",
        },
      })
      .lean();

    if (!business) {
      return handleResponse(404, "Business information not found", {}, res);
    }

    return handleResponse(
      200,
      "Business information fetched successfully",
      business,
      res,
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

export const saveNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;

    const preferences = await VendorNotification.findOneAndUpdate(
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


  export const GoogleLogin = async (req, res) => {
    try {
      const users = req.user;

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

      const requiredFields = [
        { field: "first_name", value: firstName },
        { field: "last_name", value: lastName },
        { field: "email", value: users.email },
        { field: "device_id", value: users.uid },
      ];

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
      });

      console.log(user);
      //   const role = await Role.findOne({ user_id: user.id });

      const password = Math.floor(
        1000000000 * Math.random() * 9000000000
      ).toString();

      const salt = await bcrypt.genSalt(10);
      const hasPassword = await bcrypt.hash(password, salt);
      if (!user) {
        user = new User({
          first_name: firstName,
          last_name: lastName,
          email: users.email,
          device_id: users.uid,
          password: hasPassword,
          is_email_verified : true
        });
        await user.save();
      }


      if(!user.is_phone_verified){

          const otp = generateOTP();
      user.otp_phone = otp;
      user.otp_phone_expiry_at = moment().add(20, "minutes").toDate();
      user.otp_for = "VERIFY_PHONE";
      await user.save();

      return handleResponse(
        403,
        "Phone verification required",
        { flow: "PHONE_VERIFICATION_REQUIRED"   },
        res,
      );

      }

      const token = jwt.sign(
        {
          userID: user._id,
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "30d" }
      );

      return handleResponse(200, "Login successful", token, res);
    } catch (e) {
      console.log("e", e);

      return handleResponse(500, e.message, {}, res);
    }
  };






export const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;

    let preferences = await VendorNotification.findOne({
      user_id: userId,
    }).lean();

    // If not exists → create default
    if (!preferences) {
      preferences = await VendorNotification.create({
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

export const VerificationDocument = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("service").lean();
    if (!user) return handleResponse(404, "User not found", {}, res);

    const requirements = await ServiceDocumentRequirement.find({
      service_category: user.service || null,
      status: "ACTIVE",
      deletedAt: null,
    })
      .sort({ createdAt: 1 })
      .lean();

    const vendorDocs = await VendorDocument.find({ user_id: userId }).lean();
    const docByRequirement = new Map(
      vendorDocs.map((d) => [d.document_id.toString(), d]),
    );

    const baseUrl = process.env.IMAGE_URL || "";
    const documents = requirements.map((reqItem) => {
      const uploaded = docByRequirement.get(reqItem._id.toString());
      const status = uploaded ? uploaded.status : "Not uploaded";
      return {
        document_id: reqItem._id,
        name: reqItem.name,
        description: reqItem.description || null,
        allowed_formats: reqItem.allowed_formats || "PDF, JPG, PNG (Max 5MB)",
        type: reqItem.type,
        is_required: reqItem.is_required,
        status,
        file: uploaded
          ? {
              path: uploaded.file,
              file_name: uploaded.file_name || uploaded.name,
              url: uploaded.file
                ? baseUrl +
                  (uploaded.file.startsWith("/")
                    ? uploaded.file
                    : uploaded.file)
                : null,
            }
          : null,
        uploadedAt: uploaded?.updatedAt || null,
      };
    });

    return handleResponse(
      200,
      "Documents fetched successfully",
      { documents },
      res,
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

export const allReviews = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all reviews
    const reviews = await VendorReview.find({
      vendor: userId,
    })
      .populate("user", "first_name last_name profile_pic email")
      .sort({ createdAt: -1 })
      .lean();

    const totalReviews = reviews.length;

    // Calculate average rating
    const averageRating =
      totalReviews > 0
        ? (
            reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews
          ).toFixed(1)
        : 0;

    // Rating distribution
    const ratingDistribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    reviews.forEach((review) => {
      if (review.rating >= 1 && review.rating <= 5) {
        ratingDistribution[review.rating]++;
      }
    });

    return handleResponse(
      200,
      "Reviews fetched successfully",
      {
        averageRating: Number(averageRating),
        totalReviews,
        ratingDistribution,
        reviews,
      },
      res,
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

// Format date as "DD Mon YYYY, HH:MM" for Payment History
function formatTransactionDateTime(date) {
  if (!date) return null;
  const d = new Date(date);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(d.getDate()).padStart(2, "0");
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

// Mask payment method e.g. "Visa 4532" -> "Visa **** 4532"
function maskPaymentMethod(method) {
  if (!method || typeof method !== "string") return null;
  const trimmed = method.trim();
  if (trimmed.length <= 4) return "**** " + trimmed;
  const last4 = trimmed.slice(-4);
  const brand = trimmed.slice(0, -4).replace(/\d/g, "").trim() || "Card";
  return `${brand} **** ${last4}`;
}

// Generate transaction ID for display (TXN-YYYY-NNNNN)
function toTransactionId(transaction_number, _id, createdAt) {
  if (transaction_number) return transaction_number;
  if (!_id || !createdAt) return null;
  const year = new Date(createdAt).getFullYear();
  const num = parseInt(_id.toString().slice(-5), 16) % 100000;
  return `TXN-${year}-${String(num).padStart(5, "0")}`;
}

export const getTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      from_date,
      to_date,
      status,
      period, // last_30_days | last_3_months | last_6_months
      page = 1,
      limit = 10,
    } = req.query;

    const filter = { user_id: userId };

    // Status filter: all | completed | failed | refunded
    if (status && status.toLowerCase() !== "all") {
      filter.status = status.toLowerCase();
    }

    let startDate, endDate;
    if (period) {
      const now = new Date();
      endDate = new Date(now);
      startDate = new Date(now);
      const p = (typeof period === "string" ? period : "").toLowerCase();
      if (p === "last_30_days" || p === "last 30 days") {
        startDate.setDate(now.getDate() - 30);
      } else if (p === "last_3_months" || p === "last 3 months") {
        startDate.setMonth(now.getMonth() - 3);
      } else if (p === "last_6_months" || p === "last 6 months") {
        startDate.setMonth(now.getMonth() - 6);
      }
    }
    if (from_date && to_date) {
      startDate = new Date(from_date);
      endDate = new Date(to_date);
    }
    if (startDate && endDate) {
      filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Transaction.countDocuments(filter),
    ]);

    const baseUrl = process.env.BASE_URL || "";
    const list = transactions.map((t) => ({
      _id: t._id,
      transaction_id: toTransactionId(t.transaction_number, t._id, t.createdAt),
      date_time: formatTransactionDateTime(t.createdAt),
      payment_method: maskPaymentMethod(t.payment_method) || (t.plat_form === "manual" ? null : t.plat_form),
      amount_paid: t.amount_paid != null ? t.amount_paid : null,
      currency: t.currency || "EUR",
      credit_added: t.type === "credit" && t.amount != null ? `+${t.amount} credits` : null,
      status: t.status ? t.status.charAt(0).toUpperCase() + t.status.slice(1) : "Pending",
      receipt_url: baseUrl ? `${baseUrl}/api/vendor/transactions/${t._id}/receipt` : null,
      description: t.description,
    }));

    return handleResponse(
      200,
      "Transactions fetched successfully",
      {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        transactions: list,
      },
      res,
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};
