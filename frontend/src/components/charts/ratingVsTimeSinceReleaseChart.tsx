import type { DataFrame } from "danfojs";

import { Card, CardBody, Chip, Tooltip } from "@heroui/react";
import * as d3 from "d3";
import { regressionPoly } from "d3-regression";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { HelpTooltip } from "../HelpTooltip";

export interface RatingVsTimeSinceReleaseChartProps {
  className?: string;
  ratingsDf?: DataFrame;
  selectedGenres?: string[];
  titlesDf?: DataFrame;
}

interface AggregatedPoint {
  avgRating: number;
  count: number;
  yearsSinceRelease: number;
}

interface HoveredPoint {
  avgRating: number;
  count: number;
  x: number;
  y: number;
  yearsSinceRelease: number;
}

export function RatingVsTimeSinceReleaseChart({
  className,
  ratingsDf,
  selectedGenres = [],
  titlesDf,
}: RatingVsTimeSinceReleaseChartProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<null | SVGSVGElement>(null);
  const gRef = useRef<null | SVGGElement>(null);
  const [dimensions, setDimensions] = useState({ height: 0, width: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);

  // Pre-compute title data (only depends on titlesDf)
  const titleData = useMemo(() => {
    if (!titlesDf) return null;

    const titleIds = titlesDf.column("id").values as number[];
    const titleYears = titlesDf.column("year").values as number[];
    const titleGenres = titlesDf.column("genres").values as string[];

    // Build map: id -> { year, genreSet }
    const titleMap = new Map<number, { genreSet: Set<string>; year: number }>();
    for (let i = 0; i < titleIds.length; i++) {
      titleMap.set(titleIds[i], {
        genreSet: new Set(titleGenres[i].split(",")),
        year: titleYears[i],
      });
    }

    return titleMap;
  }, [titlesDf]);

  // Pre-compute rating data with years since release (only depends on ratingsDf and titleData)
  const ratingData = useMemo(() => {
    if (!ratingsDf || !titleData) return null;

    const ratingImdbIds = ratingsDf.column("imdbId").values as number[];
    const ratingDates = ratingsDf.column("date").values as unknown[];
    const ratingValues = ratingsDf.column("rating").values as number[];

    // Pre-compute: array of { imdbId, yearsSinceRelease, rating }
    const result: {
      imdbId: number;
      rating: number;
      yearsSinceRelease: number;
    }[] = [];

    for (let i = 0; i < ratingImdbIds.length; i++) {
      const titleInfo = titleData.get(ratingImdbIds[i]);
      if (!titleInfo) continue;

      // Extract year from date (handles different formats: Date object, string, or days since epoch)
      let ratingYear: number;
      const dateVal = ratingDates[i];
      if (dateVal instanceof Date) {
        ratingYear = dateVal.getFullYear();
      } else if (typeof dateVal === "string") {
        ratingYear = parseInt(dateVal.substring(0, 4), 10);
      } else if (typeof dateVal === "number") {
        // Days since Unix epoch (1970-01-01)
        const date = new Date(dateVal * 24 * 60 * 60 * 1000);
        ratingYear = date.getFullYear();
      } else {
        continue; // Skip invalid dates
      }

      const yearsSinceRelease = ratingYear - titleInfo.year;

      if (yearsSinceRelease >= 0) {
        result.push({
          imdbId: ratingImdbIds[i],
          rating: ratingValues[i] / 10, // Convert to 0-10 scale
          yearsSinceRelease,
        });
      }
    }

    return result;
  }, [ratingsDf, titleData]);

  // Calculate aggregated data filtered by selected genres (fast operation)
  const aggregatedData = useMemo(() => {
    if (!ratingData || !titleData) return [];

    const selectedGenreSet =
      selectedGenres.length > 0 ? new Set(selectedGenres) : null;

    // Aggregate by years since release
    const aggregation = new Map<
      number,
      { count: number; totalRating: number }
    >();

    for (const { imdbId, rating, yearsSinceRelease } of ratingData) {
      // Filter by selected genres if any
      if (selectedGenreSet) {
        const titleInfo = titleData.get(imdbId);
        if (!titleInfo) continue;
        // Check if title has ALL selected genres
        let hasAllGenres = true;
        for (const g of selectedGenreSet) {
          if (!titleInfo.genreSet.has(g)) {
            hasAllGenres = false;
            break;
          }
        }
        if (!hasAllGenres) continue;
      }

      const agg = aggregation.get(yearsSinceRelease);
      if (agg) {
        agg.totalRating += rating;
        agg.count += 1;
      } else {
        aggregation.set(yearsSinceRelease, { count: 1, totalRating: rating });
      }
    }

    // Convert to array of points
    const points: AggregatedPoint[] = [];
    for (const [yearsSinceRelease, agg] of aggregation.entries()) {
      if (agg.count >= 10) {
        points.push({
          avgRating: agg.totalRating / agg.count,
          count: agg.count,
          yearsSinceRelease,
        });
      }
    }

    points.sort((a, b) => a.yearsSinceRelease - b.yearsSinceRelease);
    return points;
  }, [ratingData, titleData, selectedGenres]);

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

      for (let i = 0; i < aggregatedData.length; i++) {
        const px = xScale(aggregatedData[i].yearsSinceRelease);
        const py = yScale(aggregatedData[i].avgRating);
        const dist = Math.hypot(mouseX - px, mouseY - py);

        if (dist < closestDist && dist < 30) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      if (closestIdx >= 0) {
        setHoveredPoint({
          avgRating: aggregatedData[closestIdx].avgRating,
          count: aggregatedData[closestIdx].count,
          x: event.clientX - bbox.left + 15,
          y: event.clientY - bbox.top - 10,
          yearsSinceRelease: aggregatedData[closestIdx].yearsSinceRelease,
        });
      } else {
        setHoveredPoint(null);
      }
    },
    [aggregatedData],
  );

  useEffect(() => {
    const { height, width } = dimensions;
    if (!svgRef.current || !gRef.current || width === 0 || height === 0) return;
    if (aggregatedData.length === 0) return;

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

    // Calculate domains
    const xExtent = d3.extent(aggregatedData, (d) => d.yearsSinceRelease) as [
      number,
      number,
    ];
    const yMin =
      Math.floor((d3.min(aggregatedData, (d) => d.avgRating) ?? 0) * 2) / 2;
    const yMax =
      Math.ceil((d3.max(aggregatedData, (d) => d.avgRating) ?? 10) * 2) / 2;

    const xScale = d3
      .scaleLinear()
      .domain([0, xExtent[1]])
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
      .tickFormat((d) => `${d.valueOf()}y`)
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
      .text("Years Since Release");

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

    // Scale point size by count (log scale for better distribution)
    const countExtent = d3.extent(aggregatedData, (d) => d.count) as [
      number,
      number,
    ];
    const sizeScale = d3.scaleSqrt().domain(countExtent).range([3, 12]);

    const pointColor = "#06b6d4"; // Cyan color to differentiate from other chart

    chartG
      .selectAll("circle")
      .data(aggregatedData)
      .join("circle")
      .attr("cx", (d) => xScale(d.yearsSinceRelease))
      .attr("cy", (d) => yScale(d.avgRating))
      .attr("r", (d) => sizeScale(d.count))
      .attr("fill", pointColor)
      .attr("fill-opacity", 0.6)
      .attr("stroke", pointColor)
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseenter", function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("fill-opacity", 0.9)
          .attr("stroke-width", 2);
      })
      .on("mouseleave", function (_, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("r", sizeScale(d.count))
          .attr("fill-opacity", 0.6)
          .attr("stroke-width", 1);
      });

    // Build data array for regression
    const regressionData = aggregatedData.map((d) => ({
      avgRating: d.avgRating,
      yearsSinceRelease: d.yearsSinceRelease,
    }));

    const regression = regressionPoly()
      .x(
        (d: { avgRating: number; yearsSinceRelease: number }) =>
          d.yearsSinceRelease,
      )
      .y((d: { avgRating: number; yearsSinceRelease: number }) => d.avgRating)
      .order(3);

    const regressionResult = regression(regressionData);

    // Draw trend line
    const line = d3
      .line()
      .x((d) => xScale(d[0]))
      .y((d) => yScale(d[1]))
      .curve(d3.curveCatmullRom);

    // Add glow effect for trend line
    const defs = svg.append("defs");
    const glowFilter = defs.append("filter").attr("id", "trend-glow-time");
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
      .attr("stroke", "#22d3ee")
      .attr("stroke-width", 3)
      .attr("stroke-linecap", "round")
      .attr("filter", "url(#trend-glow-time)")
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
  }, [aggregatedData, dimensions, handleMouseMove]);

  const totalRatings = useMemo(
    () => aggregatedData.reduce((sum, d) => sum + d.count, 0),
    [aggregatedData],
  );

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
        aria-label="Rating vs Time Since Release Scatter Plot"
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
            <p className="font-semibold text-sm text-white">
              {hoveredPoint.yearsSinceRelease === 0
                ? "Release Year"
                : hoveredPoint.yearsSinceRelease === 1
                  ? "1 year after release"
                  : `${hoveredPoint.yearsSinceRelease} years after release`}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Chip color="primary" size="sm" variant="flat">
                ★ {hoveredPoint.avgRating.toFixed(2)}
              </Chip>
              <Chip color="default" size="sm" variant="flat">
                {hoveredPoint.count.toLocaleString()} ratings
              </Chip>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Legend Card with Help */}
      <div className="absolute top-4 right-4 flex items-start gap-2">
        <HelpTooltip
          description="Each dot represents the average rating given at a specific number of years after a movie's release. Larger dots indicate more ratings. This shows if ratings change over time."
          interactions={[
            { icon: "👆", text: "Hover points for details" },
            { icon: "🎭", text: "Select genres in the network to filter" },
            { icon: "⚪", text: "Dot size = number of ratings" },
          ]}
          title="Rating vs Time Since Release"
        />
        <Card className="pointer-events-none bg-black/40 backdrop-blur-md border-white/10">
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
                    {totalRatings.toLocaleString()} ratings
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Tooltip
                  content="Each dot shows average rating at years after release"
                  placement="left"
                >
                  <div className="flex items-center gap-2 cursor-help">
                    <span className="inline-block w-3 h-3 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500" />
                    <span className="text-gray-300">Avg rating by time</span>
                  </div>
                </Tooltip>
                <Tooltip
                  content="Polynomial regression showing the overall trend"
                  placement="left"
                >
                  <div className="flex items-center gap-2 cursor-help">
                    <span
                      aria-hidden
                      className="w-6 h-0.5 rounded bg-cyan-400"
                    />
                    <span className="text-gray-300">Trend line</span>
                  </div>
                </Tooltip>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {aggregatedData.length === 0 && selectedGenres.length > 0 && (
        <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-md border-white/10">
          <CardBody className="p-8 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-sm text-gray-400">
              No rating data found for selected genres:
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

      {aggregatedData.length === 0 && selectedGenres.length === 0 && (
        <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-md border-white/10">
          <CardBody className="p-8 text-center">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-sm text-gray-400">
              No rating data available to visualize
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
