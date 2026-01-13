import { useEffect, useState } from "react";
import {
  Box, Typography, Paper, TextField, Button,
  Divider, Container, CircularProgress, Tabs, Tab
} from "@mui/material";
import { Save, Add, Delete, VpnKey, ContentCopy, Check } from "@mui/icons-material";
import { getVariables, saveVariables, generateSSHKey, type VariablesConfig } from "../lib/api";

export default function Variables() {
  const [config, setConfig] = useState<VariablesConfig>({ global: {}, environments: {}, sshKeys: {} });
  const [loading, setLoading] = useState(true);
  const [newEnvName, setNewEnvName] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"global" | "environments" | "ssh">("global");

  useEffect(() => {
    getVariables()
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      await saveVariables(config);
      alert("Variables saved successfully");
    } catch (e) {
      alert("Error saving variables: " + e);
    }
  };

  const updateGlobal = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, global: { ...prev.global, [key]: value } }));
  };

  const addGlobal = () => {
    const key = prompt("Enter variable name (e.g. API_KEY):");
    if (!key) return;
    updateGlobal(key.toUpperCase(), "");
  };

  const removeGlobal = (key: string) => {
    if (!confirm("Delete variable?")) return;
    setConfig(prev => {
      const next = { ...prev.global };
      delete next[key];
      return { ...prev, global: next };
    });
  };

  const addEnv = () => {
    if (!newEnvName) return;
    setConfig(prev => ({
      ...prev,
      environments: { ...prev.environments, [newEnvName]: {} }
    }));
    setNewEnvName("");
  };

  const removeEnv = (env: string) => {
    if (!confirm(`Delete environment '${env}'?`)) return;
    setConfig(prev => {
      const next = { ...prev.environments };
      delete next[env];
      return { ...prev, environments: next };
    });
  };

  const updateEnvVar = (env: string, key: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      environments: {
        ...prev.environments,
        [env]: { ...prev.environments[env], [key]: value }
      }
    }));
  };

  const addEnvVar = (env: string) => {
    const key = prompt("Enter variable name (e.g. DB_HOST):");
    if (!key) return;
    updateEnvVar(env, key.toUpperCase(), "");
  };

  const removeEnvVar = (env: string, key: string) => {
    setConfig(prev => {
      const nextEnv = { ...prev.environments[env] };
      delete nextEnv[key];
      return {
        ...prev,
        environments: { ...prev.environments, [env]: nextEnv }
      };
    });
  };

  // SSH Keys management
  const handleGenerateKey = async () => {
    if (!newKeyName || generating) return;
    setGenerating(true);
    try {
      const keyPair = await generateSSHKey(newKeyName);
      // Normalize name same way as server
      const name = newKeyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      setConfig(prev => ({
        ...prev,
        sshKeys: { ...(prev.sshKeys || {}), [name]: keyPair }
      }));
      setNewKeyName("");
    } catch (e) {
      alert("Error generating SSH key: " + e);
    } finally {
      setGenerating(false);
    }
  };

  const removeSSHKey = (name: string) => {
    if (!confirm(`Delete SSH key '${name}'?`)) return;
    setConfig(prev => {
      const next = { ...(prev.sshKeys || {}) };
      delete next[name];
      return { ...prev, sshKeys: next };
    });
  };

  const copyPublicKey = async (name: string, publicKey: string) => {
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopiedKey(name);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      alert("Failed to copy to clipboard");
    }
  };

  // Format public key for display (show first and last parts)
  const formatPublicKey = (key: string): string => {
    if (key.length <= 60) return key; // Show full key if short
    const start = key.substring(0, 30);
    const end = key.substring(key.length - 30);
    return `${start}...${end}`;
  };

  if (loading) return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, mb: 2 }}>
        <Typography variant="h5" component="h1">
          Variables
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1.5 }}>
            — Manage global values, per-environment overrides, and SSH keys
          </Typography>
        </Typography>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={handleSave}
        >
          Save Changes
        </Button>
      </Box>

      <Paper sx={{ mb: 3, p: 0 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Global" value="global" />
          <Tab label="Environments" value="environments" />
          <Tab
            label={
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <VpnKey fontSize="small" /> SSH
              </Box>
            }
            value="ssh"
          />
        </Tabs>

        <Divider />

        {/* Global Variables */}
        {activeTab === "global" && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Global Variables
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                — Available in all pipelines
              </Typography>
            </Typography>

            {Object.entries(config.global).map(([key, val]) => (
              <Box key={key} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <TextField label="Key" value={key} disabled sx={{ flex: 1 }} />
                <TextField
                  label="Value"
                  value={val}
                  onChange={e => updateGlobal(key, e.target.value)}
                  fullWidth
                  sx={{ flex: 2 }}
                  type="password"
                />
                <Button color="error" onClick={() => removeGlobal(key)}><Delete /></Button>
              </Box>
            ))}

            {Object.keys(config.global).length === 0 && (
              <Typography color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                No global variables yet. Add one to make it available everywhere.
              </Typography>
            )}

            <Button startIcon={<Add />} onClick={addGlobal}>Add Variable</Button>
          </Box>
        )}

        {/* Environments */}
        {activeTab === "environments" && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Environments
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                — Variables active when pipeline selects this environment
              </Typography>
            </Typography>

            {Object.entries(config.environments).map(([envName, vars]) => (
              <Paper key={envName} sx={{ p: 3, mb: 3, borderLeft: '4px solid #1976d2' }} variant="outlined">
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{envName}</Typography>
                  <Button color="error" size="small" onClick={() => removeEnv(envName)}>Delete Env</Button>
                </Box>
                <Divider sx={{ mb: 2 }} />

                {Object.entries(vars).map(([key, val]) => (
                  <Box key={key} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                    <TextField label="Key" value={key} disabled sx={{ flex: 1 }} size="small" />
                    <TextField
                      label="Value"
                      value={val}
                      onChange={e => updateEnvVar(envName, key, e.target.value)}
                      fullWidth
                      size="small"
                      sx={{ flex: 2 }}
                      type="password"
                    />
                    <Button color="error" onClick={() => removeEnvVar(envName, key)}><Delete /></Button>
                  </Box>
                ))}

                {Object.keys(vars).length === 0 && (
                  <Typography color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                    No variables yet. Add values specific to this environment.
                  </Typography>
                )}

                <Button startIcon={<Add />} size="small" onClick={() => addEnvVar(envName)}>Add Variable</Button>
              </Paper>
            ))}

            <Paper sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', bgcolor: 'background.default' }} variant="outlined">
              <TextField
                placeholder="New Environment Name (e.g. staging)"
                size="small"
                value={newEnvName}
                onChange={e => setNewEnvName(e.target.value)}
              />
              <Button startIcon={<Add />} variant="outlined" onClick={addEnv} disabled={!newEnvName}>
                Create Environment
              </Button>
            </Paper>
          </Box>
        )}

        {/* SSH Keys */}
        {activeTab === "ssh" && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              <VpnKey sx={{ mr: 1, verticalAlign: 'middle', fontSize: '1.2rem' }} />
              SSH Keys
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                — Use in SSH module with keyName parameter
              </Typography>
            </Typography>

            {Object.entries(config.sshKeys || {}).map(([name, keyPair]) => (
              <Box key={name} sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {name}
                  </Typography>
                  <Button color="error" size="small" onClick={() => removeSSHKey(name)}>
                    <Delete fontSize="small" />
                  </Button>
                </Box>
                
                {/* Public Key - copyable */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Public Key (copy this to remote server's ~/.ssh/authorized_keys)
                  </Typography>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1
                  }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontFamily: 'monospace', 
                        fontSize: '0.75rem',
                        flex: 1,
                        color: 'text.secondary'
                      }}
                    >
                      {formatPublicKey(keyPair.publicKey)}
                    </Typography>
                    <Button
                      size="small"
                      variant={copiedKey === name ? "contained" : "outlined"}
                      color={copiedKey === name ? "success" : "primary"}
                      onClick={() => copyPublicKey(name, keyPair.publicKey)}
                      startIcon={copiedKey === name ? <Check /> : <ContentCopy />}
                      sx={{ minWidth: 100 }}
                    >
                      {copiedKey === name ? "Copied!" : "Copy"}
                    </Button>
                  </Box>
                </Box>

                {/* Private Key - hidden */}
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Private Key (stored securely, used automatically)
                  </Typography>
                  <TextField
                    value={keyPair.privateKey}
                    fullWidth
                    size="small"
                    type="password"
                    disabled
                    sx={{ 
                      '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.8rem' }
                    }}
                  />
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                  Usage in pipeline:{" "}
                  <Box
                    component="code"
                    sx={{
                      color: 'text.primary',
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      fontSize: '0.75em',
                    }}
                  >
                    "keyName": "{name}"
                  </Box>
                </Typography>
              </Box>
            ))}

            {Object.keys(config.sshKeys || {}).length === 0 && (
              <Typography color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                No SSH keys yet. Generate one to use with SSH module.
              </Typography>
            )}

            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                placeholder="Key name (e.g. production-server)"
                size="small"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerateKey()}
                sx={{ flex: 1 }}
                disabled={generating}
              />
              <Button 
                startIcon={<VpnKey />} 
                variant="contained"
                onClick={handleGenerateKey} 
                disabled={!newKeyName || generating}
              >
                {generating ? "Generating..." : "Generate SSH Key"}
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Container>
  );
}
