// "AI Assistant" card for the Manage screen. Shows status for each
// provider (Anthropic / OpenAI), lets the user connect / replace /
// disconnect each key independently, and exposes a model picker for
// the active provider. Keys live on the service in
// ~/.xarji/config.json — this card never sees the actual key value,
// just the boolean "is configured" from /api/ai/keys.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../ink/theme";
import { Card, CardTitle } from "../ink/primitives";
import {
  AI_PROVIDERS,
  deleteProviderKey,
  getProvider,
  loadAIConfig,
  onAIConfigChange,
  saveAIConfig,
  saveProviderKey,
  type AIConfig,
  type AIProviderId,
} from "../lib/aiConfig";
import { useAIKeyStatus } from "../hooks/useAIKeyStatus";

export function SettingsAISection() {
  const T = useTheme();
  const navigate = useNavigate();
  const { status, isLoading } = useAIKeyStatus();
  const [config, setConfig] = useState<AIConfig | null>(loadAIConfig);
  const [editingProvider, setEditingProvider] = useState<AIProviderId | null>(null);
  const [editKey, setEditKey] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAIConfigChange(() => setConfig(loadAIConfig())), []);

  const activeProvider = useMemo(() => (config ? getProvider(config.provider) : null), [config]);
  const connectedCount = (status.anthropic ? 1 : 0) + (status.openai ? 1 : 0);

  const editingObj = editingProvider ? getProvider(editingProvider) : null;
  const validEditKey = editingObj
    ? editKey.trim().startsWith(editingObj.keyPrefix) && editKey.trim().length >= 20
    : false;

  const startEdit = (id: AIProviderId) => {
    setEditingProvider(id);
    setEditKey("");
    setRevealed(false);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingProvider(null);
    setEditKey("");
    setError(null);
  };

  const saveEdit = async () => {
    if (!validEditKey || !editingProvider || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveProviderKey(editingProvider, editKey.trim());
      // If this was the user's first key, snap the local active config
      // to the provider they just connected.
      if (!config || !status[config.provider]) {
        const obj = getProvider(editingProvider);
        saveAIConfig({ provider: editingProvider, model: obj.defaultModel });
      }
      setEditingProvider(null);
      setEditKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const updateModel = (model: string) => {
    if (!config) return;
    saveAIConfig({ ...config, model });
  };

  const disconnect = async (id: AIProviderId) => {
    if (!window.confirm(`Disconnect ${getProvider(id).name}? The key will be removed from this device.`)) {
      return;
    }
    try {
      await deleteProviderKey(id);
      // If the active provider lost its key, drop the local pointer so
      // the chat UI re-routes (or shows the onboarding gate).
      if (config?.provider === id) {
        saveAIConfig({ provider: id, model: getProvider(id).defaultModel });
        setConfig(null);
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Card pad="24px 26px">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: T.accent,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              fontWeight: 800,
              fontFamily: T.sans,
            }}
          >
            ✧
          </div>
          <div>
            <CardTitle>AI Assistant</CardTitle>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2, fontFamily: T.sans }}>
              Provider keys live on this Mac in <code style={{ fontFamily: T.mono }}>~/.xarji/config.json</code>. The browser never sees them.
            </div>
          </div>
        </div>
        {!isLoading && connectedCount > 0 && (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(75,217,162,0.14)",
              color: T.green,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              fontFamily: T.sans,
            }}
          >
            {connectedCount} of 2 connected
          </span>
        )}
      </div>

      {!isLoading && connectedCount === 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 18px",
            background: T.accentSoft,
            border: `1px solid ${T.accent}33`,
            borderRadius: T.rMd,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 12.5,
              color: T.text,
              fontFamily: T.sans,
              flex: 1,
              lineHeight: 1.5,
            }}
          >
            Connect Claude or OpenAI to unlock the agentic chat. Plans, summaries, transaction
            search — created from natural-language prompts.
          </div>
          <button
            onClick={() => navigate("/assistant")}
            style={{
              padding: "10px 16px",
              borderRadius: T.rMd,
              border: "none",
              background: T.accent,
              color: "#fff",
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: T.sans,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Set up assistant →
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {AI_PROVIDERS.map((pp) => {
          const isConnected = status[pp.id];
          const isEditing = editingProvider === pp.id;
          return (
            <div
              key={pp.id}
              style={{
                padding: "14px 16px",
                background: T.panelAlt,
                borderRadius: T.rMd,
                border: `1px solid ${T.line}`,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: pp.color,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 800,
                    fontFamily: T.sans,
                  }}
                >
                  {pp.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, fontFamily: T.sans }}>
                    {pp.name} <span style={{ color: T.dim, fontWeight: 500, fontFamily: T.mono, fontSize: 11 }}>· by {pp.by}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono, marginTop: 2 }}>
                    {isConnected ? "Configured · key on disk" : "Not configured"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {isConnected ? (
                    <>
                      <button
                        onClick={() => startEdit(pp.id)}
                        disabled={isEditing}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: `1px solid ${T.line}`,
                          background: "transparent",
                          color: T.text,
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: T.sans,
                          cursor: isEditing ? "default" : "pointer",
                          opacity: isEditing ? 0.5 : 1,
                        }}
                      >
                        Replace
                      </button>
                      <button
                        onClick={() => disconnect(pp.id)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: `1px solid ${T.accent}55`,
                          background: T.accentSoft,
                          color: T.accent,
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: T.sans,
                          cursor: "pointer",
                        }}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startEdit(pp.id)}
                      disabled={isEditing}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "none",
                        background: T.accent,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: T.sans,
                        cursor: isEditing ? "default" : "pointer",
                        opacity: isEditing ? 0.5 : 1,
                      }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>

              {isEditing && editingObj && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ position: "relative" }}>
                    <input
                      type={revealed ? "text" : "password"}
                      value={editKey}
                      onChange={(e) => setEditKey(e.target.value)}
                      placeholder={editingObj.keyPrefix + "••••••••••••••••••••"}
                      autoComplete="off"
                      style={{
                        width: "100%",
                        padding: "10px 60px 10px 14px",
                        borderRadius: T.rMd,
                        background: T.panel,
                        border: `1px solid ${editKey && !validEditKey ? T.accent + "55" : T.line}`,
                        color: T.text,
                        fontSize: 13,
                        fontFamily: T.mono,
                        letterSpacing: 0.4,
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={() => setRevealed((r) => !r)}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        padding: "4px 8px",
                        fontSize: 9.5,
                        fontFamily: T.mono,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                        background: "transparent",
                        border: `1px solid ${T.line}`,
                        borderRadius: 5,
                        cursor: "pointer",
                        color: T.muted,
                      }}
                    >
                      {revealed ? "hide" : "show"}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, fontFamily: T.sans, lineHeight: 1.4 }}>
                    {editingObj.keyHint} · Generate one at{" "}
                    <span style={{ color: T.accent, fontFamily: T.mono }}>{editingObj.docs}</span>
                  </div>
                  {error && (
                    <div style={{ fontSize: 11, color: T.accent, fontFamily: T.sans }}>{error}</div>
                  )}
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      onClick={cancelEdit}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: `1px solid ${T.line}`,
                        background: "transparent",
                        color: T.muted,
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: T.sans,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={!validEditKey || saving}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "none",
                        background: validEditKey ? T.accent : T.panelAlt,
                        color: validEditKey ? "#fff" : T.dim,
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: T.sans,
                        cursor: validEditKey && !saving ? "pointer" : "not-allowed",
                        opacity: saving ? 0.7 : 1,
                      }}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {activeProvider && status[activeProvider.id] && (
        <div
          style={{
            marginTop: 14,
            padding: "14px 16px",
            background: T.panelAlt,
            borderRadius: T.rMd,
            border: `1px solid ${T.line}`,
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                color: T.dim,
                fontFamily: T.mono,
                letterSpacing: 0.6,
                textTransform: "uppercase",
              }}
            >
              Active model · {activeProvider.name}
            </div>
            <div style={{ fontSize: 11, color: T.muted, fontFamily: T.sans, marginTop: 4, lineHeight: 1.4 }}>
              Used for new conversations. Active threads keep their model.
            </div>
          </div>
          <select
            value={config?.model ?? activeProvider.defaultModel}
            onChange={(e) => updateModel(e.target.value)}
            style={{
              background: T.panel,
              border: `1px solid ${T.line}`,
              color: T.text,
              fontSize: 13,
              fontFamily: T.mono,
              padding: "8px 12px",
              borderRadius: 8,
              outline: "none",
              cursor: "pointer",
            }}
          >
            {activeProvider.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}
    </Card>
  );
}
