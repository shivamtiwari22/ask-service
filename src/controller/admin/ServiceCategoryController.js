import handleResponse from "../../../utils/http-response.js";

// create service category
export const createServiceCategory = async (req, resp) => {
  try {
    
  } catch (err) {
    return handleResponse(500, err.message, {}, resp);
  }
};
