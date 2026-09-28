import React from "react";
import { Route, Routes } from "react-router-dom";
import {
  Article,
  Community,
  Dashboard,
  GenImage,
  Home,
  Layout,
  ReviewResume,
  Title,
  RemoveObj,
} from "./pages/export.js";
import RemoveBG from "./pages/RemoveBG.jsx";
import Jobs from "./pages/career/Jobs.jsx";
import JobDetail from "./pages/career/JobDetail.jsx";
import MatchReport from "./pages/career/MatchReport.jsx";
import TailorResume from "./pages/career/TailorResume.jsx";
import PrintResume from "./pages/career/PrintResume.jsx";
import Resumes from "./pages/career/Resumes.jsx";
import { Toaster } from "react-hot-toast";

const App = () => {
  return (
    <div>
      <Toaster />
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Standalone print view — outside Layout so there is no sidebar */}
        <Route path="/ai/jobs/:id/print" element={<PrintResume />} />
        <Route path="/ai" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="jobs/:id" element={<JobDetail />} />
          <Route path="jobs/:id/match" element={<MatchReport />} />
          <Route path="jobs/:id/tailor" element={<TailorResume />} />
          <Route path="resumes" element={<Resumes />} />
          <Route path="write-article" element={<Article />} />
          <Route path="blog-titles" element={<Title />} />
          <Route path="gen-image" element={<GenImage />} />
          <Route path="remove-bg" element={<RemoveBG />} />
          <Route path="review-resume" element={<ReviewResume />} />
          <Route path="remove-obj" element={<RemoveObj />} />

          <Route path="community" element={<Community />} />
        </Route>
      </Routes>
    </div>
  );
};

export default App;
