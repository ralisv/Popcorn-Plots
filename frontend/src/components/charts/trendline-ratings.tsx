import * as d3 from "d3";
import React, { useMemo } from "react";
import { getMovies } from "../../data/data";

export interface TrendlineChartProps {
  className?: string;
  height?: number;
  /** list of genre ids to include; defaults to Drama and Horror */
  selectedGenres?: string[];
  width?: number;
}

/**
 * Scatter plot with trendlines showing average movie rating per year for selected genres.
 * Defaults to Drama and Horror when no selection is provided.
 */
export function TrendlineChart({
  className,
  height = 500,
  selectedGenres,
  width = 700,
}: TrendlineChartProps): React.ReactElement {
  const movies = useMemo(() => getMovies(), []);

  const genres = selectedGenres ?? ["Drama", "Horror"];

  // Aggregate: genre -> year -> {sum,count}
  const aggregated = useMemo(() => {
    const map = new Map<string, Map<number, { count: number; sum: number }>>();

    movies.forEach((movie) => {
      const year = movie.startYear;
      if (!year) return;

      // compute movie average rating
      const reviews = movie.reviews;
      if (reviews.length === 0) return;
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

      movie.genres.forEach((g) => {
        if (!genres.includes(g)) return; // only collect for selected genres
        if (!map.has(g)) map.set(g, new Map());
        const ym = map.get(g);
        if (!ym.has(year)) ym.set(year, { count: 0, sum: 0 });
        const cur = ym.get(year);
        cur.sum += avg;
        cur.count += 1;
      });
    });

    // Convert to structure genre -> [{year, avg}]
    const result = new Map<string, { avg: number; year: number }[]>();
    let minYear = Infinity;
    let maxYear = -Infinity;

    map.forEach((yearMap, g) => {
      const arr: { avg: number; year: number }[] = [];
      yearMap.forEach((v, y) => {
        arr.push({ avg: v.sum / v.count, year: y });
        minYear = Math.min(minYear, y);
        maxYear = Math.max(maxYear, y);
      });
      arr.sort((a, b) => a.year - b.year);
      result.set(g, arr);
    });

    return {
      maxYear: isFinite(maxYear) ? maxYear : undefined,
      minYear: isFinite(minYear) ? minYear : undefined,
      result,
    };
  }, [movies, genres]);

  // Scales
  const margin = { bottom: 40, left: 36, right: 12, top: 20 };
  const innerW = Math.max(200, width - margin.left - margin.right);
  const innerH = Math.max(100, height - margin.top - margin.bottom);

  const x = d3
    .scaleLinear()
    .domain([aggregated.minYear ?? 0, aggregated.maxYear ?? 1])
    .range([0, innerW]);

  const y = d3.scaleLinear().domain([0, 5]).range([innerH, 0]);

  const color = d3
    .scaleOrdinal<string>()
    .domain(genres)
    .range(d3.schemeCategory10);

  return (
    <div className={["w-full", "overflow-x-auto", className ?? ""].join(" ")}>
      <svg aria-label="Genre rating over time" height={height} width={width}>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Trendlines: connect per-year averages with a smooth curve */}
          {genres.map((g) => {
            const series = aggregated.result.get(g) ?? [];
            if (series.length < 2) return null;

            const lineGenerator = d3
              .line<{ avg: number; year: number }>()
              .x((d) => x(d.year))
              .y((d) => y(d.avg))
              .curve(d3.curveMonotoneX);

            const dPath = lineGenerator(series) ?? "";

            return (
              <path
                d={dPath}
                fill="none"
                key={`trend-${g}`}
                opacity={0.95}
                stroke={color(g)}
                strokeWidth={2}
              />
            );
          })}

          {/* Data points */}
          {genres.map((g) => {
            const series = aggregated.result.get(g) ?? [];
            return series.map((point) => (
              <circle
                cx={x(point.year)}
                cy={y(point.avg)}
                fill={color(g)}
                key={`${g}-${point.year}`}
                opacity={0.85}
                r={4}
              >
                <title>
                  {g} ({point.year}): {point.avg.toFixed(2)}
                </title>
              </circle>
            ));
          })}

          {/* x axis */}
          {x.ticks(Math.min(10, innerW / 80)).map((t) => (
            <g key={`xt-${t}`} transform={`translate(${x(t)},0)`}>
              <line stroke="rgba(0,0,0,0.2)" y1={innerH} y2={innerH + 5} />
              <text
                fill="var(--color-foreground)"
                fontSize={10}
                textAnchor="middle"
                y={innerH + 18}
              >
                {t}
              </text>
            </g>
          ))}

          {/* y axis ticks */}
          {y.ticks(5).map((t) => (
            <g key={`yt-${t}`} transform={`translate(0,${y(t)})`}>
              <line stroke="rgba(0,0,0,0.06)" x1={0} x2={innerW} />
              <text
                fill="var(--color-foreground)"
                fontSize={10}
                textAnchor="end"
                x={-8}
                y={4}
              >
                {t.toFixed(1)}
              </text>
            </g>
          ))}

          {/* legend */}
          <g transform={`translate(${innerW - 10},0)`}>
            {genres.map((g, i) => (
              <g key={`leg-${g}`} transform={`translate(0,${i * 16})`}>
                <rect fill={color(g)} height={12} width={12} x={0} y={-10} />
                <text fill="var(--color-foreground)" fontSize={11} x={16} y={0}>
                  {g}
                </text>
              </g>
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}

// linearRegression removed: trendlines are now smoothed paths connecting per-year averages

export default TrendlineChart;
