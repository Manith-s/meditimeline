import React, { useEffect, useMemo, useState, useCallback } from "react";
import { fetchMedications, Medication } from "./api/medications";

import {
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  InputAdornment,
  Box,
  Fade,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HistoryIcon from "@mui/icons-material/History";

import Timeline from "@mui/lab/Timeline";
import TimelineItem from "@mui/lab/TimelineItem";
import TimelineSeparator from "@mui/lab/TimelineSeparator";
import TimelineConnector from "@mui/lab/TimelineConnector";
import TimelineContent from "@mui/lab/TimelineContent";
import TimelineDot from "@mui/lab/TimelineDot";
import TimelineOppositeContent from "@mui/lab/TimelineOppositeContent";

// Constants
const FILTER_STORAGE_KEY = "meditimeline-filter";
const SEARCH_STORAGE_KEY = "meditimeline-search";

type FilterType = "all" | "active";

/**
 * Parse ISO date string to UTC milliseconds.
 * Returns 0 for invalid dates (defensive).
 */
function toUtcMs(dateIso: string): number {
  const ms = Date.parse(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(ms)) {
    console.warn(`Invalid date string: ${dateIso}`);
    return 0;
  }
  return ms;
}

/** Get today's date as ISO string (YYYY-MM-DD) */
function getTodayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function daysBetween(startIso: string, endIso: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((toUtcMs(endIso) - toUtcMs(startIso)) / msPerDay);
}

/** Get ordinal suffix for a day number (1st, 2nd, 3rd, etc.) */
function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

/** Format ISO date string to human-readable format: "Aug 1st, 2023" */
function formatDateHuman(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00`);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}${getOrdinalSuffix(day)}, ${year}`;
}

/** Format date range as single line: "Aug 1st, 2023 → Sep 9th, 2024" or "Aug 1st, 2023 → ongoing" */
function formatDateRange(start: string, end: string | null): string {
  const startFormatted = formatDateHuman(start);
  const endFormatted = end ? formatDateHuman(end) : "ongoing";
  return `${startFormatted} → ${endFormatted}`;
}

/** Returns true if the medication has a valid date range (end >= start, or no end). */
function isValidDateRange(med: Medication): boolean {
  if (!med.end_date) return true; // Ongoing is valid
  return toUtcMs(med.end_date) >= toUtcMs(med.start_date);
}

/** 
 * Returns true if the medication is considered "active" (ongoing or ends in the future).
 * Medications that ended today are NOT considered active.
 * Medications with future start dates are NOT considered active unless ongoing.
 * Medications with invalid date ranges are NOT considered active.
 */
function isActiveMedication(med: Medication): boolean {
  // Invalid date ranges are not active
  if (!isValidDateRange(med)) return false;
  
  const today = getTodayIso();
  const todayMs = toUtcMs(today);
  const startMs = toUtcMs(med.start_date);
  
  // Future start dates are not active (unless explicitly ongoing)
  if (startMs > todayMs) {
    return med.end_date === null; // Only ongoing future meds are "active"
  }
  
  // No end date means ongoing (active)
  if (!med.end_date) return true;
  
  // Ended today or earlier = not active
  const endMs = toUtcMs(med.end_date);
  return endMs > todayMs;
}

/** Check if medication has a future start date */
function isFutureStart(med: Medication): boolean {
  const todayMs = toUtcMs(getTodayIso());
  return toUtcMs(med.start_date) > todayMs;
}

type Relation = {
  overlap: boolean;
  gapDays: number; // 0 if no gap
  doseChanged: boolean;
  facilityChanged: boolean;
  routeChanged: boolean;
  isConflict: boolean; // overlap + sameName + any field difference
};

function relationWithPrev(prev: Medication | null, curr: Medication): Relation {
  if (!prev) {
    return {
      overlap: false,
      gapDays: 0,
      doseChanged: false,
      facilityChanged: false,
      routeChanged: false,
      isConflict: false,
    };
  }

  // If prev has no end_date, it is ongoing: any later start overlaps.
  const prevEndMs = prev.end_date
    ? toUtcMs(prev.end_date)
    : Number.POSITIVE_INFINITY;
  const currStartMs = toUtcMs(curr.start_date);

  const overlap = currStartMs < prevEndMs;

  let gapDays = 0;
  if (prev.end_date) {
    const prevEnd = prev.end_date;
    // Gap exists if prev ends BEFORE curr starts (strictly earlier)
    if (toUtcMs(prevEnd) < currStartMs) {
      gapDays = Math.max(0, daysBetween(prevEnd, curr.start_date) - 1);
    }
  }

  // Switch cues (only meaningful if it's the same medication name)
  const sameName = prev.name === curr.name;
  const doseChanged = sameName && prev.dose !== curr.dose;
  const facilityChanged = sameName && prev.facility !== curr.facility;
  const routeChanged = sameName && prev.route !== curr.route;

  // Conflict: overlapping dates with same medication but contradictory data
  // This indicates records from different sources that need reconciliation
  const isConflict =
    overlap && sameName && (doseChanged || facilityChanged || routeChanged);

  return {
    overlap,
    gapDays,
    doseChanged,
    facilityChanged,
    routeChanged,
    isConflict,
  };
}

/** Load filter preference from localStorage */
function loadFilterPreference(): FilterType {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (stored === "active" || stored === "all") return stored;
  } catch {
    // localStorage not available
  }
  return "all"; // Default
}

/** Save filter preference to localStorage */
function saveFilterPreference(filter: FilterType): void {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, filter);
  } catch {
    // localStorage not available
  }
}

/** Load search query from localStorage */
function loadSearchQuery(): string {
  try {
    return localStorage.getItem(SEARCH_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Save search query to localStorage */
function saveSearchQuery(query: string): void {
  try {
    localStorage.setItem(SEARCH_STORAGE_KEY, query);
  } catch {
    // localStorage not available
  }
}

function App() {
  const [data, setData] = useState<Medication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<FilterType>(loadFilterPreference);
  const [searchQuery, setSearchQuery] = useState<string>(loadSearchQuery);

  useEffect(() => {
    let cancelled = false;

    fetchMedications()
      .then((items) => {
        if (!cancelled) setData(items);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Handle filter change with persistence
  const handleFilterChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newFilter: FilterType | null) => {
      if (newFilter !== null) {
        setFilter(newFilter);
        saveFilterPreference(newFilter);
      }
    },
    []
  );

  // Handle search change with persistence
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      saveSearchQuery(value);
    },
    []
  );

  // Sort medications chronologically and precompute previous medication lookup
  // This is used for relationship detection (always chronological)
  const { chronologicalSorted, prevByMedId } = useMemo(() => {
    // Sort chronologically (oldest first) for relationship detection
    const sortedList = [...data].sort(
      (a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id
    );

    // Build lookup map: for each medication, store its previous same-name medication
    const prevMap = new Map<number, Medication | null>();
    const lastByName = new Map<string, Medication>();

    for (const med of sortedList) {
      prevMap.set(med.id, lastByName.get(med.name) ?? null);
      lastByName.set(med.name, med);
    }

    return { chronologicalSorted: sortedList, prevByMedId: prevMap };
  }, [data]);

  // Display list: reverse chronological, filtered, and searched
  const { displayList, totalCount, filteredCount, activeCount } = useMemo(() => {
    const total = chronologicalSorted.length;
    const active = chronologicalSorted.filter(isActiveMedication).length;

    // Apply search filter (case-insensitive)
    const searchLower = searchQuery.toLowerCase().trim();
    let filtered = chronologicalSorted;
    
    if (searchLower) {
      filtered = filtered.filter((med) =>
        med.name.toLowerCase().includes(searchLower)
      );
    }

    // Apply active/all filter
    if (filter === "active") {
      filtered = filtered.filter(isActiveMedication);
    }

    // Reverse for display (newest first)
    const display = [...filtered].reverse();

    return {
      displayList: display,
      totalCount: total,
      filteredCount: filtered.length,
      activeCount: active,
    };
  }, [chronologicalSorted, filter, searchQuery]);

  // Check if we're showing a subset
  const isFiltered = filter === "active" || searchQuery.trim() !== "";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)",
        py: 4,
      }}
    >
      <Container maxWidth="md">
        {/* Header */}
        <Typography 
          variant="h4" 
          component="h1" 
          gutterBottom 
          sx={{ fontWeight: 600, color: "primary.main" }}
        >
          Medication Timeline
        </Typography>

      {/* Loading state */}
      {loading && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 4 }}>
          <CircularProgress size={24} />
          <Typography color="text.secondary">Loading medications…</Typography>
        </Box>
      )}

      {/* Error state */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Error: {error}
        </Alert>
      )}

      {/* No medications at all */}
      {!loading && !error && totalCount === 0 && (
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 4, 
            textAlign: "center",
            borderRadius: 2,
            borderStyle: "dashed",
          }}
        >
          <HistoryIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No medications found
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Medication records will appear here once added.
          </Typography>
        </Paper>
      )}

      {/* Main content when we have medications */}
      {!loading && !error && totalCount > 0 && (
        <>
          {/* Controls: Filter toggle and Search */}
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              mb: 2, 
              borderRadius: 2,
              backgroundColor: "grey.50",
            }}
          >
            <Stack 
              direction={{ xs: "column", sm: "row" }} 
              spacing={2} 
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              {/* Filter toggle */}
              <ToggleButtonGroup
                value={filter}
                exclusive
                onChange={handleFilterChange}
                aria-label="medication filter"
                size="small"
              >
                <ToggleButton 
                  value="all" 
                  aria-label="show all medications"
                  sx={{ px: 2 }}
                >
                  <HistoryIcon sx={{ mr: 1, fontSize: 18 }} />
                  All ({totalCount})
                </ToggleButton>
                <ToggleButton 
                  value="active" 
                  aria-label="show active medications"
                  sx={{ px: 2 }}
                >
                  <CheckCircleIcon sx={{ mr: 1, fontSize: 18 }} />
                  Active ({activeCount})
                </ToggleButton>
              </ToggleButtonGroup>

              {/* Search */}
              <TextField
                size="small"
                placeholder="Search medications…"
                value={searchQuery}
                onChange={handleSearchChange}
                sx={{ minWidth: 200 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 20, color: "text.disabled" }} />
                    </InputAdornment>
                  ),
                }}
                aria-label="search medications"
              />
            </Stack>

            {/* Filter indicator */}
            {isFiltered && (
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ mt: 1.5, fontStyle: "italic" }}
              >
                Showing {filteredCount} of {totalCount} medications
                {filter === "active" && searchQuery.trim() && " (active + search filter)"}
                {filter === "active" && !searchQuery.trim() && " (active only)"}
                {filter === "all" && searchQuery.trim() && " (search filter)"}
              </Typography>
            )}
          </Paper>

          {/* Empty state for filtered results */}
          {displayList.length === 0 && (
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 4, 
                textAlign: "center",
                borderRadius: 2,
                borderStyle: "dashed",
              }}
            >
              {filter === "active" && !searchQuery.trim() ? (
                <>
                  <CheckCircleIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No active medications
                  </Typography>
                  <Typography variant="body2" color="text.disabled">
                    All medications have ended. Switch to "All" to view history.
                  </Typography>
                </>
              ) : (
                <>
                  <SearchIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No medications match your search
                  </Typography>
                  <Typography variant="body2" color="text.disabled">
                    Try a different search term or clear the filter.
                  </Typography>
                </>
              )}
            </Paper>
          )}

          {/* Timeline */}
          {displayList.length > 0 && (
            <Paper 
              elevation={0} 
              sx={{ 
                p: 3, 
                borderRadius: 3,
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(10px)",
              }}
            >
              <Timeline
                sx={{
                  p: 0,
                  m: 0,
                  [`& .MuiTimelineItem-root`]: {
                    minHeight: "auto",
                    "&::before": { display: "none" },
                  },
                  [`& .MuiTimelineOppositeContent-root`]: {
                    flex: "0 0 280px",
                    maxWidth: "280px",
                    width: "280px",
                    pl: 0,
                    pr: 2,
                    minWidth: "280px",
                  },
                  [`& .MuiTimelineContent-root`]: {
                    flex: 1,
                    pr: 0,
                    pl: 2,
                  },
                  [`& .MuiTimelineSeparator-root`]: {
                    width: 24,
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    position: "relative",
                  },
                  [`& .MuiTimelineConnector-root`]: {
                    width: 2,
                    backgroundColor: "#bdbdbd",
                    marginLeft: "auto",
                    marginRight: "auto",
                    flex: 1,
                  },
                  [`& .MuiTimelineDot-root`]: {
                    marginLeft: "auto",
                    marginRight: "auto",
                    flexShrink: 0,
                    width: 20,
                    height: 20,
                    minWidth: 20,
                    minHeight: 20,
                    boxSizing: "border-box",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                }}
              >
                {displayList.map((m, idx) => {
                  const prev = prevByMedId.get(m.id) ?? null;
                  const rel = relationWithPrev(prev, m);
                  const validRange = isValidDateRange(m);
                  const isActive = isActiveMedication(m);
                  const isFuture = isFutureStart(m);
                  const isLast = idx === displayList.length - 1;
                  const isFirst = idx === 0;

                  return (
                    <Fade in key={m.id} timeout={300} style={{ transitionDelay: `${idx * 50}ms` }}>
                      <TimelineItem>
                        {/* Date pill - centered vertically */}
                        <TimelineOppositeContent
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            py: 0,
                            my: 1,
                          }}
                        >
                          <Paper
                            elevation={0}
                            sx={{
                              px: 2,
                              py: 1,
                              borderRadius: 10,
                              backgroundColor: isActive ? "#e8f5e9" : "#f5f5f5",
                              border: "1px solid",
                              borderColor: isActive ? "#a5d6a7" : "#e0e0e0",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: isActive ? "success.dark" : "text.secondary",
                                fontWeight: isActive ? 600 : 500,
                                fontSize: "0.8rem",
                              }}
                            >
                              {formatDateRange(m.start_date, m.end_date)}
                            </Typography>
                          </Paper>
                        </TimelineOppositeContent>

                        {/* Dot and connector - continuous line */}
                        <TimelineSeparator>
                          <TimelineConnector 
                            sx={{ 
                              visibility: isFirst ? "hidden" : "visible",
                            }} 
                          />
                          <TimelineDot
                            color={isActive ? "success" : "grey"}
                            variant={isActive ? "filled" : "outlined"}
                            sx={{
                              my: 0,
                              boxShadow: isActive ? 2 : 0,
                              zIndex: 1,
                              width: 20,
                              height: 20,
                              minWidth: 20,
                              minHeight: 20,
                              padding: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {isActive && (
                              <CheckCircleIcon sx={{ fontSize: 14 }} />
                            )}
                          </TimelineDot>
                          <TimelineConnector 
                            sx={{ 
                              visibility: isLast ? "hidden" : "visible",
                            }} 
                          />
                        </TimelineSeparator>

                        {/* Medication card - centered vertically */}
                        <TimelineContent
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            py: 0,
                            my: 1,
                          }}
                        >
                          <Paper
                            elevation={0}
                            sx={{
                              width: "100%",
                              p: 2,
                              borderRadius: 2,
                              backgroundColor: isActive ? "#e8f5e9" : "#ffffff",
                              border: "1px solid",
                              borderColor: isActive ? "#a5d6a7" : "#e0e0e0",
                              transition: "all 0.2s ease-in-out",
                              "&:hover": {
                                boxShadow: 2,
                                borderColor: isActive ? "#81c784" : "#bdbdbd",
                              },
                            }}
                          >
                            {/* Medication name with active badge */}
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                              <Typography 
                                variant="h6" 
                                component="span"
                                sx={{ 
                                  fontWeight: isActive ? 700 : 500,
                                  color: isActive ? "text.primary" : "text.secondary",
                                  fontSize: "1.1rem",
                                }}
                              >
                                {m.name}
                              </Typography>
                              {isActive && (
                                <Chip
                                  icon={<CheckCircleIcon />}
                                  label="ACTIVE"
                                  color="success"
                                  size="small"
                                  sx={{ fontWeight: 600 }}
                                />
                              )}
                              {isFuture && (
                                <Chip
                                  label="SCHEDULED"
                                  color="info"
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Box>

                            {/* Relationship cues */}
                            {((!validRange) || (prev && (rel.isConflict || rel.overlap || rel.gapDays > 0 || rel.doseChanged || rel.facilityChanged || rel.routeChanged))) && (
                              <Stack
                                direction="row"
                                spacing={0.5}
                                sx={{ mt: 1.5, flexWrap: "wrap", gap: 0.5 }}
                              >
                                {/* Invalid date range warning */}
                                {!validRange && (
                                  <Chip
                                    label="INVALID DATE RANGE"
                                    color="error"
                                    size="small"
                                    sx={{ fontWeight: 500 }}
                                  />
                                )}

                                {/* CONFLICT: overlapping + contradictory data */}
                                {prev && rel.isConflict && (
                                  <Chip
                                    label="CONFLICT"
                                    color="error"
                                    size="small"
                                    sx={{ fontWeight: 500 }}
                                  />
                                )}

                                {/* Overlap (only when no conflict) */}
                                {prev && !rel.isConflict && rel.overlap && (
                                  <Chip
                                    label="OVERLAP"
                                    color="warning"
                                    size="small"
                                  />
                                )}

                                {/* Gap */}
                                {prev && rel.gapDays > 0 && (
                                  <Chip
                                    label={`GAP: ${rel.gapDays} day(s)`}
                                    color="info"
                                    size="small"
                                  />
                                )}

                                {/* Changes */}
                                {prev && rel.doseChanged && (
                                  <Chip 
                                    label="DOSE CHANGE" 
                                    color="secondary" 
                                    size="small" 
                                  />
                                )}
                                {prev && rel.facilityChanged && (
                                  <Chip
                                    label="FACILITY CHANGE"
                                    color="secondary"
                                    size="small"
                                  />
                                )}
                                {prev && rel.routeChanged && (
                                  <Chip
                                    label="ROUTE CHANGE"
                                    color="secondary"
                                    size="small"
                                  />
                                )}
                              </Stack>
                            )}

                            {/* Medication details */}
                            <Stack
                              direction="row"
                              spacing={0.5}
                              sx={{ mt: 1.5, flexWrap: "wrap", gap: 0.5 }}
                            >
                              <Chip 
                                label={`Dose: ${m.dose}`} 
                                size="small" 
                                variant="outlined"
                                sx={{ backgroundColor: "background.paper" }}
                              />
                              <Chip 
                                label={`Route: ${m.route}`} 
                                size="small" 
                                variant="outlined"
                                sx={{ backgroundColor: "background.paper" }}
                              />
                              <Chip 
                                label={`Facility: ${m.facility}`} 
                                size="small" 
                                variant="outlined"
                                sx={{ backgroundColor: "background.paper" }}
                              />
                            </Stack>
                          </Paper>
                        </TimelineContent>
                      </TimelineItem>
                    </Fade>
                  );
                })}
              </Timeline>
            </Paper>
          )}
        </>
      )}
      </Container>
    </Box>
  );
}

export default App;