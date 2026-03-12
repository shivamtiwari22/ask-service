import handleResponse from "../../../utils/http-response.js";
import User from "../../models/UserModel.js";
import Role from "../../models/RoleModel.js";
import VendorDocument from "../../models/VendorDocumentModel.js";
import ServiceDocumentRequirement from "../../models/ServiceDocumentRequirementModel.js";

/**
 * Admin API: Get all vendors with their verification documents
 * Similar structure to vendor's VerificationDocument but for all vendors
 */
export const getAllVendorsWithDocuments = async (req, res) => {
  try {
    const vendorRole = await Role.findOne({ name: RegExp("^Vendor$", "i") });
    if (!vendorRole) {
      return handleResponse(404, "Vendor role not found", {}, res);
    }

    const vendors = await User.find({ role: vendorRole._id })
      .select("-password -otp -otp_phone -otp_expires_at -otp_phone_expiry_at -otp_for")
      .populate("service", "title")
      .populate("role", "name")
      .sort({ createdAt: -1 })
      .lean();

    const baseUrl = process.env.IMAGE_URL || "";
    const vendorsWithDocs = await Promise.all(
      vendors.map(async (vendor) => {
        const requirements = await ServiceDocumentRequirement.find({
          service_category: vendor.service?._id || null,
          status: "ACTIVE",
          deletedAt: null,
        })
          .sort({ createdAt: 1 })
          .lean();

        const vendorDocs = await VendorDocument.find({
          user_id: vendor._id,
        }).lean();

        const docByRequirement = new Map(
          vendorDocs.map((d) => [d.document_id.toString(), d])
        );

        const documents = requirements.map((reqItem) => {
          const uploaded = docByRequirement.get(reqItem._id.toString());
          const status = uploaded ? uploaded.status : "Not uploaded";
          return {
            document_id: reqItem._id,
            name: reqItem.name,
            description: reqItem.description || null,
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
                        : "/" + uploaded.file)
                    : null,
                }
              : null,
            uploadedAt: uploaded?.updatedAt || null,
          };
        });

        return {
          ...vendor,
          documents,
        };
      })
    );

    return handleResponse(
      200,
      "Vendors with documents fetched successfully",
      {
        list: vendorsWithDocs,
        total: vendorsWithDocs.length,
      },
      res
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

/**
 * Admin API: Update vendor document status (Pending/Verified/Rejected)
 */
export const updateVendorDocumentStatus = async (req, res) => {
  try {
    const { vendorId, documentId } = req.params;
    const { status } = req.body;

    const validStatuses = ["Pending", "Verified", "Rejected"];
    if (!status || !validStatuses.includes(status)) {
      return handleResponse(
        400,
        "Invalid status. Must be one of: Pending, Verified, Rejected",
        {},
        res
      );
    }

    const doc = await VendorDocument.findOneAndUpdate(
      { user_id: vendorId, document_id: documentId },
      { status },
      { new: true }
    );

    if (!doc) {
      return handleResponse(
        404,
        "Vendor document not found",
        {},
        res
      );
    }

    return handleResponse(
      200,
      "Document status updated successfully",
      { document: doc },
      res
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

/**
 * Admin API: Update vendor KYC status (ACTIVE/PENDING/REJECTED)
 */
export const updateVendorKycStatus = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { kyc_status } = req.body;

    const validStatuses = ["ACTIVE", "PENDING", "REJECTED"];
    if (!kyc_status || !validStatuses.includes(kyc_status)) {
      return handleResponse(
        400,
        "Invalid kyc_status. Must be one of: ACTIVE, PENDING, REJECTED",
        {},
        res
      );
    }

    const vendorRole = await Role.findOne({ name: RegExp("^Vendor$", "i") });
    if (!vendorRole) {
      return handleResponse(404, "Vendor role not found", {}, res);
    }

    const vendor = await User.findOneAndUpdate(
      { _id: vendorId, role: vendorRole._id },
      { kyc_status, ...(kyc_status === "ACTIVE" && { verified_at: new Date() }) },
      { new: true }
    )
      .select("-password -otp -otp_phone -otp_expires_at -otp_phone_expiry_at -otp_for")
      .populate("service", "title")
      .populate("role", "name")
      .lean();

    if (!vendor) {
      return handleResponse(404, "Vendor not found", {}, res);
    }

    return handleResponse(
      200,
      "Vendor KYC status updated successfully",
      { vendor },
      res
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};

/**
 * Admin dashboard: Get total pending KYC and inactive vendors count
 */
export const getVendorDashboardCounts = async (req, res) => {
  try {
    const vendorRole = await Role.findOne({ name: RegExp("^Vendor$", "i") });
    if (!vendorRole) {
      return handleResponse(404, "Vendor role not found", {}, res);
    }

    const baseMatch = { role: vendorRole._id };

    const [totalPendingKyc, inactiveVendors] = await Promise.all([
      User.countDocuments({ ...baseMatch, kyc_status: "PENDING" }),
      User.countDocuments({ ...baseMatch, status: "INACTIVE" }),
    ]);

    return handleResponse(
      200,
      "Vendor dashboard counts fetched successfully",
      {
        total_pending_kyc: totalPendingKyc,
        inactive_vendors: inactiveVendors,
      },
      res
    );
  } catch (error) {
    return handleResponse(500, error.message, {}, res);
  }
};
