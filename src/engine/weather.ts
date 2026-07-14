/**
 * Evolved — blast-day weather gating.
 *
 * Same verdict thresholds as the production morning digest (Open-Meteo,
 * Edmonton). Live mode calls the free Open-Meteo API; offline mode generates
 * a deterministic synthetic forecast so the demo needs no network.
 */

export interface DayForecast {
  date: string;
  tmaxC: number;
  windKmh: number;
  precipPct: number;
  verdict: "Good blast day" | "Marginal" | "No-go";
}

export function verdictFor(tmaxC: number, windKmh: number, precipPct: number): DayForecast["verdict"] {
  if (precipPct >= 50 || windKmh > 40 || tmaxC < 3) return "No-go";
  if (precipPct >= 35 || windKmh > 28 || tmaxC < 8) return "Marginal";
  return "Good blast day";
}

function syntheticForecast(days: number): DayForecast[] {
  // Deterministic pseudo-forecast keyed off the date, so demos are repeatable.
  const out: DayForecast[] = [];
  const start = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const seed = d.getDate() * 7 + d.getMonth() * 3;
    const tmaxC = 14 + ((seed * 13) % 14); // 14–27°C summer band
    const windKmh = 8 + ((seed * 17) % 38); // 8–45 km/h
    const precipPct = (seed * 23) % 70; // 0–69%
    out.push({
      date: d.toISOString().slice(0, 10),
      tmaxC,
      windKmh,
      precipPct,
      verdict: verdictFor(tmaxC, windKmh, precipPct),
    });
  }
  return out;
}

export async function getForecast(days = 5): Promise<{ source: string; days: DayForecast[] }> {
  if (process.env.EVOLVED_LIVE_WEATHER === "1") {
    try {
      const res = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=53.55&longitude=-113.49&daily=temperature_2m_max,precipitation_probability_max,wind_speed_10m_max&forecast_days=" +
          days +
          "&timezone=America%2FEdmonton",
      );
      if (res.ok) {
        const j = (await res.json()) as {
          daily: {
            time: string[];
            temperature_2m_max: number[];
            precipitation_probability_max: number[];
            wind_speed_10m_max: number[];
          };
        };
        return {
          source: "open-meteo (live)",
          days: j.daily.time.map((date, i) => {
            const tmaxC = j.daily.temperature_2m_max[i];
            const windKmh = j.daily.wind_speed_10m_max[i];
            const precipPct = j.daily.precipitation_probability_max[i];
            return { date, tmaxC, windKmh, precipPct, verdict: verdictFor(tmaxC, windKmh, precipPct) };
          }),
        };
      }
    } catch {
      // fall through to synthetic
    }
  }
  return { source: "synthetic (offline demo)", days: syntheticForecast(days) };
}
