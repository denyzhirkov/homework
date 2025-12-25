import { Box, Chip, Typography } from "@mui/material";
import { LocalOffer } from "@mui/icons-material";

interface TagFilterProps {
  tags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  onClearAll: () => void;
}

export default function TagFilter({ tags, selectedTags, onTagToggle, onClearAll }: TagFilterProps) {
  if (tags.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
      <LocalOffer fontSize="small" color="action" />
      <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
        Filter:
      </Typography>
      <Chip
        label="All"
        size="small"
        variant={selectedTags.length === 0 ? "filled" : "outlined"}
        color={selectedTags.length === 0 ? "primary" : "default"}
        onClick={onClearAll}
        sx={{ cursor: 'pointer' }}
      />
      {tags.map(tag => (
        <Chip
          key={tag}
          label={tag}
          size="small"
          variant={selectedTags.includes(tag) ? "filled" : "outlined"}
          color={selectedTags.includes(tag) ? "primary" : "default"}
          onClick={() => onTagToggle(tag)}
          sx={{ cursor: 'pointer' }}
        />
      ))}
    </Box>
  );
}

// Helper function to extract unique tags from items
export function extractUniqueTags<T extends { tags?: string[] }>(items: T[]): string[] {
  const tagSet = new Set<string>();
  items.forEach(item => {
    item.tags?.forEach(tag => tagSet.add(tag.toLowerCase()));
  });
  return Array.from(tagSet).sort();
}

// Helper function to filter items by tags
export function filterByTags<T extends { tags?: string[] }>(items: T[], selectedTags: string[]): T[] {
  if (selectedTags.length === 0) return items;
  return items.filter(item => 
    selectedTags.some(tag => item.tags?.map(t => t.toLowerCase()).includes(tag))
  );
}

// Helper function to group items by tags
export function groupByTags<T extends { tags?: string[] }>(items: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  const untagged: T[] = [];

  items.forEach(item => {
    if (!item.tags || item.tags.length === 0) {
      untagged.push(item);
    } else {
      item.tags.forEach(tag => {
        const normalizedTag = tag.toLowerCase();
        if (!groups[normalizedTag]) {
          groups[normalizedTag] = [];
        }
        // Avoid duplicates if item has multiple tags
        if (!groups[normalizedTag].includes(item)) {
          groups[normalizedTag].push(item);
        }
      });
    }
  });

  // Add untagged at the end
  if (untagged.length > 0) {
    groups["untagged"] = untagged;
  }

  return groups;
}

