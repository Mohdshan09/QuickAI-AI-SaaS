# 🤖 AI-SaaS Platform

An all-in-one AI-powered SaaS platform that provides multiple intelligent services, including:

- ✍️ **Article Generation**  
- 📝 **Blog Title Generation**  
- 📄 **Resume Review**  
- 🖼️ **Image Background Remover**  
- 🧹 **Object Removal from Images**  
- ⚡ And many more AI utilities...

This project is built with a scalable architecture and integrates multiple AI APIs, Cloudinary for image processing, Clerk for authentication, and PostgreSQL for data storage.

---

## 📌 Features

- 🔐 Secure authentication & user management (Clerk)  
- 💳 Role-based access (Free vs Premium plans)  
- 📝 AI-powered text generation (articles, blogs, resumes)  
- 🎨 AI-powered image editing (background removal, object removal)  
- 📊 User dashboard with history of creations  
- ❤️ Like/Unlike system for AI-generated content  
- 📦 PostgreSQL + Neon for structured storage  
- ☁️ Cloudinary integration for image hosting & transformation  

---

## 🛠️ Tech Stack

**Frontend:** React.js, TailwindCSS, shadcn/ui  
**Backend:** Node.js, Express.js  
**Database:** PostgreSQL (Neon)  
**Auth:** Clerk  
**File Storage & Processing:** Cloudinary  
**AI Models:**  Gemini APIs  

---

## 🚀 Getting Started

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/your-username/ai-saas-platform.git
cd ai-saas-platform

2️⃣ Install Dependencies
npm install

3️⃣ Setup Environment Variables

Create a .env file in the root directory and add the following:

PORT=5000
DATABASE_URL=your_postgres_connection_string
CLERK_API_KEY=your_clerk_api_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key



🙌 Acknowledgements

OpenAI
 & Google Gemini
 for AI services

Clerk
 for authentication

Cloudinary
 for image storage & transformation

Neon
 for serverless Postgres



