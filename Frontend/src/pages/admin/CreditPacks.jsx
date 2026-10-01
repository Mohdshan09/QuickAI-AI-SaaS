import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAdminApi, fmtInt } from "../../lib/adminApi";
import { Card, PageHeader, Spinner, Badge } from "../../components/admin/ui";

// Admin credit-pack management (Phase 6, spec §34). Create / edit / disable packs; prices and
// credits are DB-backed config. Disabled packs can't be purchased but history is preserved.
// Every mutation is audited server-side.
const emptyForm = { key: "", name: "", description: "", credits: "", price: "" };

const CreditPacks = () => {
  const api = useAdminApi();
  const [packs, setPacks] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editKey, setEditKey] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .listCreditPacks()
      .then((r) => (r.success ? setPacks(r.packs) : toast.error(r.message)))
      .catch(() => toast.error("Failed to load credit packs."));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const startEdit = (p) => {
    setEditKey(p.key);
    setForm({ key: p.key, name: p.name, description: p.description ?? "", credits: String(p.credits), price: String(p.price) });
  };
  const resetForm = () => {
    setEditKey(null);
    setForm(emptyForm);
  };

  const submit = async () => {
    const credits = parseInt(form.credits, 10);
    const price = parseInt(form.price, 10);
    if (!form.name.trim() || !Number.isInteger(credits) || credits <= 0 || !Number.isInteger(price) || price < 0) {
      return toast.error("Name, positive credits and a non-negative price are required.");
    }
    try {
      setBusy(true);
      const body = { name: form.name.trim(), description: form.description.trim() || null, credits, price };
      const res = editKey
        ? await api.updateCreditPack(editKey, body)
        : await api.createCreditPack({ key: form.key.trim().toUpperCase(), ...body });
      if (res.success) {
        toast.success(editKey ? "Pack updated." : "Pack created.");
        resetForm();
        load();
      } else {
        toast.error(res.message || "Action failed.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const disable = async (key) => {
    const reason = window.prompt(`Reason for disabling ${key} (audited):`);
    if (reason == null) return;
    try {
      setBusy(true);
      const res = await api.disableCreditPack(key, { reason: reason.trim() || null });
      if (res.success) {
        toast.success("Pack disabled.");
        load();
      } else {
        toast.error(res.message || "Action failed.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!packs) return <Spinner />;

  return (
    <div>
      <PageHeader title="Credit Packs" subtitle="One-time top-up packs. Prices and credits are database-backed." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide text-left">
                  <th className="py-2">Key</th>
                  <th className="py-2">Name</th>
                  <th className="py-2 text-right">Credits</th>
                  <th className="py-2 text-right">Price</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packs.map((p) => (
                  <tr key={p.key} className="border-t border-gray-100">
                    <td className="py-2 font-mono text-xs">{p.key}</td>
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 text-right tabular-nums">{fmtInt(p.credits)}</td>
                    <td className="py-2 text-right tabular-nums">₹{fmtInt(p.price)}</td>
                    <td className="py-2">
                      <Badge tone={p.isActive ? "blue" : "gray"}>{p.isActive ? "active" : "inactive"}</Badge>
                    </td>
                    <td className="py-2 text-right">
                      <span className="flex justify-end gap-2">
                        <button
                          disabled={busy}
                          onClick={() => startEdit(p)}
                          className="text-xs px-2 py-1 rounded border border-gray-300 text-slate-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                        >
                          Edit
                        </button>
                        {p.isActive && (
                          <button
                            disabled={busy}
                            onClick={() => disable(p.key)}
                            className="text-xs px-2 py-1 rounded border border-gray-300 text-slate-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                          >
                            Disable
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            {editKey ? `Edit ${editKey}` : "New pack"}
          </h2>
          <div className="space-y-2">
            {!editKey && (
              <input value={form.key} onChange={setField("key")} placeholder="Key (e.g. XLARGE)"
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none" />
            )}
            <input value={form.name} onChange={setField("name")} placeholder="Name (e.g. 50 Credits)"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none" />
            <input value={form.description} onChange={setField("description")} placeholder="Description (optional)"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none" />
            <input value={form.credits} onChange={setField("credits")} placeholder="Credits" inputMode="numeric"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none" />
            <input value={form.price} onChange={setField("price")} placeholder="Price (₹)" inputMode="numeric"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none" />
            <div className="flex gap-2 pt-1">
              <button disabled={busy} onClick={submit}
                className="flex-1 text-sm px-3 py-1.5 rounded bg-gradient-to-r from-[#3c81f6] to-[#9234EA] text-white disabled:opacity-40 cursor-pointer">
                {editKey ? "Save" : "Create"}
              </button>
              {editKey && (
                <button disabled={busy} onClick={resetForm}
                  className="text-sm px-3 py-1.5 rounded border border-gray-300 text-slate-600 hover:bg-gray-50 cursor-pointer">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CreditPacks;
