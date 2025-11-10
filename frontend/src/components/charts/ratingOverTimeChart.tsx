import { Card, CardBody } from "@heroui/react";
import * as d3 from "d3";
// @ts-expect-error: no types for d3-regression
import { regressionPoly } from "d3-regression";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Movie } from "../../data/types";

export interface RatingOverTimeChartProps {
  className?: string;
  movies?: Movie[];
  selectedGenres?: string[];
}

export function RatingOverTimeChart({
  className,
  movies,
  selectedGenres = [],
}: RatingOverTimeChartProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<null | SVGSVGElement>(null);
  const gRef = useRef<null | SVGGElement>(null);
  const [dimensions, setDimensions] = useState({ height: 0, width: 0 });

  const data = useMemo(() => {
    let filteredMovies = movies ?? [];

    // Filter movies by selected genres (must have ALL selected genres)
    if (selectedGenres.length > 0) {
      filteredMovies = filteredMovies.filter((m) =>
        selectedGenres.every((genre) => m.genres.includes(genre)),
      );
    }

    return filteredMovies.map((m) => ({
      ...m,
      avgRating: d3.mean(m.reviews, (r) => r.rating) ?? 0,
    }));
  }, [movies, selectedGenres]);

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
    if (data.length === 0) return;

    const g = d3.select(gRef.current);

    g.selectAll("*").remove();

    const margin = { bottom: 40, left: 50, right: 30, top: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const chartG = g
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xExtent = d3.extent(data, (d) => d.startYear);
    const yExtent = d3.extent(data, (d) => d.avgRating);

    const xScale = d3
      .scaleLinear()
      .domain([xExtent[0] ?? 0, xExtent[1] ?? 0])
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([yExtent[0] ?? 0, yExtent[1] ?? 0])
      .range([innerHeight, 0]);

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

    chartG
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", (d) => xScale(d.startYear))
      .attr("cy", (d) => yScale(d.avgRating))
      .attr("r", 3)
      .attr("fill", "pink")
      .attr("fill-opacity", 0.3)
      .append("title")
      .text(
        (d) =>
          `${d.title} (${d.startYear})\nAvg Rating: ${d.avgRating.toFixed(
            2,
          )}\nGenres: ${d.genres.join(", ")}`,
      );

    const regression = regressionPoly()
      .x((d: (typeof data)[0]) => d.startYear)
      .y((d: (typeof data)[0]) => d.avgRating)
      .order(5);

    const line = d3
      .line()
      .x((d) => xScale(d[0]))
      .y((d) => yScale(d[1]));

    chartG
      .append("path")
      .datum(regression(data))
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "red")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4");
  }, [data, dimensions]);

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

      <Card className="pointer-events-none absolute top-4 right-4">
        <CardBody className="p-3">
          <div className="flex flex-col text-xs">
            {selectedGenres.length > 0 && (
              <div className="mb-2 pb-2 border-b border-gray-700">
                <div className="text-[10px] opacity-70 mb-1">Filtered by:</div>
                <div className="font-semibold text-primary">
                  {selectedGenres.join(" + ")}
                </div>
                <div className="text-[10px] opacity-60 mt-1">
                  {data.length} movies
                </div>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <span className="inline-block w-3 h-3 rounded-full bg-blue-400" />
              <span>Avg. movie rating</span>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <span
                aria-hidden
                style={{
                  borderBottom: "2px dashed red",
                  display: "inline-block",
                  height: 0,
                  width: 40,
                }}
              />
              <span>Trend</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {data.length === 0 && selectedGenres.length > 0 && (
        <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <CardBody className="p-6 text-center">
            <p className="text-sm text-gray-500">
              No movies found with all selected genres:
              <br />
              <span className="font-semibold text-primary mt-2 inline-block">
                {selectedGenres.join(" + ")}
              </span>
            </p>
          </CardBody>
        </Card>
      )}

      {data.length === 0 && selectedGenres.length === 0 && (
        <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <CardBody className="p-6 text-center">
            <p className="text-sm text-gray-500">
              No movie data available to visualize
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
