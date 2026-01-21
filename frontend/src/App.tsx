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

function formatRange(start: string, end: string | null) {
  return `${start} → ${end ?? "ongoing"}`;
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
    return [...data].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id);
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
            {sorted.map((m, idx) => (
              <TimelineItem key={m.id}>
                <TimelineOppositeContent style={{ flex: 0.25 }}>
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

                  <Stack direction="row" spacing={1} style={{ marginTop: 8, flexWrap: "wrap" }}>
                    <Chip label={`Dose: ${m.dose}`} size="small" />
                    <Chip label={`Route: ${m.route}`} size="small" />
                    <Chip label={`Facility: ${m.facility}`} size="small" />
                  </Stack>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        </Paper>
      )}
    </Container>
  );
}

export default App;
