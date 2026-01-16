import type { DataFrame } from "danfojs";

import { Card, CardBody, Chip, Tooltip } from "@heroui/react";
import * as d3 from "d3";
import { regressionPoly } from "d3-regression";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface RatingOverTimeChartProps {
  className?: string;
  df?: DataFrame;
  selectedGenres?: string[];
}

interface HoveredPoint {
  avgRating: number;
  genres: string;
  title: string;
  x: number;
  y: number;
  year: number;
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
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);

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

  const handleMouseMove = useCallback(
    (
      event: MouseEvent,
      xScale: d3.ScaleLinear<number, number>,
      yScale: d3.ScaleLinear<number, number>,
      margin: { bottom: number; left: number; right: number; top: number },
    ) => {
      const container = containerRef.current;
      if (!container) return;

      const bbox = container.getBoundingClientRect();
      const mouseX = event.clientX - bbox.left - margin.left;
      const mouseY = event.clientY - bbox.top - margin.top;

      // Find closest point
      let closestIdx = -1;
      let closestDist = Infinity;

      for (let i = 0; i < years.length; i++) {
        const px = xScale(years[i]);
        const py = yScale(avgRatings[i]);
        const dist = Math.hypot(mouseX - px, mouseY - py);

        if (dist < closestDist && dist < 30) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      if (closestIdx >= 0) {
        setHoveredPoint({
          avgRating: avgRatings[closestIdx],
          genres: genres[closestIdx],
          title: titles[closestIdx],
          x: event.clientX - bbox.left + 15,
          y: event.clientY - bbox.top - 10,
          year: years[closestIdx],
        });
      } else {
        setHoveredPoint(null);
      }
    },
    [years, avgRatings, titles, genres],
  );

  useEffect(() => {
    const { height, width } = dimensions;
    if (!svgRef.current || !gRef.current || width === 0 || height === 0) return;
    if (years.length === 0) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    g.selectAll("*").remove();
    svg.selectAll("defs").remove();

    const margin = { bottom: 50, left: 60, right: 30, top: 30 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const chartG = g
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Use nice rounded domains for better scale
    const xExtent = d3.extent(years) as [number, number];
    const yMin = Math.floor((d3.min(avgRatings) ?? 0) * 2) / 2;
    const yMax = Math.ceil((d3.max(avgRatings) ?? 10) * 2) / 2;

    const xScale = d3
      .scaleLinear()
      .domain(xExtent)
      .range([0, innerWidth])
      .nice();

    const yScale = d3
      .scaleLinear()
      .domain([Math.max(0, yMin - 0.5), Math.min(10, yMax + 0.5)])
      .range([innerHeight, 0])
      .nice();

    // Grid lines
    chartG
      .append("g")
      .attr("class", "grid")
      .selectAll("line")
      .data(yScale.ticks(8))
      .join("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d))
      .attr("stroke", "rgba(255,255,255,0.06)")
      .attr("stroke-dasharray", "2,4");

    chartG
      .append("g")
      .attr("class", "grid")
      .selectAll("line")
      .data(xScale.ticks(10))
      .join("line")
      .attr("x1", (d) => xScale(d))
      .attr("x2", (d) => xScale(d))
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("stroke", "rgba(255,255,255,0.04)")
      .attr("stroke-dasharray", "2,4");

    // Axes
    const xAxis = d3
      .axisBottom(xScale)
      .tickFormat(d3.format("d"))
      .ticks(Math.min(10, innerWidth / 80));

    const yAxis = d3.axisLeft(yScale).ticks(8);

    chartG
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .call((sel) => {
        sel.select(".domain").attr("stroke", "rgba(255,255,255,0.2)");
        sel.selectAll(".tick line").attr("stroke", "rgba(255,255,255,0.2)");
        sel.selectAll(".tick text").attr("fill", "rgba(255,255,255,0.6)");
      });

    chartG
      .append("text")
      .attr("fill", "rgba(255,255,255,0.7)")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 40)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .text("Release Year");

    chartG
      .append("g")
      .call(yAxis)
      .call((sel) => {
        sel.select(".domain").attr("stroke", "rgba(255,255,255,0.2)");
        sel.selectAll(".tick line").attr("stroke", "rgba(255,255,255,0.2)");
        sel.selectAll(".tick text").attr("fill", "rgba(255,255,255,0.6)");
      });

    chartG
      .append("text")
      .attr("fill", "rgba(255,255,255,0.7)")
      .attr("transform", "rotate(-90)")
      .attr("y", -45)
      .attr("x", -innerHeight / 2)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .text("Average Rating");

    // Create index array for data binding
    const indices = d3.range(years.length);
    const pointColor = "#c800ffff";

    chartG
      .selectAll("circle")
      .data(indices)
      .join("circle")
      .attr("cx", (i) => xScale(years[i]))
      .attr("cy", (i) => yScale(avgRatings[i]))
      .attr("r", 3)
      .attr("fill", pointColor)
      .attr("fill-opacity", 0.2)
      .attr("stroke", pointColor)
      .attr("stroke-opacity", 0.3)
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mouseenter", function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("r", 8)
          .attr("fill-opacity", 0.9)
          .attr("stroke-width", 2);
      })
      .on("mouseleave", function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("r", 4)
          .attr("fill-opacity", 0.5)
          .attr("stroke-width", 1);
      });

    // Build data array for regression
    const regressionData = indices.map((i) => ({
      avgRating: avgRatings[i],
      year: years[i],
    }));

    const regression = regressionPoly()
      .x((d: { avgRating: number; year: number }) => d.year)
      .y((d: { avgRating: number; year: number }) => d.avgRating)
      .order(4);

    const regressionResult = regression(regressionData);

    // Draw trend line
    const line = d3
      .line()
      .x((d) => xScale(d[0]))
      .y((d) => yScale(d[1]))
      .curve(d3.curveCatmullRom);

    // Add glow effect for trend line
    const defs = svg.append("defs");
    const glowFilter = defs.append("filter").attr("id", "trend-glow");
    glowFilter
      .append("feGaussianBlur")
      .attr("stdDeviation", "2")
      .attr("result", "coloredBlur");
    const feMerge = glowFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    chartG
      .append("path")
      .datum(regressionResult)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "#f472b6")
      .attr("stroke-width", 3)
      .attr("stroke-linecap", "round")
      .attr("filter", "url(#trend-glow)")
      .attr("opacity", 0.9);

    // Add interaction overlay for mouse tracking
    chartG
      .append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("mousemove", (event: MouseEvent) => {
        handleMouseMove(event, xScale, yScale, margin);
      })
      .on("mouseleave", () => {
        setHoveredPoint(null);
      });
  }, [avgRatings, genres, titles, years, dimensions, handleMouseMove]);

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

      {/* Hover Tooltip */}
      {hoveredPoint && (
        <Card
          className="pointer-events-none absolute z-40 bg-black/80 backdrop-blur-md border-white/10 max-w-xs"
          style={{
            left: Math.min(hoveredPoint.x, dimensions.width - 200),
            top: Math.min(hoveredPoint.y, dimensions.height - 120),
          }}
        >
          <CardBody className="p-3">
            <p className="font-semibold text-sm text-white truncate">
              {hoveredPoint.title}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Chip color="secondary" size="sm" variant="flat">
                {hoveredPoint.year}
              </Chip>
              <Chip color="warning" size="sm" variant="flat">
                ★ {hoveredPoint.avgRating.toFixed(1)}
              </Chip>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              {hoveredPoint.genres.replace(/,/g, " • ")}
            </p>
          </CardBody>
        </Card>
      )}

      {/* Legend Card */}
      <Card className="pointer-events-none absolute top-4 right-4 bg-black/40 backdrop-blur-md border-white/10">
        <CardBody className="p-4">
          <div className="flex flex-col gap-3 text-xs">
            {selectedGenres.length > 0 && (
              <div className="pb-3 border-b border-white/10">
                <div className="text-[10px] text-gray-400 mb-2">
                  Filtered by:
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedGenres.map((genre) => (
                    <Chip
                      color="secondary"
                      key={genre}
                      size="sm"
                      variant="flat"
                    >
                      {genre}
                    </Chip>
                  ))}
                </div>
                <div className="text-[10px] text-gray-500 mt-2">
                  {years.length.toLocaleString()} movies
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Tooltip
                content="Each dot represents a movie's average rating"
                placement="left"
              >
                <div className="flex items-center gap-2 cursor-help">
                  <span className="inline-block w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
                  <span className="text-gray-300">Movie rating</span>
                </div>
              </Tooltip>
              <Tooltip
                content="Polynomial regression showing the overall trend"
                placement="left"
              >
                <div className="flex items-center gap-2 cursor-help">
                  <span aria-hidden className="w-6 h-0.5 rounded bg-pink-400" />
                  <span className="text-gray-300">Trend line</span>
                </div>
              </Tooltip>
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
            <div className="flex flex-wrap gap-1 justify-center mt-3">
              {selectedGenres.map((genre) => (
                <Chip color="secondary" key={genre} size="sm" variant="flat">
                  {genre}
                </Chip>
              ))}
            </div>
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
