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
import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";

const App = () => {
  return (
    <div>
      <Toaster />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ai" element={<Layout />}>
          <Route index element={<Dashboard />} />
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
