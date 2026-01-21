export type Medication = {
    id: number;
    name: string;
    dose: string;
    route: string;
    start_date: string; // ISO date string
    end_date: string | null; // null means ongoing
    facility: string;
  };
  
  const API_BASE = process.env.REACT_APP_API_BASE ?? "http://127.0.0.1:8000/api";
  
  export async function fetchMedications(): Promise<Medication[]> {
    const res = await fetch(`${API_BASE}/medications/`);
    if (!res.ok) {
      throw new Error(`Failed to fetch medications: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as Medication[];
  }
  