import handleResponse from "../../../utils/http-response.js";
import User from "../../models/UserModel.js";
import Role from "../../models/RoleModel.js";
import VendorDocument from "../../models/VendorDocumentModel.js";
import ServiceDocumentRequirement from "../../models/ServiceDocumentRequirementModel.js";
import minioClient from "../../../config/minio.js";
import { getServiceIds } from "../../../utils/helperFunction.js";
import { sendEmail } from "../../../config/emailConfig.js";
import documentStatusMail from "../../../config/email/documentStatusMail.js";
import kycStatusMail from "../../../config/email/kycStatusMail.js";

const DOCUMENT_STATUS_LABELS = {
  Pending: "En attente",
  Verified: "Vérifié",
  Rejected: "Rejeté",
};

const KYC_STATUS_LABELS = {
  ACTIVE: "Actif / Vérifié",
  PENDING: "En attente",
  REJECTED: "Rejeté",
};

/**
 * Admin API: Get all vendors with their verification documents
 * Similar structure to vendor's VerificationDocument but for all vendors
 */


const generatePresignedUrl = async (
  filePath,
  expiry = 60 * 60 // 1 hour
) => {
  if (!filePath) return null;

  const parts = filePath.split("/");

  const bucket = parts[0];

  const objectName = parts.slice(1).join("/");

  const url = await minioClient.presignedGetObject(
    bucket,
    objectName,
    expiry
  );

  return url;
};

export const getAllVendorsWithDocuments = async (req, res) => {
  try {

       const { service , kyc_status} = req.query ;
    const vendorRole = await Role.findOne({ name: RegExp("^Vendor$", "i") });
    if (!vendorRole) {
      return handleResponse(404, "Vendor role not found", {}, res);
    }


     let filter  = { role :vendorRole._id  }

     if(service) {
         filter.service = service 
     }
     if(kyc_status){
          filter.kyc_status = kyc_status
     }


    const vendors = await User.find(filter)
      .select("-password -otp -otp_phone -otp_expires_at -otp_phone_expiry_at -otp_for")
      .populate("service", "title")
      .populate("role", "name")
      .sort({ createdAt: -1 })
      .lean();

    const vendorsWithDocs = await Promise.all(
      vendors.map(async (vendor) => {
        const serviceIds = getServiceIds(vendor.service);
        const requirements = await ServiceDocumentRequirement.find({
          service_category: serviceIds.length ? { $in: serviceIds } : null,
          status: "ACTIVE",
          deletedAt: null,
        })
          .populate("service_category", "title")
          .sort({ createdAt: 1 })
          .lean();

        const vendorDocs = await VendorDocument.find({
          user_id: vendor._id,
        }).lean();

        const docByRequirement = new Map(
          vendorDocs.map((d) => [d.document_id.toString(), d])
        );

        const documents = await Promise.all(
          requirements.map(async (reqItem) => {
            const uploaded = docByRequirement.get(reqItem._id.toString());
            const status = uploaded ? uploaded.status : "Not uploaded";
            const presignedUrl = uploaded?.file
              ? await generatePresignedUrl(uploaded.file)
              : null;
            return {
              document_id: reqItem._id,
              service_category: reqItem.service_category,
              name: reqItem.name,
              description: reqItem.description || null,
              type: reqItem.type,
              is_required: reqItem.is_required,
              status,
              file: uploaded
                ? {
                    path: uploaded.file,
                    file_name: uploaded.file_name || uploaded.name,
                    url: presignedUrl,
                  }
                : null,
              uploadedAt: uploaded?.updatedAt || null,
            };
          })
        );

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
    )
      .populate("document_id", "name type")
      .lean();

    if (!doc) {
      return handleResponse(
        404,
        "Vendor document not found",
        {},
        res
      );
    }

    try {
      const vendor = await User.findById(vendorId)
        .select("first_name last_name email")
        .lean();

      if (vendor?.email) {
        const documentName =
          doc.document_id?.name || doc.name || doc.file_name || "Document";
        const statusLabel = DOCUMENT_STATUS_LABELS[status] || status;
        const vendorName =
          `${vendor.first_name || ""} ${vendor.last_name || ""}`.trim() ||
          "Prestataire";

        await sendEmail({
          to: vendor.email,
          subject: `Ask Service - Statut de document mis à jour (${statusLabel})`,
          html: await documentStatusMail({
            name: vendorName,
            documentName,
            status,
            statusLabel,
          }),
        });
      }
    } catch (mailError) {
      console.log("Document status email error:", mailError);
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

    try {
      if (vendor.email) {
        const statusLabel = KYC_STATUS_LABELS[kyc_status] || kyc_status;
        const vendorName =
          `${vendor.first_name || ""} ${vendor.last_name || ""}`.trim() ||
          "Prestataire";

        await sendEmail({
          to: vendor.email,
          subject: `Ask Service - Statut KYC mis à jour (${statusLabel})`,
          html: await kycStatusMail({
            name: vendorName,
            status: kyc_status,
            statusLabel,
          }),
        });
      }
    } catch (mailError) {
      console.log("KYC status email error:", mailError);
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
