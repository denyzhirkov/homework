import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { getPipeline, savePipeline } from "../lib/api";
import { Save, ArrowBack, HelpOutline } from "@mui/icons-material";
import {
  Box, Typography, Button, Paper,
  IconButton, Chip
} from "@mui/material";

export default function PipelineDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [code, setCode] = useState("{\n  \"name\": \"New Pipeline\",\n  \"schedule\": \"0 12 * * *\",\n  \"steps\": [\n    {\n      \"module\": \"shell\",\n      \"params\": { \"cmd\": \"echo Hello\" }\n    }\n  ]\n}");
  const [name, setName] = useState("New Pipeline");
  const [loading, setLoading] = useState(false);
  const [isDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    if (id && id !== "new") {
      setLoading(true);
      getPipeline(id).then(p => {
        setName(p.name);
        const { id: _, ...rest } = p;
        setCode(JSON.stringify(rest, null, 2));
      }).catch(() => {
        alert("Failed to load pipeline");
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const handleSave = async () => {
    try {
      const parsed = JSON.parse(code);
      if (!parsed.name) throw new Error("Pipeline must have a name");

      const targetId = id === "new" ? parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : id!;
      await savePipeline(targetId, parsed);

      if (id === "new") {
        navigate(`/pipelines/${targetId}`);
      } else {
        setName(parsed.name);
        alert("Saved successfully");
      }
    } catch (e) {
      alert("Error saving: " + e);
    }
  };

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}>Loading pipeline...</Box>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Paper elevation={1} square sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton component={Link} to="/">
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h6" component="div" sx={{ lineHeight: 1 }}>
              {name}
            </Typography>
            {id === "new" && <Chip label="Unsaved" size="small" color="warning" sx={{ mt: 0.5 }} />}
          </Box>
        </Box>

        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<Save />}
        >
          Save Pipeline
        </Button>
      </Paper>

      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <Editor
          height="100%"
          defaultLanguage="json"
          value={code}
          theme={isDark ? "vs-dark" : "light"}
          onChange={(val) => setCode(val || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 20 },
            scrollBeyondLastLine: false,
            wordWrap: "on"
          }}
        />
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            p: 2,
            maxWidth: 300,
            opacity: 0.9,
            pointerEvents: 'none'
          }}
        >
          <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <HelpOutline fontSize="small" color="primary" />
            Quick Help
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Configure your pipeline steps as a JSON array.
            Use modules like `shell`, `git`, `http`.
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
