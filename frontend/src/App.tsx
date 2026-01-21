import React, { useEffect, useMemo, useState } from "react";
import { fetchMedications, Medication } from "./api/medications";

import {
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Stack,
} from "@mui/material";

import Timeline from "@mui/lab/Timeline";
import TimelineItem from "@mui/lab/TimelineItem";
import TimelineSeparator from "@mui/lab/TimelineSeparator";
import TimelineConnector from "@mui/lab/TimelineConnector";
import TimelineContent from "@mui/lab/TimelineContent";
import TimelineDot from "@mui/lab/TimelineDot";
import TimelineOppositeContent from "@mui/lab/TimelineOppositeContent";

function toUtcMs(dateIso: string): number {
  // Avoid local timezone shifting the date
  return Date.parse(`${dateIso}T00:00:00Z`);
}

function daysBetween(startIso: string, endIso: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((toUtcMs(endIso) - toUtcMs(startIso)) / msPerDay);
}

function formatRange(start: string, end: string | null) {
  return `${start} → ${end ?? "ongoing"}`;
}

type Relation = {
  overlap: boolean;
  gapDays: number; // 0 if no gap
  doseChanged: boolean;
  facilityChanged: boolean;
};

function relationWithPrev(prev: Medication | null, curr: Medication): Relation {
  if (!prev) {
    return {
      overlap: false,
      gapDays: 0,
      doseChanged: false,
      facilityChanged: false,
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
      gapDays = daysBetween(prevEnd, curr.start_date);
    }
  }

  // Switch cues (only meaningful if it's the same medication name)
  const sameName = prev.name === curr.name;
  const doseChanged = sameName && prev.dose !== curr.dose;
  const facilityChanged = sameName && prev.facility !== curr.facility;

  return { overlap, gapDays, doseChanged, facilityChanged };
}

function App() {
  const [data, setData] = useState<Medication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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

  const sorted = useMemo(() => {
    return [...data].sort(
      (a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id
    );
  }, [data]);

  return (
    <Container maxWidth="md" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <Typography variant="h4" gutterBottom>
        Medication Timeline
      </Typography>

      {loading && (
        <Stack direction="row" alignItems="center" spacing={2}>
          <CircularProgress size={20} />
          <Typography>Loading medications…</Typography>
        </Stack>
      )}

      {error && <Alert severity="error">Error: {error}</Alert>}

      {!loading && !error && (
        <Paper variant="outlined" style={{ padding: 16 }}>
          <Timeline position="right">
            {sorted.map((m, idx) => {
              const prev =
                idx === 0
                  ? null
                  : [...sorted.slice(0, idx)]
                      .reverse()
                      .find((x) => x.name === m.name) ?? null;

              const rel = relationWithPrev(prev, m);

              return (
                <TimelineItem key={m.id}>
                  <TimelineOppositeContent style={{ flex: 0.28 }}>
                    <Typography variant="body2" color="textSecondary">
                      {formatRange(m.start_date, m.end_date)}
                    </Typography>
                  </TimelineOppositeContent>

                  <TimelineSeparator>
                    <TimelineDot />
                    {idx !== sorted.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>

                  <TimelineContent>
                    <Typography variant="h6" component="span">
                      {m.name}
                    </Typography>

                    {/* Relationship cues vs previous record (same medication only) */}
                    <Stack
                      direction="row"
                      spacing={1}
                      style={{ marginTop: 8, flexWrap: "wrap" }}
                    >
                      {prev && rel.overlap && (
                        <Chip
                          label="OVERLAP with previous"
                          color="warning"
                          size="small"
                        />
                      )}
                      {prev && rel.gapDays > 0 && (
                        <Chip
                          label={`GAP: ${rel.gapDays} day(s)`}
                          color="info"
                          size="small"
                        />
                      )}
                      {prev && rel.doseChanged && (
                        <Chip label="DOSE CHANGE" color="secondary" size="small" />
                      )}
                      {prev && rel.facilityChanged && (
                        <Chip
                          label="FACILITY CHANGE"
                          color="secondary"
                          size="small"
                        />
                      )}
                    </Stack>

                    {/* Medication details */}
                    <Stack
                      direction="row"
                      spacing={1}
                      style={{ marginTop: 10, flexWrap: "wrap" }}
                    >
                      <Chip label={`Dose: ${m.dose}`} size="small" />
                      <Chip label={`Route: ${m.route}`} size="small" />
                      <Chip label={`Facility: ${m.facility}`} size="small" />
                    </Stack>
                  </TimelineContent>
                </TimelineItem>
              );
            })}
          </Timeline>
        </Paper>
      )}
    </Container>
  );
}

export default App;
