import express from "express";
const aiRouter = express.Router();

import {
  GenArticle,
  genBlogTitle,
  genImage,
  removeImageBG,
  removeImageObject,
  resumeReview,
} from "../controllers/AIcontroller.js";
import { auth } from "../middlewares/auth.js";
import { aiRateLimit } from "../middlewares/rateLimit.js";
import { uploadImage, uploadPdf } from "../config/multer.js";

// Runs before auth and file uploads so abusive requests are rejected cheaply
aiRouter.use(aiRateLimit);

aiRouter.post("/gen-article", auth, GenArticle);
aiRouter.post("/gen-blogtitle", auth, genBlogTitle);
aiRouter.post("/gen-image", auth, genImage);

aiRouter.post("/remove-image-bg", auth, uploadImage.single("image"), removeImageBG);
aiRouter.post("/remove-obj", auth, uploadImage.single("image"), removeImageObject);
aiRouter.post("/review-resume", auth, uploadPdf.single("resume"), resumeReview);

export default aiRouter;
