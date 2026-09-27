// Generate Articles

import { clerkClient } from "@clerk/express";
import sql from "../config/Neon.js";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import FormData from "form-data";
import fs from "fs";
import { AI } from "../config/ai.js";

import pdf from "pdf-parse/lib/pdf-parse.js";

const MAX_PROMPT_LENGTH = 1000;
const ARTICLE_LENGTHS = [800, 1500, 3000, 5000];

const badRequest = (res, message) =>
  res.status(400).json({ success: false, message });

const isValidPrompt = (prompt) =>
  typeof prompt === "string" &&
  prompt.trim().length > 0 &&
  prompt.length <= MAX_PROMPT_LENGTH;

export const GenArticle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt, length } = req.body;

    if (!isValidPrompt(prompt)) {
      return badRequest(res, `Prompt must be 1-${MAX_PROMPT_LENGTH} characters.`);
    }
    if (!ARTICLE_LENGTHS.includes(length)) {
      return badRequest(res, "Invalid article length.");
    }

    const plan = req.plan;
    const free_usage = req.free_usage;

    if (plan != "premium" && free_usage >= 10) {
      return res.json({
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    //Generate article using AI service
    const response = await AI.chat.completions.create({
      model: "gemini-2.5-flash",
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
    console.log(JSON.stringify(response, null, 2));

    //SQL Query to store the article in DB
    await sql`
  INSERT INTO creations(user_id, prompt, content, content_type)
  VALUES (${userId}, ${prompt}, ${content}, 'article')
`;

    if (plan != "premium") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: free_usage + 1,
        },
      });
    }

    res.json({
      success: true,
      content,
      message: "Article generated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const genBlogTitle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt } = req.body;

    if (!isValidPrompt(prompt)) {
      return badRequest(res, `Prompt must be 1-${MAX_PROMPT_LENGTH} characters.`);
    }

    const plan = req.plan;
    const free_usage = req.free_usage;

    if (plan != "premium" && free_usage >= 10) {
      return res.json({
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    //Generate blog title using AI service
    const result = await AI.chat.completions.create({
      model: "gemini-2.5-flash",
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
    console.log(JSON.stringify(result, null, 2));

    //SQL Query to store the article in DB
    await sql`
  INSERT INTO creations(user_id, prompt, content, content_type)
  VALUES (${userId}, ${prompt}, ${content}, 'blog-title')
`;

    if (plan != "premium") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: free_usage + 1,
        },
      });
    }

    res.json({
      success: true,
      content,
      message: "Blog title generated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const genImage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt, publish } = req.body;

    if (!isValidPrompt(prompt)) {
      return badRequest(res, `Prompt must be 1-${MAX_PROMPT_LENGTH} characters.`);
    }

    const plan = req.plan;
    const free_usage = req.free_usage;

    if (plan != "premium" && free_usage >= 5) {
      return res.json({
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
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

    if (plan != "premium") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: free_usage + 1,
        },
      });
    }

    res.json({
      success: true,
      content: secure_url,
      message: "Image generated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const removeImageBG = async (req, res) => {
  try {
    const { userId } = req.auth();
    const image = req.file;

    const plan = req.plan;

    if (plan != "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium users.",
      });
    }

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

    res.json({
      success: true,
      content: secure_url,
      message: "Background removed successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const removeImageObject = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { object } = req.body;
    const image = req.file;

    if (typeof object !== "string" || !/^[a-zA-Z ]{1,40}$/.test(object)) {
      return badRequest(res, "Object name must be 1-40 letters.");
    }

    const plan = req.plan;

    if (plan != "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium users.",
      });
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

    res.json({
      success: true,
      content: imageUrl,
      message: "object removed successfully.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const resumeReview = async (req, res) => {
  try {
    const { userId } = req.auth();
    const resume = req.file;
    const plan = req.plan;
    const free_usage = req.free_usage;

    if (plan != "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium users.",
      });
    }

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

    const result = await AI.chat.completions.create({
      model: "gemini-2.5-flash",
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
    console.log(JSON.stringify(result, null, 2));

    //SQL Query to store the article in DB
    await sql`
  INSERT INTO creations(user_id, prompt, content, content_type)
  VALUES (${userId}, ${`Review the uploaded resume`}, ${content}, 'resume-review')
`;

    if (plan != "premium") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: free_usage + 1,
        },
      });
    }

    res.json({
      success: true,
      content,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
