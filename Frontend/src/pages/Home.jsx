import React from "react";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import AITools from "../components/AITools";
import ExamSnapSection from "../components/ExamSnapSection";
import Testimonials from "../components/Testimonials";
import Plans from "../components/Plans";
import Footer from "../components/Footer";

const Home = () => {
  return (
    <>
      <Navbar />
      <Hero/>
      <AITools/>
      <ExamSnapSection/>
      <Testimonials/>
      <Plans/>
      <Footer/>
    </>
  );
};

export default Home;
