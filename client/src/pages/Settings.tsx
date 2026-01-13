import { useState, useRef } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Container,
  Alert,
  CircularProgress,
  Divider,
  Stack,
} from "@mui/material";
import {
  Download,
  Upload,
  Backup,
  CheckCircle,
  Error as ErrorIcon,
  SystemUpdateAlt,
  Refresh,
} from "@mui/icons-material";
import { exportBackup, importBackup, type BackupImportResult, checkUpdates, applyUpdate, type UpdateInfo, type UpdateResult } from "../lib/api";

export default function Settings() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BackupImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Updates state
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await exportBackup();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export backup");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".zip")) {
      setError("Please select a ZIP file");
      return;
    }

    setImporting(true);
    setError(null);
    setImportResult(null);

    try {
      const result = await importBackup(file);
      setImportResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to import backup");
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleCheckUpdates = async () => {
    setChecking(true);
    setError(null);
    setUpdateInfo(null);
    try {
      const info = await checkUpdates();
      setUpdateInfo(info);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to check for updates");
    } finally {
      setChecking(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!window.confirm("Are you sure you want to apply the update? It's recommended to create a backup first.")) {
      return;
    }

    setUpdating(true);
    setError(null);
    setUpdateResult(null);
    try {
      const result = await applyUpdate();
      setUpdateResult(result);
      // Refresh update info after update
      if (result.success) {
        await handleCheckUpdates();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply update");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 1, mb: 3 }}>
        <Typography variant="h5" component="h1">
          Settings
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1.5 }}>
            — System configuration and backup
          </Typography>
        </Typography>
      </Box>

      {/* Backup & Restore Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <Backup sx={{ mr: 1, color: "primary.main" }} />
          <Typography variant="h6">Backup & Restore</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Export or import system backup including pipelines, variables, and custom modules.
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Stack spacing={3}>
          {/* Export Section */}
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Export Backup
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Download a ZIP archive containing all pipelines (excluding demo), variables, and custom modules.
            </Typography>
            <Button
              variant="contained"
              startIcon={exporting ? <CircularProgress size={16} /> : <Download />}
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Export Backup"}
            </Button>
          </Box>

          <Divider />

          {/* Import Section */}
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Import Backup
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Restore pipelines, variables, and custom modules from a backup ZIP file.
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleImport}
              style={{ display: "none" }}
            />
            <Button
              variant="outlined"
              startIcon={importing ? <CircularProgress size={16} /> : <Upload />}
              onClick={handleImportClick}
              disabled={importing}
            >
              {importing ? "Importing..." : "Import Backup"}
            </Button>
          </Box>
        </Stack>

        {/* Error Alert */}
        {error && (
          <Alert
            severity="error"
            icon={<ErrorIcon />}
            sx={{ mt: 3 }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Import Result */}
        {importResult && (
          <Alert
            severity={importResult.success ? "success" : "warning"}
            icon={importResult.success ? <CheckCircle /> : <ErrorIcon />}
            sx={{ mt: 3 }}
            onClose={() => setImportResult(null)}
          >
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Import {importResult.success ? "completed" : "completed with errors"}
            </Typography>
            <Typography variant="body2" component="div">
              <Box component="span" sx={{ display: "block" }}>
                Pipelines: {importResult.details.pipelines.success} restored
                {importResult.details.pipelines.failed > 0 && (
                  <Box component="span" sx={{ color: "error.main", ml: 1 }}>
                    ({importResult.details.pipelines.failed} failed)
                  </Box>
                )}
              </Box>
              <Box component="span" sx={{ display: "block" }}>
                Modules: {importResult.details.modules.success} restored
                {importResult.details.modules.failed > 0 && (
                  <Box component="span" sx={{ color: "error.main", ml: 1 }}>
                    ({importResult.details.modules.failed} failed)
                  </Box>
                )}
              </Box>
              <Box component="span" sx={{ display: "block" }}>
                Variables: {importResult.details.variables.success ? "restored" : "failed"}
                {importResult.details.variables.error && (
                  <Box component="span" sx={{ color: "error.main", ml: 1 }}>
                    ({importResult.details.variables.error})
                  </Box>
                )}
              </Box>
              {importResult.details.pipelines.errors.length > 0 && (
                <Box sx={{ mt: 1, fontSize: "0.875rem" }}>
                  <Typography variant="caption" color="error">
                    Pipeline errors:
                  </Typography>
                  <Box component="ul" sx={{ pl: 2, mt: 0.5, mb: 0 }}>
                    {importResult.details.pipelines.errors.map((err, idx) => (
                      <li key={idx}>
                        <Typography variant="caption">{err}</Typography>
                      </li>
                    ))}
                  </Box>
                </Box>
              )}
              {importResult.details.modules.errors.length > 0 && (
                <Box sx={{ mt: 1, fontSize: "0.875rem" }}>
                  <Typography variant="caption" color="error">
                    Module errors:
                  </Typography>
                  <Box component="ul" sx={{ pl: 2, mt: 0.5, mb: 0 }}>
                    {importResult.details.modules.errors.map((err, idx) => (
                      <li key={idx}>
                        <Typography variant="caption">{err}</Typography>
                      </li>
                    ))}
                  </Box>
                </Box>
              )}
            </Typography>
          </Alert>
        )}
      </Paper>

      {/* Updates Section */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <SystemUpdateAlt sx={{ mr: 1, color: "primary.main" }} />
          <Typography variant="h6">Updates</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Check for available updates and apply them automatically or manually.
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Stack spacing={3}>
          {/* Check Updates Section */}
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Check for Updates
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Check GitHub for the latest version of HomeworkCI.
            </Typography>
            <Button
              variant="contained"
              startIcon={checking ? <CircularProgress size={16} /> : <Refresh />}
              onClick={handleCheckUpdates}
              disabled={checking}
            >
              {checking ? "Checking..." : "Check for Updates"}
            </Button>
          </Box>

          {/* Update Info */}
          {updateInfo && (
            <Box>
              <Alert
                severity={updateInfo.available ? "info" : "success"}
                sx={{ mb: 2 }}
              >
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  {updateInfo.available
                    ? `Update available: ${updateInfo.latest}`
                    : "You are running the latest version"}
                </Typography>
                <Typography variant="body2">
                  Current version: {updateInfo.current}
                  {updateInfo.latest && ` • Latest version: ${updateInfo.latest}`}
                </Typography>
                {updateInfo.available && !updateInfo.canAutoUpdate && (
                  <Typography variant="body2" sx={{ mt: 1, fontStyle: "italic" }}>
                    Automatic update is not available. Please update manually.
                  </Typography>
                )}
              </Alert>

              {updateInfo.available && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={updating ? <CircularProgress size={16} /> : <SystemUpdateAlt />}
                  onClick={handleApplyUpdate}
                  disabled={updating}
                  sx={{ mt: 1 }}
                >
                  {updating ? "Updating..." : "Apply Update"}
                </Button>
              )}
            </Box>
          )}

          {/* Update Result */}
          {updateResult && (
            <Alert
              severity={updateResult.success ? "success" : "warning"}
              icon={updateResult.success ? <CheckCircle /> : <ErrorIcon />}
              onClose={() => setUpdateResult(null)}
            >
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {updateResult.success
                  ? "Update applied successfully"
                  : updateResult.manual
                  ? "Manual update required"
                  : "Update failed"}
              </Typography>
              {updateResult.message && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {updateResult.message}
                </Typography>
              )}
              {updateResult.instructions && updateResult.instructions.length > 0 && (
                <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
                  {updateResult.instructions.map((instruction, idx) => (
                    <li key={idx}>
                      <Typography variant="body2" component="span">
                        {instruction}
                      </Typography>
                    </li>
                  ))}
                </Box>
              )}
              {updateResult.error && (
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                  Error: {updateResult.error}
                </Typography>
              )}
              {updateResult.syncResult && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" sx={{ display: "block", mb: 0.5 }}>
                    Sync results:
                  </Typography>
                  <Typography variant="body2" component="div">
                    <Box component="span" sx={{ display: "block" }}>
                      Pipelines: {updateResult.syncResult.pipelines.updated.length} updated
                    </Box>
                    <Box component="span" sx={{ display: "block" }}>
                      Modules: {updateResult.syncResult.modules.updated.length} updated
                    </Box>
                    <Box component="span" sx={{ display: "block" }}>
                      Variables: {updateResult.syncResult.variables.updated ? "updated" : "no changes"}
                    </Box>
                  </Typography>
                </Box>
              )}
            </Alert>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}

