import express from "express";
import cors from "cors";
import "dotenv/config";
import { clerkMiddleware, requireAuth } from '@clerk/express'
import aiRouter from "./routes/AIroutes.js";
import connectCloudinary from "./config/cloudinary.js";
import userRouter from "./routes/User.js";


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


const port = process.env.PORT || 3000;

app.listen(port,() => {
    console.log("App is running on",port);
})

