import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Box, Typography, Grid, Card, CardContent, Divider, Button,
  Container, CircularProgress, Paper, Avatar, Chip, LinearProgress
} from "@mui/material";
import {
  AccountTree, Extension, Timer, Storage, ArrowForward
} from "@mui/icons-material";
import { getStats, getPipelines } from "../lib/api";
import { useWebSocket, type WSEvent } from "../lib/useWebSocket";
import { LiveLogChip } from "../components/LiveLogChip";

// Track progress for running pipelines
interface ProgressInfo {
  completed: number;
  total: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, ProgressInfo>>({});

  // Initial load
  useEffect(() => {
    Promise.all([getStats(), getPipelines()])
      .then(([s, p]) => {
        setStats(s);
        setPipelines(p.slice(0, 5));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Handle WebSocket events for real-time updates
  const handleEvent = useCallback((event: WSEvent) => {
    if (event.type === "init") {
      // Update running status from WebSocket
      setPipelines(prev => {
        return prev.map(p => {
          const status = event.pipelines.find(s => s.id === p.id);
          return status ? { ...p, isRunning: status.isRunning } : p;
        });
      });
    } else if (event.type === "start" && "pipelineId" in event) {
      // Mark pipeline as running and init progress
      setPipelines(prev =>
        prev.map(p => p.id === event.pipelineId ? { ...p, isRunning: true } : p)
      );
      setProgress(prev => ({
        ...prev,
        [event.pipelineId]: { completed: 0, total: event.payload.totalSteps }
      }));
    } else if (event.type === "step-end" && "pipelineId" in event) {
      // Update progress on step completion
      setProgress(prev => ({
        ...prev,
        [event.pipelineId]: {
          completed: event.payload.stepIndex + 1,
          total: event.payload.totalSteps
        }
      }));
    } else if (event.type === "end" && "pipelineId" in event) {
      // Mark pipeline as not running and clear progress
      setPipelines(prev =>
        prev.map(p => p.id === event.pipelineId ? { ...p, isRunning: false } : p)
      );
      setProgress(prev => {
        const { [event.pipelineId]: _, ...rest } = prev;
        return rest;
      });
    } else if (event.type === "pipelines:changed") {
      // Refetch pipelines when list changes
      getPipelines()
        .then(p => setPipelines(p.slice(0, 5)))
        .catch(console.error);
    }
  }, []);

  useWebSocket(handleEvent);

  if (loading) return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;

  const StatCard = ({ icon, title, value, color = "primary.main" }: any) => (
    <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', p: 2 }}>
      <Avatar sx={{ bgcolor: color, width: 56, height: 56, mr: 2 }}>
        {icon}
      </Avatar>
      <Box>
        <Typography variant="h4" fontWeight="bold">{value}</Typography>
        <Typography variant="body2" color="text.secondary">{title}</Typography>
      </Box>
    </Card>
  );

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Welcome back
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          System operational on <strong>{stats?.platform}</strong> (Deno {stats?.denoVersion}).
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 6 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key="pipelines">
          <StatCard icon={<AccountTree />} title="Pipelines" value={stats?.pipelinesCount} color="#1976d2" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key="modules">
          <StatCard icon={<Extension />} title="Modules" value={stats?.modulesCount} color="#9c27b0" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key="uptime">
          <StatCard icon={<Timer />} title="Uptime (s)" value={Math.floor(stats?.uptime || 0)} color="#2e7d32" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key="vars">
          <StatCard icon={<Storage />} title="Environment" value="Active" color="#ed6c02" />
        </Grid>
      </Grid>

      {/* Quick Actions & Recent */}
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }} key="recent">
          <Typography variant="h6" gutterBottom>Recent Pipelines</Typography>
          <Paper variant="outlined">
            {pipelines.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>No pipelines yet.</Box>
            ) : pipelines.map((p, i) => (
              <Box key={p.id} sx={{ position: 'relative' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {p.isRunning ? (
                      <CircularProgress size={24} />
                    ) : (
                      <AccountTree color="action" />
                    )}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {p.name || p.id}
                        {p.isRunning && <Chip size="small" label="Running" color="success" sx={{ ml: 1 }} />}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{p.id}.json</Typography>
                      {/* Always reserve space to prevent layout shift */}
                      <Box sx={{ 
                        mt: 1,
                        height: 24,
                        bgcolor: p.isRunning ? '#1e1e1e' : 'transparent',
                        borderRadius: 1,
                        overflow: 'hidden',
                        transition: 'background-color 0.2s',
                      }}>
                        {p.isRunning && <LiveLogChip pipelineId={p.id} />}
                      </Box>
                    </Box>
                  </Box>
                  <Button component={Link} to={`/pipelines/${p.id}`} size="small" endIcon={<ArrowForward />}>
                    View
                  </Button>
                </Box>
                {/* Progress bar at bottom of item */}
                {p.isRunning && (
                  <LinearProgress
                    variant={progress[p.id] ? "determinate" : "indeterminate"}
                    value={progress[p.id] ? (progress[p.id].completed / progress[p.id].total) * 100 : undefined}
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                    }}
                  />
                )}
                {i < pipelines.length - 1 && <Divider />}
              </Box>
            ))}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }} key="actions">
          <Typography variant="h6" gutterBottom>Quick Actions</Typography>
          <Card variant="outlined">
            <CardContent>
              <Button fullWidth variant="contained" component={Link} to="/pipelines/new" sx={{ mb: 2 }}>
                Create Pipeline
              </Button>
              <Button fullWidth variant="outlined" component={Link} to="/modules/new" sx={{ mb: 2 }}>
                Create Module
              </Button>
              <Button fullWidth variant="text" component={Link} to="/variables">
                Manage Variables
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
