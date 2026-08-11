import handleResponse from "../../../utils/http-response.js";
import ContactUs from "../../models/ContactUsModel.js";
import Faqs from "../../models/FaqsModel.js";
import Global from "../../models/GlobalModel.js";
import { fetchGlobalPlatformStats } from "../../../utils/globalSettingStats.js";

const parseDisplayOrder = (raw, { required = false } = {}) => {
  if (raw === undefined || raw === null || raw === "") {
    return required ? null : 999;
  }
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 1) return null;
  return num;
};

// create FAQ
export const createFaq = async (req, resp) => {
  try {
    const { question, type, answer, status, display_order, displayOrder } = req.body;

    const resolvedDisplayOrder = parseDisplayOrder(
      display_order !== undefined ? display_order : displayOrder,
    );
    if (resolvedDisplayOrder === null) {
      return handleResponse(
        400,
        "display_order must be an integer >= 1",
        {},
        resp,
      );
    }

    const faq = await Faqs.create({
      question,
      type: type || "general",
      answer,
      ...(status !== undefined ? { status } : {}),
      display_order: resolvedDisplayOrder,
    });

    return handleResponse(201, "FAQ created successfully", faq, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// get all FAQs with pagination and search
export const getAllFaqs = async (req, resp) => {
  try {
    const { search, type, status, isDeleted } = req.query;
    const page = parseInt(req.query.page ?? "1");
    const limit = parseInt(req.query.limit ?? "10");

    const isPaginationDisabled = page === 0 && limit === 0;
    const skip = isPaginationDisabled ? 0 : (page - 1) * limit;

    const filter = {};

    if (isDeleted === "true") {
      filter.deletedAt = { $ne: null };
    } else {
      filter.deletedAt = null;
    }

    if (type) {
      filter.type = type;
    }

    if (status !== undefined && status !== "") {
      filter.status = status === "true";
    }

    if (search) {
      filter.$or = [
        { question: { $regex: search, $options: "i" } },
        { answer: { $regex: search, $options: "i" } },
      ];
    }

    let query = Faqs.find(filter).sort({ display_order: -1 });

    if (!isPaginationDisabled) {
      query = query.skip(skip).limit(limit);
    }

    const [list, total] = await Promise.all([
      query.lean(),
      Faqs.countDocuments(filter),
    ]);

    return handleResponse(
      200,
      "FAQs fetched successfully",
      {
        list,
        pagination: isPaginationDisabled
          ? null
          : {
              total,
              page,
              limit,
              totalPages: Math.ceil(total / limit),
            },
      },
      resp
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// get FAQ by id
export const getFaqById = async (req, resp) => {
  try {
    const { id } = req.params;

    const faq = await Faqs.findOne({ _id: id, deletedAt: null }).lean();

    if (!faq) {
      return handleResponse(404, "FAQ not found", {}, resp);
    }

    return handleResponse(200, "FAQ fetched successfully", faq, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// update FAQ
export const updateFaq = async (req, resp) => {
  try {
    const { id } = req.params;
    const { question, type, answer, status, display_order, displayOrder } =
      req.body;

    const faq = await Faqs.findOne({ _id: id, deletedAt: null });
    if (!faq) {
      return handleResponse(404, "FAQ not found", {}, resp);
    }

    const payload = {};
    if (question !== undefined) payload.question = question;
    if (type !== undefined) payload.type = type;
    if (answer !== undefined) payload.answer = answer;
    if (status !== undefined) payload.status = status;

    const rawDisplayOrder =
      display_order !== undefined ? display_order : displayOrder;
    if (rawDisplayOrder !== undefined) {
      const resolvedDisplayOrder = parseDisplayOrder(rawDisplayOrder, {
        required: true,
      });
      if (resolvedDisplayOrder === null) {
        return handleResponse(
          400,
          "display_order must be an integer >= 1",
          {},
          resp,
        );
      }
      payload.display_order = resolvedDisplayOrder;
    }

    const updatedFaq = await Faqs.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true }
    );

    return handleResponse(200, "FAQ updated successfully", updatedFaq, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// delete FAQ (soft delete)
export const deleteFaq = async (req, resp) => {
  try {
    const { id } = req.params;

    const faq = await Faqs.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );

    if (!faq) {
      return handleResponse(404, "FAQ not found", {}, resp);
    }

    return handleResponse(200, "FAQ deleted successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// FAQ type order for consistent grouping (matches model enum)
const FAQ_TYPE_ORDER = ["general", "clients", "providers", "registration-verification", "credits-leads", "support"];

// get FAQs for user (only active, non-deleted) - grouped by type
export const getFaqsForUser = async (req, resp) => {
  try {
    const { type } = req.query;

    const filter = { deletedAt: null, status: true };
    if (type) {
      filter.type = type;
    }

    const faqs = await Faqs.aggregate([
      { $match: filter },
      {
        $addFields: {
          display_order: {
            $convert: {
              input: { $ifNull: ["$display_order", 999] },
              to: "int",
              onError: 999,
              onNull: 999,
            },
          },
        },
      },
      { $sort: { display_order: 1, createdAt: 1 } },
    ]);

    // Group by type (order within each type stays display_order ASC)
    const byType = {};
    for (const faq of faqs) {
      const t = faq.type || "general";
      if (!byType[t]) byType[t] = [];
      byType[t].push(faq);
    }

    // Keep a stable sort inside each type as a safeguard
    for (const t of Object.keys(byType)) {
      byType[t].sort(
        (a, b) =>
          (Number(a.display_order) || 999) - (Number(b.display_order) || 999),
      );
    }

    // Build list in fixed type order (only include types that have FAQs)
    const order = type ? [type] : FAQ_TYPE_ORDER;
    const list = order
      .filter((t) => byType[t]?.length)
      .map((t) => ({ type: t, faqs: byType[t] }));

    return handleResponse(
      200,
      "FAQs fetched successfully",
      { list },
      resp
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// restore deleted FAQ
export const restoreFaq = async (req, resp) => {
  try {
    const { id } = req.params;

    const faq = await Faqs.findOneAndUpdate(
      { _id: id, deletedAt: { $ne: null } },
      { $set: { deletedAt: null } },
      { new: true }
    );

    if (!faq) {
      return handleResponse(404, "Deleted FAQ not found", {}, resp);
    }

    return handleResponse(200, "FAQ restored successfully", faq, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};


export const contactUs = async (req, res) => {
    try {
      const all = await ContactUs.find().sort({ createdAt: -1 });

      handleResponse(200, "All", all, res);

    } catch (error) {
      return handleResponse(500, error.message, {}, res);
    }
  };




  export const addOrUpdateGlobal = async (req,res) => {
       try {
      const user = req.user;

      const images = req.files;
      const { logo, socialMedia, icon_image, ...globalSetting } = req.body;

      let existingGlobal = await Global.findOne();

      if (existingGlobal) {


        if (images && images.logo) {
          existingGlobal.logo = images.logo[0].path.replace(
            /\\/g,
            "/"
          );
        }

        if (images && images.icon_image) {
          existingGlobal.icon_image = images.icon_image[0].path.replace(
            /\\/g,
            "/"
          )
        }

        if (images && images.instagram_logo) {
          existingGlobal.instagram_logo = images.instagram_logo[0].path.replace(
            /\\/g,
            "/"
          )
        };


        if (images && images.facebook_logo) {
          existingGlobal.facebook_logo = images.facebook_logo[0].path.replace(
            /\\/g,
            "/"
          );
        }

        if (images && images.x_logo) {
          existingGlobal.x_logo = images.x_logo[0].path.replace(
            /\\/g,
            "/"
          )
        };


          if (images && images.linkedin_logo) {
          existingGlobal.linkedin_logo = images.linkedin_logo[0].path.replace(
            /\\/g,
            "/"
          )
        };

            if (images && images.footer_logo) {
          existingGlobal.footer_logo = images.footer_logo[0].path.replace(
            /\\/g,
            "/"
          )
        };

        if (images && images.vendor_logo) {
          existingGlobal.vendor_logo = images.vendor_logo[0].path.replace(
            /\\/g,
            "/"
          )
        };

        if (images && images.vendor_dark_logo) {
          existingGlobal.vendor_dark_logo = images.vendor_dark_logo[0].path.replace(
            /\\/g,
            "/"
          )
        };


        Object.assign(existingGlobal, globalSetting);
        await existingGlobal.save();
        return handleResponse(
          200,
          "global settings updated successfully.",
          existingGlobal,
          res
        );
      } else {
        const newShippingPolicy = new Global({
          created_by: user.id,
          ...globalSetting,
        });

        if (newShippingPolicy) {
     

          if (images && images.logo) {
            newShippingPolicy.logo = images.logo[0].path.replace(
              /\\/g,
              "/"
            )
          }

          if (images && images.icon_image) {
            newShippingPolicy.icon_image = images.icon_image[0].path.replace(
              /\\/g,
              "/"
            )
          }

          if (images && images.instagram_logo) {
            newShippingPolicy.instagram_logo = images.instagram_logo[0].path.replace(
              /\\/g,
              "/"
            )
          }

          if (images && images.facebook_logo) {
            newShippingPolicy.facebook_logo = images.facebook_logo[0].path.replace(
              /\\/g,
              "/"
            )
          }

          if (images && images.x_logo) {
            newShippingPolicy.x_logo = images.x_logo[0].path.replace(
              /\\/g,
              "/"
            )
          }


            if (images && images.linkedin_logo) {
          newShippingPolicy.linkedin_logo = images.linkedin_logo[0].path.replace(
            /\\/g,
            "/"
          )
        };


           if (images && images.footer_logo) {
          newShippingPolicy.footer_logo = images.footer_logo[0].path.replace(
            /\\/g,
            "/"
          )
        };

        if (images && images.vendor_logo) {
          newShippingPolicy.vendor_logo = images.vendor_logo[0].path.replace(
            /\\/g,
            "/"
          )
        };

        if (images && images.vendor_dark_logo) {
          newShippingPolicy.vendor_dark_logo = images.vendor_dark_logo[0].path.replace(
            /\\/g,
            "/"
          )
        };


        }


        await newShippingPolicy.save();
        return handleResponse(
          201,
          "Global Settings Created successfully.",
          { newShippingPolicy },
          res
        );
      }
    } catch (err) {
      return handleResponse(500, err.message, {}, res);
    }
  }


  export const getGlobalSetting =  async (req, res) => {
    try {
      const [firstRecord, platformStats] = await Promise.all([
        Global.findOne().sort({ _id: 1 }).exec(),
        fetchGlobalPlatformStats(),
      ]);

      if (!firstRecord) {
        return handleResponse(200, "Not Found", {}, res);
      }

      const globalData =
        typeof firstRecord.toJSON === "function"
          ? firstRecord.toJSON()
          : firstRecord.toObject();

      handleResponse(
        200,
        "global setting get successfully",
        {
          ...globalData,
          ...platformStats,
        },
        res,
      );
    } catch (err) {
      return handleResponse(500, err.message, {}, res);
    }
  };