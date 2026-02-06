import handleResponse from "../../../utils/http-response.js";
import ServiceCategory from "../../models/ServiceCategoryModel.js";
import ServiceDocumentRequirement from "../../models/ServiceDocumentRequirementModel.js";
import TestimonialMaster from "../../models/TestimonialMasterModel.js";
import TokenMaster from "../../models/TokenMasterModel.js";

const buildListQuery = ({ search, status }) => {
  const query = { deletedAt: null };
  if (status) {
    query.status = status;
  }
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
      { message: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }
  return query;
};

const getPagination = (req) => {
  const page = parseInt(req.query.page || "1");
  const limit = parseInt(req.query.limit || "10");
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const createTokenMaster = async (req, resp) => {
  try {
    const token = await TokenMaster.create({
      ...req.body,
      createdBy: req.user._id,
    });
    return handleResponse(201, "Token master created successfully", token, resp);
  } catch (err) {
    if (err?.code === 11000) {
      return handleResponse(409, "Token title already exists", {}, resp);
    }
    return handleResponse(500, err.message, {}, resp);
  }
};

export const getAllTokenMasters = async (req, resp) => {
  try {
    const { skip, page, limit } = getPagination(req);
    const query = buildListQuery(req.query);

    const [tokens, total] = await Promise.all([
      TokenMaster.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      TokenMaster.countDocuments(query),
    ]);

    return handleResponse(200, "Token masters fetched successfully", {
      list: tokens,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const updateTokenMaster = async (req, resp) => {
  try {
    const token = await TokenMaster.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: req.body },
      { new: true }
    );

    if (!token) return handleResponse(404, "Token master not found", {}, resp);

    return handleResponse(200, "Token master updated successfully", token, resp);
  } catch (err) {
    if (err?.code === 11000) {
      return handleResponse(409, "Token title already exists", {}, resp);
    }
    return handleResponse(500, err.message, {}, resp);
  }
};

export const deleteTokenMaster = async (req, resp) => {
  try {
    const token = await TokenMaster.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );

    if (!token) return handleResponse(404, "Token master not found", {}, resp);

    return handleResponse(200, "Token master deleted successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const createTestimonialMaster = async (req, resp) => {
  try {
    const testimonial = await TestimonialMaster.create({
      ...req.body,
      createdBy: req.user._id,
    });
    return handleResponse(
      201,
      "Testimonial master created successfully",
      testimonial,
      resp
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const getAllTestimonialMasters = async (req, resp) => {
  try {
    const { skip, page, limit } = getPagination(req);
    const query = buildListQuery(req.query);

    const [testimonials, total] = await Promise.all([
      TestimonialMaster.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      TestimonialMaster.countDocuments(query),
    ]);

    return handleResponse(200, "Testimonial masters fetched successfully", {
      list: testimonials,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const updateTestimonialMaster = async (req, resp) => {
  try {
    const testimonial = await TestimonialMaster.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: req.body },
      { new: true }
    );

    if (!testimonial)
      return handleResponse(404, "Testimonial master not found", {}, resp);

    return handleResponse(
      200,
      "Testimonial master updated successfully",
      testimonial,
      resp
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const deleteTestimonialMaster = async (req, resp) => {
  try {
    const testimonial = await TestimonialMaster.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );

    if (!testimonial)
      return handleResponse(404, "Testimonial master not found", {}, resp);

    return handleResponse(200, "Testimonial master deleted successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const createServiceDocumentRequirement = async (req, resp) => {
  try {
    const category = await ServiceCategory.findOne({
      _id: req.body.service_category,
      deletedAt: null,
    });
    if (!category) {
      return handleResponse(404, "Service category not found", {}, resp);
    }

    const requirement = await ServiceDocumentRequirement.create({
      ...req.body,
      createdBy: req.user._id,
    });

    return handleResponse(
      201,
      "Service document requirement created successfully",
      requirement,
      resp
    );
  } catch (err) {
    if (err?.code === 11000) {
      return handleResponse(409, "Requirement already exists for this service", {}, resp);
    }
    return handleResponse(500, err.message, {}, resp);
  }
};

export const getAllServiceDocumentRequirements = async (req, resp) => {
  try {
    const { skip, page, limit } = getPagination(req);
    const { search, status, service_category, is_required, type } = req.query;

    const query = {
      ...buildListQuery({ search, status }),
      ...(service_category ? { service_category } : {}),
      ...(type ? { type } : {}),
      ...(is_required !== undefined ? { is_required: is_required === "true" } : {}),
    };

    const [requirements, total] = await Promise.all([
      ServiceDocumentRequirement.find(query)
        .populate("service_category", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ServiceDocumentRequirement.countDocuments(query),
    ]);

    return handleResponse(200, "Service document requirements fetched successfully", {
      list: requirements,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

export const updateServiceDocumentRequirement = async (req, resp) => {
  try {
    if (req.body.service_category) {
      const category = await ServiceCategory.findOne({
        _id: req.body.service_category,
        deletedAt: null,
      });
      if (!category) {
        return handleResponse(404, "Service category not found", {}, resp);
      }
    }

    const requirement = await ServiceDocumentRequirement.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: req.body },
      { new: true }
    );

    if (!requirement) {
      return handleResponse(404, "Service document requirement not found", {}, resp);
    }

    return handleResponse(
      200,
      "Service document requirement updated successfully",
      requirement,
      resp
    );
  } catch (err) {
    if (err?.code === 11000) {
      return handleResponse(409, "Requirement already exists for this service", {}, resp);
    }
    return handleResponse(500, err.message, {}, resp);
  }
};

export const deleteServiceDocumentRequirement = async (req, resp) => {
  try {
    const requirement = await ServiceDocumentRequirement.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );

    if (!requirement) {
      return handleResponse(404, "Service document requirement not found", {}, resp);
    }

    return handleResponse(
      200,
      "Service document requirement deleted successfully",
      {},
      resp
    );
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};
