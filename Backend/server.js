import express from "express";
import multer from "multer";
import cors from "cors";
import "dotenv/config";
import { clerkMiddleware, requireAuth } from '@clerk/express'
import aiRouter from "./routes/AIroutes.js";
import connectCloudinary from "./config/cloudinary.js";
import userRouter from "./routes/User.js";
import careerRouter from "./routes/Career.js";
import adminRouter from "./routes/admin.js";


const app = express();
await connectCloudinary();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(clerkMiddleware());

app.get("/",(req,res) => {
    res.send("App is Live")
})


app.use(requireAuth());
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

