import express from "express";
import { auth } from "../middlewares/auth.js";
import { aiRateLimit } from "../middlewares/rateLimit.js";
import { uploadPdf } from "../config/multer.js";
import { planLimit } from "../middlewares/planLimit.js";
import {
  uploadResume,
  listResumes,
  deleteResume,
  createJob,
  listJobs,
  getJob,
  updateJob,
  deleteJob,
} from "../controllers/Career.js";
import { createMatch, getMatch, setMatchProgress } from "../controllers/Match.js";

const careerRouter = express.Router();

// resumes
careerRouter.post("/resumes", aiRateLimit, auth, uploadPdf.single("resume"), uploadResume);
careerRouter.get("/resumes", auth, listResumes);
careerRouter.delete("/resumes/:id", auth, deleteResume);

// jobs
careerRouter.post("/jobs", auth, createJob);
careerRouter.get("/jobs", auth, listJobs);
careerRouter.get("/jobs/:id", auth, getJob);
careerRouter.patch("/jobs/:id", auth, updateJob);
careerRouter.delete("/jobs/:id", auth, deleteJob);

// AI features
careerRouter.get("/jobs/:id/match", auth, getMatch);
careerRouter.post("/jobs/:id/match", aiRateLimit, auth, planLimit("match", 4), createMatch);
careerRouter.patch("/jobs/:id/match/progress", auth, setMatchProgress);

export default careerRouter;
