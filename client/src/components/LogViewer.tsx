import { Box, Typography, Chip, Collapse } from "@mui/material";
import { CheckCircle, Error, HourglassEmpty, ExpandMore, ExpandLess, CallSplit } from "@mui/icons-material";
import { useState, useMemo } from "react";

interface LogBlock {
  id: string;
  title: string;
  lines: string[];
  status: "running" | "success" | "error" | "info" | "parallel";
  duration?: number; // milliseconds
  parallelGroup?: string; // group name for parallel steps
  children?: LogBlock[]; // nested blocks for parallel groups
}

// Extract timestamp from log line: [2024-12-26T10:30:45.123Z]
function parseTimestamp(line: string): number | null {
  const match = line.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\]/);
  if (match) {
    const date = new Date(match[1]);
    return isNaN(date.getTime()) ? null : date.getTime();
  }
  return null;
}

// Calculate duration between first and last timestamp in lines
function calculateDuration(lines: string[]): number | undefined {
  let firstTs: number | null = null;
  let lastTs: number | null = null;

  for (const line of lines) {
    const ts = parseTimestamp(line);
    if (ts !== null) {
      if (firstTs === null) firstTs = ts;
      lastTs = ts;
    }
  }

  if (firstTs !== null && lastTs !== null) {
    return lastTs - firstTs;
  }
  return undefined;
}

// Format duration for display
function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

interface LogViewerProps {
  content: string;
  isLive?: boolean;
}

// Parse log content into blocks by step
function parseLogBlocks(content: string): LogBlock[] {
  const lines = content.split("\n");
  const rawBlocks: LogBlock[] = [];
  const blocksByTitle = new Map<string, LogBlock>();
  let currentBlock: LogBlock | null = null;
  let headerLines: string[] = [];
  let blockId = 0;
  
  // Track parallel groups: { groupName: { count: N, startIndex: idx } }
  const parallelGroupInfo = new Map<number, { groupName: string; count: number }>();
  let pendingParallelGroup: { groupName: string; count: number; startBlockIndex: number } | null = null;

  // First pass: create blocks
  for (const line of lines) {
    // Check for parallel group marker: "Running N steps in parallel (group: ...)"
    const parallelMatch = line.match(/Running (\d+) steps in parallel \(group: (.+?)\)/);
    if (parallelMatch) {
      const count = parseInt(parallelMatch[1], 10);
      const groupName = parallelMatch[2];
      // Mark where parallel group starts (next block index)
      pendingParallelGroup = { 
        groupName, 
        count, 
        startBlockIndex: rawBlocks.length + (currentBlock ? 1 : 0)
      };
    }

    // Check for step start marker: "Running step: ..."
    const stepStartMatch = line.match(/\[.*?\] Running step: (.+)$/);
    
    if (stepStartMatch) {
      // Save previous block with duration
      if (currentBlock) {
        currentBlock.duration = calculateDuration(currentBlock.lines);
        rawBlocks.push(currentBlock);
        blocksByTitle.set(currentBlock.title, currentBlock);
      } else if (headerLines.length > 0) {
        // Save header as info block
        rawBlocks.push({
          id: `header-${blockId++}`,
          title: "Pipeline Info",
          lines: headerLines,
          status: "info"
        });
        headerLines = [];
      }
      
      // Check if this block is part of a pending parallel group
      let parallelGroup: string | undefined;
      if (pendingParallelGroup) {
        const currentIndex = rawBlocks.length;
        if (currentIndex >= pendingParallelGroup.startBlockIndex && 
            currentIndex < pendingParallelGroup.startBlockIndex + pendingParallelGroup.count) {
          parallelGroup = pendingParallelGroup.groupName;
        }
        // Store info for later grouping
        if (currentIndex === pendingParallelGroup.startBlockIndex) {
          parallelGroupInfo.set(currentIndex, {
            groupName: pendingParallelGroup.groupName,
            count: pendingParallelGroup.count
          });
        }
      }
      
      // Start new step block
      currentBlock = {
        id: `step-${blockId++}`,
        title: stepStartMatch[1],
        lines: [line],
        status: "running",
        parallelGroup
      };
    } else if (currentBlock) {
      currentBlock.lines.push(line);
      
      // Check for error in current block
      const errorMatch = line.match(/\[ERROR\]|\[.*?\] Pipeline failed:/);
      if (errorMatch) {
        currentBlock.status = "error";
      }
    } else {
      // Lines before first step (header info)
      if (line.trim()) {
        headerLines.push(line);
      }
    }
  }

  // Add remaining block with duration
  if (currentBlock) {
    currentBlock.duration = calculateDuration(currentBlock.lines);
    rawBlocks.push(currentBlock);
    blocksByTitle.set(currentBlock.title, currentBlock);
  } else if (headerLines.length > 0) {
    rawBlocks.push({
      id: `header-${blockId++}`,
      title: "Pipeline Info",
      lines: headerLines,
      status: "info"
    });
  }

  // Second pass: find all "Step '...' completed" messages and update block statuses
  for (const line of lines) {
    const completedMatch = line.match(/\[.*?\] Step '(.+?)' completed/);
    if (completedMatch) {
      const stepTitle = completedMatch[1];
      const block = blocksByTitle.get(stepTitle);
      if (block && block.status !== "error") {
        block.status = "success";
        // Update duration with the completion timestamp
        const completionTs = parseTimestamp(line);
        if (completionTs && block.lines.length > 0) {
          const startTs = parseTimestamp(block.lines[0]);
          if (startTs) {
            block.duration = completionTs - startTs;
          }
        }
      }
    }
  }

  // Third pass: group parallel blocks together
  const finalBlocks: LogBlock[] = [];
  let i = 0;
  while (i < rawBlocks.length) {
    const groupInfo = parallelGroupInfo.get(i);
    if (groupInfo && i + groupInfo.count <= rawBlocks.length) {
      // Create a parallel group container
      const children = rawBlocks.slice(i, i + groupInfo.count);
      const allSuccess = children.every(b => b.status === "success");
      const hasError = children.some(b => b.status === "error");
      const maxDuration = Math.max(...children.map(b => b.duration || 0));
      
      finalBlocks.push({
        id: `parallel-${blockId++}`,
        title: `Parallel: ${groupInfo.groupName}`,
        lines: [],
        status: hasError ? "error" : allSuccess ? "success" : "running",
        duration: maxDuration > 0 ? maxDuration : undefined,
        children
      });
      i += groupInfo.count;
    } else {
      finalBlocks.push(rawBlocks[i]);
      i++;
    }
  }

  // Check for pipeline finish in last block
  const lastLine = lines[lines.length - 1] || "";
  if (lastLine.includes("Pipeline finished")) {
    finalBlocks.push({
      id: `footer-${blockId++}`,
      title: "Summary",
      lines: [lastLine],
      status: "success"
    });
  }

  return finalBlocks;
}

function StatusIcon({ status }: { status: LogBlock["status"] }) {
  switch (status) {
    case "success":
      return <CheckCircle sx={{ fontSize: 16, color: "#4caf50" }} />;
    case "error":
      return <Error sx={{ fontSize: 16, color: "#f44336" }} />;
    case "running":
      return <HourglassEmpty sx={{ fontSize: 16, color: "#ff9800" }} />;
    default:
      return null;
  }
}

const statusColors: Record<LogBlock["status"], string> = {
  success: "#1b5e20",
  error: "#b71c1c",
  running: "#e65100",
  info: "#0d47a1",
  parallel: "#4a148c"
};

const borderColors: Record<LogBlock["status"], string> = {
  success: "#4caf50",
  error: "#f44336",
  running: "#ff9800",
  info: "#2196f3",
  parallel: "#9c27b0"
};

function LogBlockComponent({ block, defaultExpanded = true, nested = false }: { 
  block: LogBlock; 
  defaultExpanded?: boolean;
  nested?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = block.children && block.children.length > 0;

  return (
    <Box sx={{ mb: nested ? 0.5 : 1 }}>
      {/* Block Header */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: nested ? 0.75 : 1,
          bgcolor: statusColors[block.status],
          borderLeft: `3px solid ${borderColors[block.status]}`,
          borderRadius: expanded ? "4px 4px 0 0" : "4px",
          cursor: "pointer",
          "&:hover": { opacity: 0.9 }
        }}
      >
        {hasChildren ? (
          <CallSplit sx={{ fontSize: 16, color: "#ce93d8", transform: "rotate(180deg)" }} />
        ) : (
          <StatusIcon status={block.status} />
        )}
        <Typography
          variant="body2"
          sx={{ 
            flex: 1, 
            fontWeight: 500, 
            color: "#fff", 
            fontFamily: "monospace",
            fontSize: nested ? 11 : 12
          }}
        >
          {block.title}
          {hasChildren && (
            <Typography component="span" sx={{ ml: 1, opacity: 0.7, fontSize: 10 }}>
              ({block.children!.length} steps)
            </Typography>
          )}
        </Typography>
        {block.duration !== undefined && block.duration > 0 && (
          <Chip
            label={formatDuration(block.duration)}
            size="small"
            sx={{ 
              height: 18, 
              fontSize: 10, 
              bgcolor: "rgba(255,255,255,0.2)", 
              color: "#fff",
              "& .MuiChip-label": { px: 1 }
            }}
          />
        )}
        {expanded ? (
          <ExpandLess sx={{ fontSize: 18, color: "#fff" }} />
        ) : (
          <ExpandMore sx={{ fontSize: 18, color: "#fff" }} />
        )}
      </Box>

      {/* Block Content */}
      <Collapse in={expanded}>
        {hasChildren ? (
          // Render nested blocks for parallel group
          <Box
            sx={{
              p: 1,
              bgcolor: "#1a1a2e",
              borderLeft: `3px solid ${borderColors[block.status]}`,
              borderRadius: "0 0 4px 4px"
            }}
          >
            {block.children!.map((child) => (
              <LogBlockComponent
                key={child.id}
                block={child}
                defaultExpanded={false}
                nested
              />
            ))}
          </Box>
        ) : block.lines.length > 0 ? (
          <Box
            sx={{
              p: 1.5,
              bgcolor: "#0d0d0d",
              borderLeft: `3px solid ${borderColors[block.status]}`,
              borderRadius: "0 0 4px 4px"
            }}
          >
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "#b0b0b0",
                fontSize: 11,
                lineHeight: 1.4
              }}
            >
              {block.lines.join("\n")}
            </pre>
          </Box>
        ) : null}
      </Collapse>
    </Box>
  );
}

export default function LogViewer({ content, isLive = false }: LogViewerProps) {
  const blocks = useMemo(() => parseLogBlocks(content), [content]);

  if (!content || content.trim() === "") {
    return (
      <Typography color="gray" sx={{ p: 2, textAlign: "center" }}>
        {isLive ? "Waiting for logs..." : "No logs available"}
      </Typography>
    );
  }

  // If no blocks parsed (simple log), show as plain text
  if (blocks.length === 0) {
    return (
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "#b0b0b0" }}>
        {content}
      </pre>
    );
  }

  return (
    <Box sx={{ p: 1 }}>
      {blocks.map((block, index) => (
        <LogBlockComponent
          key={block.id}
          block={block}
          defaultExpanded={isLive || index >= blocks.length - 3}
        />
      ))}
    </Box>
  );
}
