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
import { upload } from "../config/multer.js";

aiRouter.post("/gen-article", auth, GenArticle);
aiRouter.post("/gen-blogtitle", auth, genBlogTitle);
aiRouter.post("/gen-image", auth, genImage);

aiRouter.post("/remove-image-bg", upload.single("image"), auth, removeImageBG);
aiRouter.post("/remove-obj", auth, upload.single("image"), removeImageObject);
aiRouter.post("/review-resume", upload.single("resume"), auth, resumeReview);

export default aiRouter;
