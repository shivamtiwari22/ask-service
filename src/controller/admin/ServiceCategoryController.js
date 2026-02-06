import handleResponse from "../../../utils/http-response.js";
import ServiceCategory from "../../models/ServiceCategoryModel.js";

const normalizeOptions = (options = []) => {
  if (!Array.isArray(options)) return [];
  return options
    .map((option) => {
      if (typeof option === "string") {
        return { label: option.trim(), status: "ACTIVE" };
      }

      return {
        label: option?.label?.trim(),
        status: option?.status || "ACTIVE",
      };
    })
    .filter((option) => option.label);
};

// create service category
export const createServiceCategory = async (req, resp) => {
  try {
    const { title, description, image, status, parent_category, options } = req.body;

    if (parent_category) {
      const parentCategory = await ServiceCategory.findOne({
        _id: parent_category,
        deletedAt: null,
      });

      if (!parentCategory) {
        return handleResponse(404, "Parent category not found", {}, resp);
      }

      if (parentCategory.parent_category) {
        return handleResponse(
          400,
          "Only one level child category is allowed",
          {},
          resp
        );
      }
    }

    const category = await ServiceCategory.create({
      title,
      description,
      image,
      status,
      parent_category: parent_category || null,
      options: normalizeOptions(options),
      createdBy: req.user._id,
    });

    return handleResponse(201, "Service category created successfully", category, resp);
  } catch (err) {
    if (err?.code === 11000) {
      return handleResponse(409, "Category with same title already exists", {}, resp);
    }

    return handleResponse(500, err.message, {}, resp);
  }
};

// update service category
export const updateServiceCategory = async (req, resp) => {
  try {
    const { id } = req.params;
    const { title, description, image, status, parent_category, options } = req.body;

    const category = await ServiceCategory.findOne({ _id: id, deletedAt: null });
    if (!category) {
      return handleResponse(404, "Service category not found", {}, resp);
    }

    if (parent_category && parent_category !== String(category.parent_category || "")) {
      if (parent_category === id) {
        return handleResponse(400, "Category cannot be parent of itself", {}, resp);
      }

      const parentCategory = await ServiceCategory.findOne({
        _id: parent_category,
        deletedAt: null,
      });

      if (!parentCategory) {
        return handleResponse(404, "Parent category not found", {}, resp);
      }

      if (parentCategory.parent_category) {
        return handleResponse(
          400,
          "Only one level child category is allowed",
          {},
          resp
        );
      }
    }

    const payload = {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(image !== undefined ? { image } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(parent_category !== undefined ? { parent_category: parent_category || null } : {}),
      ...(options !== undefined ? { options: normalizeOptions(options) } : {}),
    };

    const updatedCategory = await ServiceCategory.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true }
    );

    return handleResponse(200, "Service category updated successfully", updatedCategory, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// get all service categories (deleted / non-deleted) with pagination & search
export const getAllServiceCategories = async (req, resp) => {
  try {
    const { search, status, parent_category, isDeleted, isParentOnly=false } = req.query;

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

    if (status) {
      filter.status = status;
    }

    if(isParentOnly==true){
      filter.parent_category = null;
    }

    if (parent_category === "null") {
      filter.parent_category = null;
    } else if (parent_category) {
      filter.parent_category = parent_category;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    let query = ServiceCategory.find(filter)
      .populate("parent_category", "title")
      .sort({ createdAt: -1 });

    if (!isPaginationDisabled) {
      query = query.skip(skip).limit(limit);
    }

    const [categories, total] = await Promise.all([
      query,
      ServiceCategory.countDocuments(filter),
    ]);

    return handleResponse(
      200,
      "Service categories fetched successfully",
      {
        list: categories,
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

// get service cateogory by id
export const getServiceCategoryById = async (req, resp) => {
  try {
    const { id } = req.params;

    const category = await ServiceCategory.findOne({ _id: id, deletedAt: null })
      .populate("parent_category", "title")
      .populate("createdBy", "first_name last_name email");

    if (!category) {
      return handleResponse(404, "Service category not found", {}, resp);
    }

    return handleResponse(200, "Service category fetched successfully", category, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// delete service category (soft delete)
export const deleteServiceCategory = async (req, resp) => {
  try {
    const { id } = req.params;

    const category = await ServiceCategory.findOne({ _id: id, deletedAt: null });
    if (!category) {
      return handleResponse(404, "Service category not found", {}, resp);
    }

    const childExists = await ServiceCategory.exists({
      parent_category: id,
      deletedAt: null,
    });

    if (childExists) {
      return handleResponse(
        400,
        "Delete child categories before deleting this category",
        {},
        resp
      );
    }

    category.deletedAt = new Date();
    await category.save();

    return handleResponse(200, "Service category deleted successfully", {}, resp);
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};

// restore deleted service category
export const restoreServiceCategory = async (req, resp) => {
  try{
    const { id } = req.params;
    const category = await ServiceCategory.findOne({ _id: id, deletedAt: { $ne: null } });
    if(!category){
      return handleResponse(404, "Deleted service category not found", {}, resp);
    }

    if(category.parent_category){
      const parentCategory = await ServiceCategory.findOne({
        _id: category.parent_category,
        deletedAt: null,
      });
      if(!parentCategory){
        return handleResponse(400, "Cannot restore category without restoring its parent category", {}, resp);
      }
    }

    category.deletedAt = null;
    await category.save();

    return handleResponse(200, "Service category restored successfully", {}, resp);

  }catch(err){
    return handleResponse(500, err.message, {}, resp);
  }
}
