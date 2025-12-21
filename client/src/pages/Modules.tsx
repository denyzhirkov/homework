import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Code, Extension } from "@mui/icons-material";
import {
  Box, Typography, Button, Card, CardContent,
  Grid, Container, CircularProgress, Alert
} from "@mui/material";
import { getModules } from "../lib/api";

export default function Modules() {
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getModules().then(setModules)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Modules
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Extend functionality with custom TypeScript steps.
          </Typography>
        </Box>
        <Button
          component={Link}
          to="/modules/new"
          variant="contained"
          startIcon={<Code />}
        >
          New Module
        </Button>
      </Box>

      <Grid container spacing={3}>
        {modules.map(id => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={id}>
            <Card
              sx={{
                height: '100%',
                transition: '0.3s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
              }}
              component={Link}
              to={`/modules/${id}`}
              style={{ textDecoration: 'none' }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  display: 'flex'
                }}>
                  <Extension />
                </Box>
                <Box sx={{ overflow: 'hidden' }}>
                  <Typography variant="h6" component="div" noWrap>
                    {id}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    modules/{id}.ts
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
        {modules.length === 0 && (
          <Grid size={{ xs: 12 }}>
            <Alert severity="info">
              No modules found. Create one to extend your pipelines!
            </Alert>
          </Grid>
        )}
      </Grid>
    </Container>
  );
}
