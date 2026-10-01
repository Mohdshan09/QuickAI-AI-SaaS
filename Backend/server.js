import express from "express";
import multer from "multer";
import cors from "cors";
import "dotenv/config";
import { clerkMiddleware } from '@clerk/express'
import aiRouter from "./routes/AIroutes.js";
import connectCloudinary from "./config/cloudinary.js";
import userRouter from "./routes/User.js";
import careerRouter from "./routes/Career.js";
import adminRouter from "./routes/admin.js";
import meRouter from "./routes/me.js";
import creditRouter from "./routes/credit.js";
import entitlementsRouter from "./routes/entitlements.js";
import { clerkWebhook } from "./controllers/webhooks/clerk.js";


const app = express();
await connectCloudinary();

app.use(cors());

// Clerk webhooks must be registered BEFORE express.json() (signature
// verification needs the raw body) and are public (verified by signature, not a
// Clerk session), so they sit before requireAuth() too.
app.post("/api/webhooks/clerk", express.raw({ type: "application/json" }), clerkWebhook);

app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(clerkMiddleware());

app.get("/",(req,res) => {
    res.send("App is Live")
})


// Gate every /api/* route below. clerkMiddleware() above has already verified the
// session; here we require it and return a JSON 401 (spec sections 10 & 18)
// instead of Clerk's default redirect — this is a token-based API for the SPA, so
// an unauthenticated call must fail fast, not bounce to a sign-in page.
app.use(async (req, res, next) => {
    try {
        const { userId } = await req.auth();
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized." });
        next();
    } catch {
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }
});

app.use("/api/me",meRouter)
app.use("/api/credits",creditRouter)
app.use("/api/entitlements",entitlementsRouter)
app.use("/api/ai",aiRouter);
app.use("/api/user",userRouter)
app.use("/api/career",careerRouter)
app.use("/api/admin",adminRouter)

// Turn upload errors (file too large, wrong type) into a clean 400
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError || err.status === 400) {
        const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 5MB)." : err.message;
        return res.status(400).json({ success: false, message });
    }
    next(err);
});


const port = process.env.PORT || 3000;

app.listen(port,() => {
    console.log("App is running on",port);
})

