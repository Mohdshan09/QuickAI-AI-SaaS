import React from "react";
import { Edit, Hash, Scissors, Sparkles } from "lucide-react";
import { useState } from "react";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import FormData from "form-data";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const RemoveObj = () => {
  const [input, setInput] = useState("");
  const [objects, setObjects] = useState("");
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");

  //Token
  const { getToken } = useAuth();

  const onSubmitHandler = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("image", input);
      formData.append("object", objects);

      if (objects.split(" ").length > 1) {
        return toast("Please enter only one object name");
      }
      const { data } = await axios.post("/api/ai/remove-obj", formData, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });

      if (data.success) {
        setContent(data.content);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }

    setLoading(false);
  };
  return (
    <div>
      <div className="h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-slate-700 ">
        {/* Left coloumn -1 */}
        <form
          onSubmit={onSubmitHandler}
          className="w-full max-w-lg p-4 bg-white rounded-lg border border-gray-200 "
          action=""
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 text-[#4a7aff]" />
            <h1 className="text-xl font-semibold">Object Remover</h1>
          </div>
          <p className="mt-6 text-sm font-medium">Upload Image</p>

          <input
            onChange={(e) => setInput(e.target.files[0])}
            type="file"
            accept="image/*"
            className="w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300 cursor-pointer"
            required
          />

          <p className="mt-6 text-sm font-medium">
            Describe the objects to remove
          </p>

          <textarea
            onChange={(e) => setObjects(e.target.value)}
            value={objects}
            rows={4}
            className="w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300"
            placeholder="Describe the objects you want to remove from the image..."
            required
          />

          <button
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#417df6] to-[#8e37eb] text-white px-4 py-2 mt-6 text-sm rounded-lg cursor-pointer"
          >
            {loading ? (
              <span className="w-4 h-4 my-1 rounded-full border-2 border-t-transparent animate-spin"></span>
            ) : (
              <Scissors className="w-5" />
            )}
            Remove Objects
          </button>
        </form>

        {/* Right column -2 */}
        <div className="w-full max-w-lg p-4 bg-white rounded-lg flex flex-col border border-gray-200 min-h-96">
          <div className="flex items-center gap-3">
            <Scissors className="w-5 h-5 text-[#4a7aff]" />
            <h1 className="text-xl font-semibold ">Processed Image</h1>
          </div>

          {!content ? (
            <div className="flex-1 flex justify-center items-center">
              <div className="text-sm flex flex-col items-center gap-5 text-gray-400">
                <Scissors className="w-9 h-9" />
                <p>Upload an image and click "Remove Objects" to get started</p>
              </div>
            </div>
          ) : (
            <img className="mt-3 w-full h-full" src={content} alt="img" />
          )}
        </div>
      </div>
    </div>
  );
};

export default RemoveObj;
