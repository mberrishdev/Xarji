import { Card, CardHeader, CardTitle, CardContent, CardDescription, Button, Input, Modal } from "../components/ui";
import { usePayments, useFailedPayments } from "../hooks/useTransactions";
import { useCategories } from "../hooks/useCategories";
import { useDeleteAllData } from "../hooks/useDeleteAllData";
import { useBankSenders } from "../hooks/useBankSenders";
import { Database, Download, Info, Trash2, AlertTriangle, Plus, ToggleLeft, ToggleRight, X } from "lucide-react";
import { useState } from "react";

export function Settings() {
  const { payments } = usePayments();
  const { failedPayments } = useFailedPayments();
  const { categories } = useCategories();

  const [isExporting, setIsExporting] = useState(false);

  // Delete all data
  const { deleteAllData, isDeleting, totalCount } = useDeleteAllData();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Bank senders
  const { senders, addSender, toggleSender, deleteSender } = useBankSenders();
  const [showAddSender, setShowAddSender] = useState(false);
  const [newSenderId, setNewSenderId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        payments: payments,
        failedPayments: failedPayments,
        categories: categories,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `expense-tracker-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAll = async () => {
    await deleteAllData();
    setShowDeleteModal(false);
    setDeleteConfirmText("");
  };

  const handleAddSender = async () => {
    if (!newSenderId.trim() || !newDisplayName.trim()) return;
    await addSender(newSenderId.trim(), newDisplayName.trim());
    setNewSenderId("");
    setNewDisplayName("");
    setShowAddSender(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your application settings and data
        </p>
      </div>

      {/* Data Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Overview
          </CardTitle>
          <CardDescription>
            Summary of your synced data from InstantDB
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">Successful Payments</p>
              <p className="text-2xl font-bold text-slate-900">{payments.length}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">Failed Payments</p>
              <p className="text-2xl font-bold text-slate-900">{failedPayments.length}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">Categories</p>
              <p className="text-2xl font-bold text-slate-900">{categories.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Data
          </CardTitle>
          <CardDescription>
            Download all your transaction data as JSON
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} loading={isExporting} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export All Data
          </Button>
        </CardContent>
      </Card>

      {/* Bank Sender Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Bank Sender Configuration
          </CardTitle>
          <CardDescription>
            Manage bank SMS sender IDs used to parse transactions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              These sender IDs should match your backend config at{" "}
              <code className="text-xs bg-blue-100 px-1 py-0.5 rounded">~/.xarji/config.json</code>.
              Changes here are stored in InstantDB for reference.
            </p>
          </div>

          {senders.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {senders.map((sender) => (
                <div key={sender.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{sender.displayName}</p>
                    <p className="text-xs text-slate-500">{sender.senderId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleSender(sender.id, !sender.enabled)}
                      className="p-1 rounded hover:bg-slate-100 transition-colors"
                      title={sender.enabled ? "Disable" : "Enable"}
                    >
                      {sender.enabled ? (
                        <ToggleRight className="w-6 h-6 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-slate-400" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteSender(sender.id)}
                      className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No bank senders configured yet.</p>
          )}

          {showAddSender ? (
            <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
              <Input
                label="Sender ID"
                placeholder="e.g. AD-HDFCBK"
                value={newSenderId}
                onChange={(e) => setNewSenderId(e.target.value)}
              />
              <Input
                label="Display Name"
                placeholder="e.g. HDFC Bank"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddSender}>
                  Add Sender
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddSender(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowAddSender(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add Sender
            </Button>
          )}
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-slate-900">SMS Expense Tracker</h4>
            <p className="text-sm text-slate-500 mt-1">
              A personal expense tracking application that reads bank SMS messages
              from your macOS Messages app and syncs them to InstantDB.
            </p>
          </div>
          <div className="text-sm text-slate-500 space-y-1">
            <p><strong>Backend Service:</strong> Bun + TypeScript</p>
            <p><strong>Database:</strong> InstantDB (real-time sync)</p>
            <p><strong>Client:</strong> React + Vite + Tailwind CSS</p>
          </div>
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Data is synced in real-time via InstantDB.
              Your bank SMS messages are parsed locally on your Mac.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that permanently delete your data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 border border-red-200 rounded-lg bg-red-50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-medium text-red-900">Delete All Data</h4>
                <p className="text-sm text-red-700 mt-1">
                  Permanently remove all {totalCount} records (payments, failed payments, and categories).
                  This action cannot be undone.
                </p>
              </div>
              <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal open={showDeleteModal} onClose={() => { setShowDeleteModal(false); setDeleteConfirmText(""); }} title="Delete All Data" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This will permanently delete <strong>{totalCount}</strong> records including all payments,
            failed payments, and categories. This action cannot be undone.
          </p>
          <Input
            label='Type "DELETE" to confirm'
            placeholder="DELETE"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(""); }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteConfirmText !== "DELETE"}
              loading={isDeleting}
              onClick={handleDeleteAll}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Everything
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
