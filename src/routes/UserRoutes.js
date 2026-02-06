import express from "express";
import handleResponse from "../../utils/http-response.js";
import { getUserServiceCategories } from "../controller/user/ServiceController.js";

const router = express.Router();

router.get("/service-categories", getUserServiceCategories);


router.get("/test", (req, res) => {
  return handleResponse(200, "User route is working fine", {}, res);
});

export default router;
