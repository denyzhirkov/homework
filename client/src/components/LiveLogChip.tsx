import { useState, useCallback } from "react";
import { Typography, Skeleton, Box } from "@mui/material";
import { useWebSocket, type WSEvent } from "../lib/useWebSocket";

interface LiveLogChipProps {
  pipelineId: string;
  // Show skeleton when pipeline is running but no logs yet
  showSkeleton?: boolean;
}

// Inner content styles (container is managed by parent)
const contentStyles = {
  display: 'flex',
  alignItems: 'center',
  px: 1,
  height: '100%',
  minWidth: 150,
};

// Component to show live log for a running pipeline (using global WebSocket)
export function LiveLogChip({ pipelineId, showSkeleton = true }: LiveLogChipProps) {
  const [lastLog, setLastLog] = useState("");

  const handleEvent = useCallback((event: WSEvent) => {
    if (event.type === "log" && "pipelineId" in event && event.pipelineId === pipelineId) {
      const msg = event.payload.msg.slice(0, 80);
      setLastLog(msg);
    } else if (event.type === "start" && "pipelineId" in event && event.pipelineId === pipelineId) {
      setLastLog("");
    }
  }, [pipelineId]);

  useWebSocket(handleEvent);

  // Show skeleton while waiting for logs
  if (!lastLog) {
    if (!showSkeleton) return null;
    
    return (
      <Box sx={contentStyles}>
        <Skeleton 
          variant="text" 
          width="80%" 
          height={14}
          sx={{ 
            bgcolor: 'rgba(0, 255, 0, 0.1)',
            '&::after': {
              background: 'linear-gradient(90deg, transparent, rgba(0, 255, 0, 0.15), transparent)'
            }
          }} 
        />
      </Box>
    );
  }

  return (
    <Box sx={contentStyles}>
      <Typography
        variant="caption"
        sx={{
          color: '#0f0',
          fontFamily: 'monospace',
          fontSize: 10,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1,
        }}
      >
        {lastLog}
      </Typography>
    </Box>
  );
}
