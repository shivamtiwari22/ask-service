import handleResponse from "../../../utils/http-response.js";
import User from "../../models/UserModel.js";
import Role from "../../models/RoleModel.js";
import VendorDocument from "../../models/VendorDocumentModel.js";
import ServiceDocumentRequirement from "../../models/ServiceDocumentRequirementModel.js";
import { getServiceIds } from "../../../utils/helperFunction.js";
import { sendEmail } from "../../../config/emailConfig.js";
import {
  documentsAllVerifiedMail,
  documentsRejectedMail,
} from "../../../config/email/documentStatusMail.js";
import kycStatusMail from "../../../config/email/kycStatusMail.js";
import s3 from "../../../config/s3.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const KYC_STATUS_LABELS = {
  ACTIVE: "Actif / Vérifié",
  PENDING: "En attente",
  REJECTED: "Rejeté",
};

async function areAllRequiredDocumentsVerified(vendorId) {
  const vendor = await User.findById(vendorId).select("service").lean();
  const serviceIds = getServiceIds(vendor?.service);
  if (!serviceIds.length) return false;

  const requiredDocs = await ServiceDocumentRequirement.find({
    service_category: { $in: serviceIds },
    status: "ACTIVE",
    deletedAt: null,
    is_required: true,
  })
    .select("_id")
    .lean();

  if (!requiredDocs.length) return true;

  const vendorDocs = await VendorDocument.find({
    user_id: vendorId,
    document_id: { $in: requiredDocs.map((d) => d._id) },
  })
    .select("document_id status")
    .lean();

  const verifiedIds = new Set(
    vendorDocs
      .filter((d) => d.status === "Verified")
      .map((d) => d.document_id.toString()),
  );

  return requiredDocs.every((req) => verifiedIds.has(req._id.toString()));
}

async function getRejectedDocumentsForEmail(vendorId) {
  const rejected = await VendorDocument.find({
    user_id: vendorId,
    status: "Rejected",
  })
    .populate("document_id", "name")
    .lean();

  return rejected.map((d) => ({
    name: d.document_id?.name || d.name || d.file_name || "Document",
    reason:
      d.rejection_reason ||
      "Document non conforme — merci de le corriger et de le renvoyer.",
  }));
}

/**
 * Admin API: Get all vendors with their verification documents
 * Similar structure to vendor's VerificationDocument but for all vendors
 */

const generatePresignedUrl = async (filePath, expiry = 30 * 60) => {
  if (!filePath) return null;
  if (/^https?:\/\//i.test(filePath)) return filePath;

  const key = String(filePath).replace(/^\/+/, "").replace(/\\/g, "/");
  const privateBucket = process.env.S3_BUCKET_PRIVATE || "private";

  // New paths have no bucket prefix (document/xxx.pdf)
  // Legacy private/document/xxx.pdf → strip private/
  const objectKey = key.startsWith("private/")
    ? key.replace(/^private\//, "")
    : key;

  const command = new GetObjectCommand({
    Bucket: privateBucket,
    Key: objectKey,
  });

  return getSignedUrl(s3, command, { expiresIn: expiry });
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
          .sort({ display_order: 1, createdAt: 1 })
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
              rejection_reason: uploaded?.rejection_reason || null,
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
 * Emails:
 * - Verified: send 1 email only when ALL required documents are Verified
 * - Rejected: send 1 rejection email listing incorrect documents + issues
 * - Pending: no email
 */
export const updateVendorDocumentStatus = async (req, res) => {
  try {
    const { vendorId, documentId } = req.params;
    const { status, rejection_reason, reason } = req.body;
    const rejectionReason = (rejection_reason || reason || "").trim();

    const validStatuses = ["Pending", "Verified", "Rejected"];
    if (!status || !validStatuses.includes(status)) {
      return handleResponse(
        400,
        "Invalid status. Must be one of: Pending, Verified, Rejected",
        {},
        res
      );
    }

    if (status === "Rejected" && !rejectionReason) {
      return handleResponse(
        400,
        "rejection_reason is required when rejecting a document",
        {},
        res
      );
    }

    const updatePayload = {
      status,
      rejection_reason: status === "Rejected" ? rejectionReason : null,
    };

    const doc = await VendorDocument.findOneAndUpdate(
      { user_id: vendorId, document_id: documentId },
      { $set: updatePayload },
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
        const vendorName =
          `${vendor.first_name || ""} ${vendor.last_name || ""}`.trim() ||
          "Prestataire";

        if (status === "Rejected") {
          const rejectedDocuments = await getRejectedDocumentsForEmail(vendorId);
          await sendEmail({
            to: vendor.email,
            subject: "Ask Service - Documents à corriger",
            html: await documentsRejectedMail({
              name: vendorName,
              rejectedDocuments,
            }),
          });
        } else if (status === "Verified") {
          const allVerified = await areAllRequiredDocumentsVerified(vendorId);
          if (allVerified) {
            await sendEmail({
              to: vendor.email,
              subject: "Ask Service - Documents validés",
              html: await documentsAllVerifiedMail({
                name: vendorName,
              }),
            });
          }
        }
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
