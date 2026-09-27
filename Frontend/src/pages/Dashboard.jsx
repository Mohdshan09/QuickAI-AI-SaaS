import React, { useEffect, useState } from "react";
import {
  FileText,
  Gem,
  Hash,
  Image,
  Layers,
  Sparkles,
  SquarePen,
} from "lucide-react";
import { Protect } from "@clerk/clerk-react";
import CreationItem from "../components/CreationItem";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import axios from "axios";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const PREVIEW_COUNT = 3;

const CATEGORIES = [
  { type: "article", label: "Articles", Icon: SquarePen, color: "from-[#226BFF] to-[#65ADFF]" },
  { type: "blog-title", label: "Blog Titles", Icon: Hash, color: "from-[#C341F6] to-[#8E37EB]" },
  { type: "image", label: "Images", Icon: Image, color: "from-[#20C363] to-[#11B97E]" },
  { type: "resume-review", label: "Resume Reviews", Icon: FileText, color: "from-[#12B7AC] to-[#08B6CE]" },
];

const OTHER_CATEGORY = { label: "Other", Icon: Layers, color: "from-[#64748B] to-[#94A3B8]" };

const CategorySection = ({ category, items }) => {
  const [showAll, setShowAll] = useState(false);
  const { label, Icon, color } = category;
  const visible = showAll ? items : items.slice(0, PREVIEW_COUNT);
  const hiddenCount = items.length - PREVIEW_COUNT;

  return (
    <section className="max-w-5xl">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex justify-center items-center`}>
          <Icon className="w-4 text-white" />
        </div>
        <h2 className="font-semibold text-slate-700">{label}</h2>
        <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>

      {visible.map((item) => (
        <CreationItem key={item.id} item={item} />
      ))}

      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-[#4a7aff] hover:underline"
        >
          {showAll ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </section>
  );
};

const Dashboard = () => {
  const [creations, setCreations] = useState([]);
  const [loading, setLoading] = useState(true);

  //Token
  const { getToken } = useAuth();

  const getDashboardData = async () => {
    try {
      const { data } = await axios.get("/api/user/get-user-creations", {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });

      if (data.success) {
        setCreations(data.creations);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }

    setLoading(false);
  };

  useEffect(() => {
    getDashboardData();
  }, []);

  // Group creations by type, newest first within each category
  const sorted = [...creations].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  const knownTypes = CATEGORIES.map((c) => c.type);
  const groups = [
    ...CATEGORIES.map((category) => ({
      category,
      items: sorted.filter((item) => item.content_type === category.type),
    })),
    {
      category: OTHER_CATEGORY,
      items: sorted.filter((item) => !knownTypes.includes(item.content_type)),
    },
  ].filter((group) => group.items.length > 0);
  return (
    <div className="h-full overflow-y-scroll p-6">
      <div className="flex justify-start gap-4 flex-wrap">
        {/* Total Creation Card */}
        <div className="flex justify-between items-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200">
          <div className="text-slate-600">
            <p className="text-sm">Total Creations</p>
            <h2 className="text-xl font-semibold">{creations.length}</h2>
          </div>
          <div className="w-10 h-10 rounded-lg  bg-gradient-to-br from-[#3588F2] to-[#0BB0D7] text-white flex justify-center items-center">
            <Sparkles className="w-5 text-white " />
          </div>
        </div>

        {/* Active Plan Name */}

        <div className="flex justify-between items-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200">
          <div className="text-slate-600">
            <p className="text-sm">Active Plan</p>
            <h2 className="text-xl font-semibold">
              <Protect plan="premium" fallback="Free">
                Premium
              </Protect>
            </h2>
          </div>
          <div className="w-10 h-10 rounded-lg  bg-gradient-to-br from-[#FF61C5] to-[#9E53EE] text-white flex justify-center items-center">
            <Gem className="w-5 text-white " />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-3/4">
          <span className="w-11 h-11 my-1 rounded-full border-3 border-purple-500 border-t-transparent animate-spin"></span>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.length === 0 ? (
            <p className="text-sm text-gray-500">
              No creations yet. Pick a tool from the sidebar to get started.
            </p>
          ) : (
            groups.map(({ category, items }) => (
              <CategorySection key={category.label} category={category} items={items} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
