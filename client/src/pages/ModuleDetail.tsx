import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { getModuleSource, saveModule } from "../lib/api";
import { Save, ArrowBack } from "@mui/icons-material";
import {
  Box, Typography, Button, Paper,
  IconButton, TextField
} from "@mui/material";

export default function ModuleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [code, setCode] = useState<string>(
    `
export async function run(ctx: any, params: any) {
  console.log("Running custom module", params);
  // Your logic here
  return { success: true };
}
`
  );
  const [loading, setLoading] = useState(false);
  const [isDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [customName, setCustomName] = useState("");

  useEffect(() => {
    if (id && id !== "new") {
      setLoading(true);
      getModuleSource(id).then(setCode).catch(() => {
        alert("Failed to load module");
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const handleSave = async () => {
    try {
      const targetId = id === "new" ? customName.trim() : id!;
      if (!targetId) return alert("Please enter a module name");

      await saveModule(targetId, code);

      if (id === "new") {
        navigate(`/modules/${targetId}`);
      } else {
        alert("Saved successfully");
      }
    } catch (e) {
      alert("Error saving: " + e);
    }
  };

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}>Loading module...</Box>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Paper elevation={1} square sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton component={Link} to="/modules">
            <ArrowBack />
          </IconButton>
          {id === "new" ? (
            <TextField
              placeholder="Module Name"
              variant="standard"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              InputProps={{ sx: { fontSize: '1.25rem', fontWeight: 'bold' } }}
            />
          ) : (
            <Typography variant="h6" component="div">
              {id}.ts
            </Typography>
          )}
        </Box>

        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<Save />}
        >
          Save Module
        </Button>
      </Paper>

      <Box sx={{ flexGrow: 1 }}>
        <Editor
          height="100%"
          defaultLanguage="typescript"
          value={code}
          theme={isDark ? "vs-dark" : "light"}
          onChange={(val) => setCode(val || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 20 },
          }}
        />
      </Box>
    </Box>
  );
}
