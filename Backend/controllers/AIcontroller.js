// Generate Articles

import sql from "../config/Neon.js";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import FormData from "form-data";
import fs from "fs";
import { runChat, recordUsage } from "../lib/aiService.js";
import { SERVICES, PROVIDERS } from "../config/aiServices.js";
import { ENTITLEMENTS } from "../config/entitlements.js";
import { checkFeatureAccess, consumeFeatureUsage } from "../services/entitlementService.js";
import { EntitlementError } from "../lib/entitlementError.js";
import { sendApiError } from "../lib/apiError.js";

import pdf from "pdf-parse/lib/pdf-parse.js";

// Phase 4: generic AI tools are gated by the application's entitlement + monthly
// usage system (not Clerk metadata). Each handler pre-checks access, runs the AI,
// then records one unit of monthly usage on success (spec §7, §18). These tools
// remain independent of the Phase 3 credit wallet.

const MAX_PROMPT_LENGTH = 1000;
const ARTICLE_LENGTHS = [800, 1500, 3000, 5000];

const badRequest = (res, message) =>
  res.status(400).json({ success: false, message });

const isValidPrompt = (prompt) =>
  typeof prompt === "string" &&
  prompt.trim().length > 0 &&
  prompt.length <= MAX_PROMPT_LENGTH;

export const GenArticle = async (req, res) => {
  const userId = req.user.id;
  const feature = ENTITLEMENTS.ARTICLE_GENERATION;
  try {
    await checkFeatureAccess(userId, feature);
  } catch (err) {
    return sendApiError(res, err);
  }

  try {
    const { prompt, length } = req.body;

    if (!isValidPrompt(prompt)) {
      return badRequest(res, `Prompt must be 1-${MAX_PROMPT_LENGTH} characters.`);
    }
    if (!ARTICLE_LENGTHS.includes(length)) {
      return badRequest(res, "Invalid article length.");
    }

    //Generate article using AI service (tracked centrally)
    const { res: response } = await runChat({
      service: SERVICES.ARTICLE,
      userId,
      reasoning_effort: "none",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: Math.min(Math.ceil(length * 1.5), 8000),
    });

    const content = response.choices?.[0].message?.content;

    //SQL Query to store the article in DB
    await sql`
  INSERT INTO creations(user_id, prompt, content, content_type)
  VALUES (${userId}, ${prompt}, ${content}, 'article')
`;

    // Record one unit of monthly usage (atomic; enforces the limit under races).
    await consumeFeatureUsage(userId, feature);

    res.json({
      success: true,
      content,
      message: "Article generated successfully",
    });
  } catch (error) {
    if (error instanceof EntitlementError) return sendApiError(res, error);
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const genBlogTitle = async (req, res) => {
  const userId = req.user.id;
  const feature = ENTITLEMENTS.BLOG_TITLE_GENERATION;
  try {
    await checkFeatureAccess(userId, feature);
  } catch (err) {
    return sendApiError(res, err);
  }

  try {
    const { prompt } = req.body;

    if (!isValidPrompt(prompt)) {
      return badRequest(res, `Prompt must be 1-${MAX_PROMPT_LENGTH} characters.`);
    }

    //Generate blog title using AI service (tracked centrally)
    const { res: result } = await runChat({
      service: SERVICES.BLOG_TITLE,
      userId,
      reasoning_effort: "none",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 200,
    });

    const content = result.choices?.[0].message?.content;

    //SQL Query to store the article in DB
    await sql`
  INSERT INTO creations(user_id, prompt, content, content_type)
  VALUES (${userId}, ${prompt}, ${content}, 'blog-title')
`;

    await consumeFeatureUsage(userId, feature);

    res.json({
      success: true,
      content,
      message: "Blog title generated successfully",
    });
  } catch (error) {
    if (error instanceof EntitlementError) return sendApiError(res, error);
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const genImage = async (req, res) => {
  const userId = req.user.id;
  const feature = ENTITLEMENTS.IMAGE_GENERATION;
  try {
    await checkFeatureAccess(userId, feature);
  } catch (err) {
    return sendApiError(res, err);
  }

  const startedAt = new Date();
  try {
    const { prompt, publish } = req.body;

    if (!isValidPrompt(prompt)) {
      return badRequest(res, `Prompt must be 1-${MAX_PROMPT_LENGTH} characters.`);
    }

    //Generate image using AI service
    const form = new FormData();
    form.append("prompt", prompt);
    const { data } = await axios.post(
      "https://clipdrop-api.co/text-to-image/v1",
      form,
      {
        headers: {
          "x-api-key": process.env.clipDrop_API_KEY,
        },
        responseType: "arraybuffer",
      }
    );

    const base64Image = `data:image/png;base64,${Buffer.from(
      data,
      "binary"
    ).toString("base64")}`;

    const { secure_url } = await cloudinary.uploader.upload(base64Image);

    //SQL Query to store the article in DB
    await sql`
  INSERT INTO creations(user_id, prompt, content, content_type,publish)
  VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})
`;

    await recordUsage({
      userId,
      service: SERVICES.IMAGE_GENERATION,
      provider: PROVIDERS.CLIPDROP,
      status: "success",
      startedAt,
    });

    await consumeFeatureUsage(userId, feature);

    res.json({
      success: true,
      content: secure_url,
      message: "Image generated successfully",
    });
  } catch (error) {
    // A usage-limit race is not a provider error — surface it without recording one.
    if (error instanceof EntitlementError) return sendApiError(res, error);
    console.error(error);
    await recordUsage({
      userId,
      service: SERVICES.IMAGE_GENERATION,
      provider: PROVIDERS.CLIPDROP,
      status: "error",
      startedAt,
      errorCode: "PROVIDER_ERROR",
      errorMessage: String(error.message || "").slice(0, 500),
    });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const removeImageBG = async (req, res) => {
  const userId = req.user.id;
  const feature = ENTITLEMENTS.IMAGE_EDITING;
  try {
    await checkFeatureAccess(userId, feature);
  } catch (err) {
    return sendApiError(res, err);
  }

  const startedAt = new Date();
  try {
    const image = req.file;

    //remove background using AI service

    if (!image) return badRequest(res, "Please upload an image.");

    const { secure_url } = await cloudinary.uploader.upload(image.path, {
      transformation: [
        {
          transformation: [{ effect: "background_removal" }], // ✅ correct
        },
      ],
    });

    //SQL Query to store the article in DB
    await sql`
  INSERT INTO creations(user_id, prompt, content, content_type)
  VALUES (${userId}, 'Remove background from image', ${secure_url}, 'image')
`;

    await recordUsage({
      userId,
      service: SERVICES.IMAGE_EDIT,
      provider: PROVIDERS.CLOUDINARY,
      status: "success",
      startedAt,
    });

    await consumeFeatureUsage(userId, feature);

    res.json({
      success: true,
      content: secure_url,
      message: "Background removed successfully",
    });
  } catch (error) {
    if (error instanceof EntitlementError) return sendApiError(res, error);
    console.error(error);
    await recordUsage({
      userId,
      service: SERVICES.IMAGE_EDIT,
      provider: PROVIDERS.CLOUDINARY,
      status: "error",
      startedAt,
      errorCode: "PROVIDER_ERROR",
      errorMessage: String(error.message || "").slice(0, 500),
    });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const removeImageObject = async (req, res) => {
  const userId = req.user.id;
  const feature = ENTITLEMENTS.IMAGE_EDITING;
  try {
    await checkFeatureAccess(userId, feature);
  } catch (err) {
    return sendApiError(res, err);
  }

  const startedAt = new Date();
  try {
    const { object } = req.body;
    const image = req.file;

    if (typeof object !== "string" || !/^[a-zA-Z ]{1,40}$/.test(object)) {
      return badRequest(res, "Object name must be 1-40 letters.");
    }

    //remove background using AI service

    if (!image) return badRequest(res, "Please upload an image.");

    const { public_id } = await cloudinary.uploader.upload(image.path);

    const imageUrl = cloudinary.url(public_id, {
      transformation: [
        {
          effect: `gen_remove:${object}`,
        },
      ],
      resource_type: "image",
    });

    //SQL Query to store the article in DB
    await sql`
  INSERT INTO creations(user_id, prompt, content, content_type)
  VALUES (${userId}, ${`Removed ${object} from image`}, ${imageUrl}, 'image')
`;

    await recordUsage({
      userId,
      service: SERVICES.IMAGE_EDIT,
      provider: PROVIDERS.CLOUDINARY,
      status: "success",
      startedAt,
    });

    await consumeFeatureUsage(userId, feature);

    res.json({
      success: true,
      content: imageUrl,
      message: "object removed successfully.",
    });
  } catch (error) {
    if (error instanceof EntitlementError) return sendApiError(res, error);
    console.error(error);
    await recordUsage({
      userId,
      service: SERVICES.IMAGE_EDIT,
      provider: PROVIDERS.CLOUDINARY,
      status: "error",
      startedAt,
      errorCode: "PROVIDER_ERROR",
      errorMessage: String(error.message || "").slice(0, 500),
    });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const resumeReview = async (req, res) => {
  const userId = req.user.id;
  const feature = ENTITLEMENTS.RESUME_REVIEW;
  try {
    await checkFeatureAccess(userId, feature);
  } catch (err) {
    return sendApiError(res, err);
  }

  try {
    const resume = req.file;

    //resume Analyzer
    if (!resume) return badRequest(res, "Please upload a PDF resume.");

    if (resume.size > 5 * 1024 * 1024) {
      return res.json({
        success: false,
        message: "Resume file size exceeds allowed size (5MB).",
      });
    }

    const dataBuffer = fs.readFileSync(resume.path);
    const pdfData = await pdf(dataBuffer);

    const prompt = `
    You are an expert career advisor and recruiter.
I will provide you with a candidate's resume.
Your task is to:

1. Analyze the skills, education, and work experience.
2. Suggest the most suitable job titles that match the candidate's profile.
3. Suggest alternative job roles the candidate could also be eligible for.
4. Highlight any missing skills or certifications that could improve their chances.
5. Give constructive feedback on how the resume can be improved (structure, keywords, clarity).
6. Provide a brief career roadmap (next steps the candidate should take).
7. Finally, rate the resume on a scale of 1 to 10, where 10 means highly professional, ATS-friendly, and tailored for jobs.
s
Resume content:\n\n\n ${pdfData.text}
    `;

    const { res: result } = await runChat({
      service: SERVICES.RESUME_REVIEW,
      userId,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 8000,
    });

    const content = result.choices?.[0].message?.content;

    //SQL Query to store the article in DB
    await sql`
  INSERT INTO creations(user_id, prompt, content, content_type)
  VALUES (${userId}, ${`Review the uploaded resume`}, ${content}, 'resume-review')
`;

    await consumeFeatureUsage(userId, feature);

    res.json({
      success: true,
      content,
    });
  } catch (error) {
    if (error instanceof EntitlementError) return sendApiError(res, error);
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
