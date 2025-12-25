import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Code, Extension, ExpandMore, FolderOpen } from "@mui/icons-material";
import {
  Box, Typography, Button, Card, CardContent, CardActions,
  Grid, Container, CircularProgress, Alert, Accordion, AccordionSummary, AccordionDetails, Chip
} from "@mui/material";
import { getModules, deleteModule, type ModuleInfo } from "../lib/api";
import TagFilter, { extractUniqueTags, filterByTags, groupByTags } from "../components/TagFilter";

export default function Modules() {
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Extract unique tags and filter/group modules
  const allTags = useMemo(() => extractUniqueTags(modules), [modules]);
  const filteredModules = useMemo(() => filterByTags(modules, selectedTags), [modules, selectedTags]);
  const groupedModules = useMemo(() => groupByTags(filteredModules), [filteredModules]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  useEffect(() => {
    getModules().then(setModules)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete module '${id}'?`)) return;

    try {
      await deleteModule(id);
      setModules(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      alert("Error deleting module: " + e);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h1">
          Modules
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1.5 }}>
            — Extend functionality with custom TypeScript steps
          </Typography>
        </Typography>
        <Button
          component={Link}
          to="/modules/new"
          variant="contained"
          startIcon={<Code />}
        >
          New Module
        </Button>
      </Box>

      {/* Tag Filter */}
      <TagFilter
        tags={allTags}
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
        onClearAll={() => setSelectedTags([])}
      />

      {/* Grouped by tags */}
      {Object.keys(groupedModules).length > 0 ? (
        Object.entries(groupedModules).map(([tag, modulesInGroup]) => (
          <Accordion key={tag} defaultExpanded sx={{ mb: 2, '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: 'action.hover' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FolderOpen fontSize="small" color="action" />
                <Typography variant="subtitle1" fontWeight="medium">
                  {tag === 'untagged' ? 'Untagged' : tag}
                </Typography>
                <Chip label={modulesInGroup.length} size="small" />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                {modulesInGroup.map(mod => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={mod.id}>
            <Card
              sx={{
                height: '100%',
                transition: '0.3s',
                display: 'flex',
                flexDirection: 'column',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
              }}
            >
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText'
                  }}>
                    <Extension />
                  </Box>
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography variant="h6" component="div" noWrap>
                      {mod.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {mod.description || `modules/${mod.id}.ts`}
                    </Typography>
                    {mod.tags && mod.tags.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                        {mod.tags.map(t => (
                          <Chip key={t} label={t} size="small" variant="outlined" color="secondary" sx={{ height: 18, fontSize: 10 }} />
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>

                {mod.fullDocs && (
                  <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' }, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 32, '& .MuiAccordionSummary-content': { margin: '8px 0' } }}>
                      <Typography variant="caption" fontWeight="bold">Documentation & Usage</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 1, pt: 0 }}>
                      <Box sx={{ maxHeight: 150, overflow: 'auto', p: 1, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                        <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{mod.fullDocs}</pre>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                )}
              </CardContent>
              <CardActions disableSpacing sx={{ justifyContent: 'flex-end', borderTop: '1px solid', borderColor: 'divider', px: 2, py: 1 }}>
                {!mod.isBuiltIn && (
                  <Button
                    size="small"
                    color="error"
                    onClick={(e) => handleDelete(e, mod.id)}
                    sx={{ mr: 'auto' }}
                  >
                    Delete
                  </Button>
                )}
                <Button
                  size="small"
                  component={Link}
                  to={`/modules/${mod.id}`}
                >
                  Edit
                </Button>
              </CardActions>
            </Card>
          </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))
      ) : (
        <Alert severity="info">
          {modules.length === 0 ? 'No modules found. Create one to extend your pipelines!' : 'No modules match the selected filters.'}
        </Alert>
      )}
    </Container>
  );
}
