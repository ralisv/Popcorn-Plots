import type { DataFrame } from "danfojs";

import { Card, CardBody } from "@heroui/react";
import * as d3 from "d3";
import { regressionPoly } from "d3-regression";
import { useEffect, useMemo, useRef, useState } from "react";

export interface RatingOverTimeChartProps {
  className?: string;
  df?: DataFrame;
  selectedGenres?: string[];
}

export function RatingOverTimeChart({
  className,
  df,
  selectedGenres = [],
}: RatingOverTimeChartProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<null | SVGSVGElement>(null);
  const gRef = useRef<null | SVGGElement>(null);
  const [dimensions, setDimensions] = useState({ height: 0, width: 0 });

  // Extract filtered data from DataFrame
  const { avgRatings, genres, titles, years } = useMemo(() => {
    if (!df) return { avgRatings: [], genres: [], titles: [], years: [] };

    const allGenres = df.column("genres").values as string[];
    const allYears = df.column("year").values as number[];
    const allRatings = df.column("avgRating").values as number[];
    const allTitles = df.column("title").values as string[];

    if (selectedGenres.length === 0) {
      return {
        avgRatings: allRatings,
        genres: allGenres,
        titles: allTitles,
        years: allYears,
      };
    }

    // Filter by selected genres
    const filteredYears: number[] = [];
    const filteredRatings: number[] = [];
    const filteredTitles: string[] = [];
    const filteredGenres: string[] = [];

    for (let i = 0; i < allGenres.length; i++) {
      const titleGenres = allGenres[i].split(",");
      if (selectedGenres.every((g) => titleGenres.includes(g))) {
        filteredYears.push(allYears[i]);
        filteredRatings.push(allRatings[i]);
        filteredTitles.push(allTitles[i]);
        filteredGenres.push(allGenres[i]);
      }
    }

    return {
      avgRatings: filteredRatings,
      genres: filteredGenres,
      titles: filteredTitles,
      years: filteredYears,
    };
  }, [df, selectedGenres]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0) return;
      const { height, width } = entries[0].contentRect;
      setDimensions({ height, width });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const { height, width } = dimensions;
    if (!svgRef.current || !gRef.current || width === 0 || height === 0) return;
    if (years.length === 0) return;

    const g = d3.select(gRef.current);

    g.selectAll("*").remove();

    const margin = { bottom: 40, left: 50, right: 30, top: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const chartG = g
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xExtent = d3.extent(years) as [number, number];
    const yExtent = d3.extent(avgRatings) as [number, number];

    const xScale = d3.scaleLinear().domain(xExtent).range([0, innerWidth]);

    const yScale = d3.scaleLinear().domain(yExtent).range([innerHeight, 0]);

    const xAxis = d3.axisBottom(xScale).tickFormat(d3.format("d"));
    const yAxis = d3.axisLeft(yScale);

    chartG
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .append("text")
      .attr("fill", "var(--color-foreground)")
      .attr("x", innerWidth / 2)
      .attr("y", 35)
      .attr("text-anchor", "middle")
      .text("Year");

    chartG
      .append("g")
      .call(yAxis)
      .append("text")
      .attr("fill", "var(--color-foreground)")
      .attr("transform", "rotate(-90)")
      .attr("y", -35)
      .attr("x", -innerHeight / 2)
      .attr("text-anchor", "middle")
      .text("Average Rating");

    // Create index array for data binding
    const indices = d3.range(years.length);

    chartG
      .selectAll("circle")
      .data(indices)
      .join("circle")
      .attr("cx", (i) => xScale(years[i]))
      .attr("cy", (i) => yScale(avgRatings[i]))
      .attr("r", 3)
      .attr("fill", "pink")
      .attr("fill-opacity", 0.3)
      .append("title")
      .text(
        (i) =>
          `${titles[i]} (${years[i]})\nAvg Rating: ${avgRatings[i].toFixed(2)}\nGenres: ${genres[i].replace(/,/g, ", ")}`,
      );

    // Build data array for regression
    const regressionData = indices.map((i) => ({
      avgRating: avgRatings[i],
      year: years[i],
    }));

    const regression = regressionPoly()
      .x((d: { avgRating: number; year: number }) => d.year)
      .y((d: { avgRating: number; year: number }) => d.avgRating)
      .order(5);

    const line = d3
      .line()
      .x((d) => xScale(d[0]))
      .y((d) => yScale(d[1]));

    chartG
      .append("path")
      .datum(regression(regressionData))
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "red")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4");
  }, [avgRatings, genres, titles, years, dimensions]);

  return (
    <div
      className={[
        "relative",
        "w-full",
        "h-full",
        "overflow-hidden",
        className ?? "",
      ].join(" ")}
      ref={containerRef}
    >
      <svg
        aria-label="Rating Over Time Scatter Plot"
        className="w-full h-full"
        ref={svgRef}
        role="img"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      >
        <g ref={gRef} />
      </svg>

      <Card className="pointer-events-none absolute top-4 right-4 bg-black/40 backdrop-blur-md border-white/10">
        <CardBody className="p-4">
          <div className="flex flex-col text-xs">
            {selectedGenres.length > 0 && (
              <div className="mb-3 pb-3 border-b border-white/10">
                <div className="text-[10px] text-gray-400 mb-1">Filtered by:</div>
                <div className="font-semibold text-purple-300">
                  {selectedGenres.join(" + ")}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {years.length.toLocaleString()} movies
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-pink-400/80 shadow-sm shadow-pink-400/50" />
              <span className="text-gray-300">Movie rating</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                aria-hidden
                className="w-8"
                style={{
                  borderBottom: "2px dashed #ef4444",
                  display: "inline-block",
                  height: 0,
                }}
              />
              <span className="text-gray-300">Trend line</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {years.length === 0 && selectedGenres.length > 0 && (
        <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-md border-white/10">
          <CardBody className="p-8 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-sm text-gray-400">
              No movies found with all selected genres:
            </p>
            <p className="font-semibold text-purple-300 mt-3">
              {selectedGenres.join(" + ")}
            </p>
            <p className="text-xs text-gray-500 mt-3">
              Try selecting fewer genres
            </p>
          </CardBody>
        </Card>
      )}

      {years.length === 0 && selectedGenres.length === 0 && (
        <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-md border-white/10">
          <CardBody className="p-8 text-center">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-sm text-gray-400">
              No movie data available to visualize
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
