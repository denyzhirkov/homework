import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlusOne, PlayArrow, Schedule } from "@mui/icons-material";
import {
  Box, Typography, Button, Card, CardContent, CardActions,
  Grid, Chip, Stack, Container, CircularProgress
} from "@mui/material";
import { getPipelines, type Pipeline, runPipeline } from "../lib/api";

export default function Pipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPipelines().then(setPipelines)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleRun = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Run this pipeline now?")) return;

    try {
      await runPipeline(id);
      alert("Pipeline triggered successfully!");
    } catch (e) {
      alert("Error triggering pipeline: " + e);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Pipelines
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Manage and monitor your automation workflows.
          </Typography>
        </Box>
        <Button
          component={Link}
          to="/pipelines/new"
          variant="contained"
          startIcon={<PlusOne />}
        >
          New Pipeline
        </Button>
      </Box>

      <Grid container spacing={3}>
        {pipelines.map(p => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: '0.3s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
              }}
              component={Link}
              to={`/pipelines/${p.id}`}
              style={{ textDecoration: 'none' }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" component="div" gutterBottom>
                  {p.name || p.id}
                </Typography>
                <Stack direction="row" spacing={1} mb={2}>
                  <Chip label={`${p.steps?.length || 0} steps`} size="small" />
                  {p.schedule && (
                    <Chip
                      icon={<Schedule />}
                      label={p.schedule}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                </Stack>
              </CardContent>
              <CardActions disableSpacing sx={{ justifyContent: 'flex-end', borderTop: '1px solid #eee' }}>
                <Button
                  size="small"
                  color="success"
                  startIcon={<PlayArrow />}
                  onClick={(e) => handleRun(e, p.id)}
                >
                  Run Now
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
        {pipelines.length === 0 && (
          <Grid size={{ xs: 12 }}>
            <Box
              sx={{
                p: 8,
                textAlign: 'center',
                border: '2px dashed #eee',
                borderRadius: 2,
                bgcolor: 'background.paper'
              }}
            >
              <Typography color="text.secondary" gutterBottom>
                No pipelines found.
              </Typography>
              <Button component={Link} to="/pipelines/new">
                Create your first pipeline
              </Button>
            </Box>
          </Grid>
        )}
      </Grid>
    </Container>
  );
}
