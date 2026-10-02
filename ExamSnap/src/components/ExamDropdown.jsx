import { useNavigate } from "react-router-dom";
import { getExamsByGroup } from "../specs/loadSpecs.js";
import { useT } from "../i18n/index.jsx";

// Grouped native <select> of all exams (grouped by conducting body). Native select is the
// most mobile-friendly, accessible way to pick from a long list. Navigates on change.
export default function ExamDropdown() {
  const t = useT();
  const navigate = useNavigate();
  const groups = getExamsByGroup();

  return (
    <div>
      <label htmlFor="exam-dropdown" className="block text-sm text-slate-600 mb-1">
        {t("home.dropdownLabel")}
      </label>
      <select
        id="exam-dropdown"
        defaultValue=""
        onChange={(e) => e.target.value && navigate(`/${e.target.value}`)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500"
      >
        <option value="" disabled>
          {t("home.dropdownPlaceholder")}
        </option>
        {groups.map(({ group, exams }) => (
          <optgroup key={group} label={group}>
            {exams.map((e) => (
              <option key={e.id} value={e.slug}>
                {e.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
