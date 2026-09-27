import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useCallback, useMemo } from "react";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

// One place for every /api/career call, with the Clerk token attached.
// Each method returns response.data ({ success, ... }) and throws on network errors.
export const useCareerApi = () => {
  const { getToken } = useAuth();

  const request = useCallback(
    async (method, url, { data, isForm } = {}) => {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      if (isForm) headers["Content-Type"] = "multipart/form-data";
      const res = await axios({ method, url, data, headers });
      return res.data;
    },
    [getToken]
  );

  return useMemo(
    () => ({
      // resumes
      listResumes: () => request("get", "/api/career/resumes"),
      uploadResume: (formData) =>
        request("post", "/api/career/resumes", { data: formData, isForm: true }),
      deleteResume: (id) => request("delete", `/api/career/resumes/${id}`),
      // jobs
      listJobs: () => request("get", "/api/career/jobs"),
      getJob: (id) => request("get", `/api/career/jobs/${id}`),
      createJob: (data) => request("post", "/api/career/jobs", { data }),
      updateJob: (id, data) => request("patch", `/api/career/jobs/${id}`, { data }),
      deleteJob: (id) => request("delete", `/api/career/jobs/${id}`),
      // ai features
      getMatch: (jobId, resumeId) =>
        request("get", `/api/career/jobs/${jobId}/match?resumeId=${resumeId}`),
      runMatch: (jobId, resumeId, force = false) =>
        request("post", `/api/career/jobs/${jobId}/match`, { data: { resumeId, force } }),
      setMatchProgress: (jobId, resumeId, itemId, done) =>
        request("patch", `/api/career/jobs/${jobId}/match/progress`, {
          data: { resumeId, itemId, done },
        }),
    }),
    [request]
  );
};

// score → tailwind text/bg colour band
export const scoreColor = (score) => {
  if (score == null) return { text: "text-gray-400", ring: "#9CA3AF", label: "Not checked" };
  if (score < 50) return { text: "text-red-500", ring: "#EF4444", label: "Weak match" };
  if (score < 75) return { text: "text-amber-500", ring: "#F59E0B", label: "Fair match" };
  return { text: "text-green-600", ring: "#16A34A", label: "Strong match" };
};
