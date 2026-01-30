import type { DataFrame } from "danfojs";

import { Card, CardBody, Chip, Tooltip } from "@heroui/react";
import * as d3 from "d3";
import { regressionPoly } from "d3-regression";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { HelpTooltip } from "../HelpTooltip";
import { RangeSlider } from "../RangeSlider";

export interface RatingVsRuntimeChartProps {
  className?: string;
  df?: DataFrame;
  selectedGenres?: string[];
}

// KPI Panel types
export interface RuntimeKPIPanelProps {
  className?: string;
  df?: DataFrame;
  selectedGenres?: string[];
}

export interface RuntimeStats {
  avgRatingLong: number;
  avgRatingMedium: number;
  avgRatingShort: number;
  avgRuntime: number;
  longestRuntime: number;
  shortestRuntime: number;
  totalMovies: number;
}

interface HoveredPoint {
  avgRating: number;
  genres: string;
  runtime: number;
  title: string;
  x: number;
  y: number;
}

export function RatingVsRuntimeChart({
  className,
  df,
  selectedGenres = [],
}: RatingVsRuntimeChartProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<null | SVGSVGElement>(null);
  const gRef = useRef<null | SVGGElement>(null);
  const [dimensions, setDimensions] = useState({ height: 0, width: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);

  // X-axis range filter state
  const [xRangeMin, setXRangeMin] = useState<number>(60);
  const [xRangeMax, setXRangeMax] = useState<number>(180);

  // Zoom state
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomCenter, setZoomCenter] = useState<null | { x: number; y: number }>(
    null,
  );

  // Extract all filtered data from DataFrame (individual movies) - without x-range filter
  const allData = useMemo(() => {
    if (!df) return { avgRatings: [], genres: [], runtimes: [], titles: [] };

    const allGenres = df.column("genres").values as string[];
    const allRuntimes = df.column("runtimeMinutes").values as number[];
    const allRatings = df.column("avgRating").values as number[];
    const allTitles = df.column("title").values as string[];

    const filteredRuntimes: number[] = [];
    const filteredRatings: number[] = [];
    const filteredTitles: string[] = [];
    const filteredGenres: string[] = [];

    for (let i = 0; i < allGenres.length; i++) {
      const runtime = allRuntimes[i];
      // Skip invalid runtimes
      if (!runtime || runtime <= 0 || runtime > 600) continue;

      // Filter by selected genres if any
      if (selectedGenres.length > 0) {
        const titleGenres = allGenres[i].split(",");
        if (!selectedGenres.every((g) => titleGenres.includes(g))) continue;
      }

      filteredRuntimes.push(runtime);
      filteredRatings.push(allRatings[i]);
      filteredTitles.push(allTitles[i]);
      filteredGenres.push(allGenres[i]);
    }

    return {
      avgRatings: filteredRatings,
      genres: filteredGenres,
      runtimes: filteredRuntimes,
      titles: filteredTitles,
    };
  }, [df, selectedGenres]);

  // Calculate full x-axis extent from all data
  const xFullExtent = useMemo(() => {
    if (allData.runtimes.length === 0) return { max: 180, min: 60 };
    const extent = d3.extent(allData.runtimes) as [number, number];
    return { max: extent[1], min: extent[0] };
  }, [allData.runtimes]);

  // Apply x-range filter to get displayed data
  const { avgRatings, genres, runtimes, titles } = useMemo(() => {
    const filteredRuntimes: number[] = [];
    const filteredRatings: number[] = [];
    const filteredTitles: string[] = [];
    const filteredGenres: string[] = [];

    for (let i = 0; i < allData.runtimes.length; i++) {
      const runtime = allData.runtimes[i];
      if (runtime >= xRangeMin && runtime <= xRangeMax) {
        filteredRuntimes.push(runtime);
        filteredRatings.push(allData.avgRatings[i]);
        filteredTitles.push(allData.titles[i]);
        filteredGenres.push(allData.genres[i]);
      }
    }

    return {
      avgRatings: filteredRatings,
      genres: filteredGenres,
      runtimes: filteredRuntimes,
      titles: filteredTitles,
    };
  }, [allData, xRangeMin, xRangeMax]);

  // Handler for range slider changes
  const handleRangeChange = useCallback((min: number, max: number) => {
    setXRangeMin(min);
    setXRangeMax(max);
  }, []);

  // Generate seeded random jitter for each point (stable across re-renders)
  // Jitter within ±2 minutes to spread points horizontally
  const jitterValues = useMemo(() => {
    const jitterSeed = 54321;
    return runtimes.map((_, i) => {
      const x = Math.sin(jitterSeed + i * 9999) * 10000;
      return (x - Math.floor(x)) * 4 - 2; // Range: -2 to +2 minutes
    });
  }, [runtimes]);

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

      // Find closest point (using jittered x positions)
      let closestIdx = -1;
      let closestDist = Infinity;

      for (let i = 0; i < runtimes.length; i++) {
        const px = xScale(runtimes[i] + jitterValues[i]);
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
          runtime: runtimes[closestIdx],
          title: titles[closestIdx],
          x: event.clientX - bbox.left + 15,
          y: event.clientY - bbox.top - 10,
        });
      } else {
        setHoveredPoint(null);
      }
    },
    [runtimes, avgRatings, titles, genres, jitterValues],
  );

  useEffect(() => {
    const { height, width } = dimensions;
    if (!svgRef.current || !gRef.current || width === 0 || height === 0) return;
    if (runtimes.length === 0) return;

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
    const xExtent = d3.extent(runtimes) as [number, number];
    const yMin = Math.floor((d3.min(avgRatings) ?? 0) * 2) / 2;
    const yMax = Math.ceil((d3.max(avgRatings) ?? 10) * 2) / 2;

    // Calculate zoom domains
    let xDomain: [number, number] = [xExtent[0], xExtent[1]];
    let yDomain: [number, number] = [
      Math.max(0, yMin - 0.5),
      Math.min(10, yMax + 0.5),
    ];

    if (isZoomed && zoomCenter) {
      // Zoom to ~10% of the range centered on click point
      const xRange = xExtent[1] - xExtent[0];
      const yRange = yDomain[1] - yDomain[0];
      const zoomFactor = 0.1;

      const xHalfRange = (xRange * zoomFactor) / 2;
      const yHalfRange = (yRange * zoomFactor) / 2;

      xDomain = [
        Math.max(xExtent[0], zoomCenter.x - xHalfRange),
        Math.min(xExtent[1], zoomCenter.x + xHalfRange),
      ];
      yDomain = [
        Math.max(0, zoomCenter.y - yHalfRange),
        Math.min(10, zoomCenter.y + yHalfRange),
      ];
    }

    const xScale = d3
      .scaleLinear()
      .domain(xDomain)
      .range([0, innerWidth])
      .nice();

    const yScale = d3
      .scaleLinear()
      .domain(yDomain)
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
      .tickFormat((d) => `${d.valueOf()}m`)
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
      .text("Runtime (minutes)");

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
      .text("Rating");

    // Create index array for data binding
    const indices = d3.range(runtimes.length);
    const pointColor = "#10b981"; // Emerald color

    chartG
      .selectAll("circle")
      .data(indices)
      .join("circle")
      .attr("cx", (i) => xScale(runtimes[i] + jitterValues[i]))
      .attr("cy", (i) => yScale(avgRatings[i]))
      .attr("r", 2)
      .attr("fill", pointColor)
      .attr("fill-opacity", 0.5)
      .attr("stroke", pointColor)
      .attr("stroke-width", 0)
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
          .attr("r", 2)
          .attr("fill-opacity", 0.5)
          .attr("stroke-width", 0);
      });

    // Build data array for regression
    const regressionData = indices.map((i) => ({
      avgRating: avgRatings[i],
      runtime: runtimes[i],
    }));

    const regression = regressionPoly()
      .x((d: { avgRating: number; runtime: number }) => d.runtime)
      .y((d: { avgRating: number; runtime: number }) => d.avgRating)
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
    const glowFilter = defs.append("filter").attr("id", "trend-glow-runtime");
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
      .attr("stroke", "#34d399")
      .attr("stroke-width", 3)
      .attr("stroke-linecap", "round")
      .attr("filter", "url(#trend-glow-runtime)")
      .attr("opacity", 0.9);

    // Add interaction overlay for mouse tracking
    chartG
      .append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .style("cursor", isZoomed ? "zoom-out" : "zoom-in")
      .on("mousemove", (event: MouseEvent) => {
        handleMouseMove(event, xScale, yScale, margin);
      })
      .on("mouseleave", () => {
        setHoveredPoint(null);
      })
      .on("click", (event: MouseEvent) => {
        if (isZoomed) {
          // Unzoom
          setIsZoomed(false);
          setZoomCenter(null);
        } else {
          // Zoom to click location
          const bbox = containerRef.current?.getBoundingClientRect();
          if (!bbox) return;
          const mouseX = event.clientX - bbox.left - margin.left;
          const mouseY = event.clientY - bbox.top - margin.top;
          const dataX = xScale.invert(mouseX);
          const dataY = yScale.invert(mouseY);
          setZoomCenter({ x: dataX, y: dataY });
          setIsZoomed(true);
        }
      });
  }, [
    avgRatings,
    genres,
    titles,
    runtimes,
    jitterValues,
    dimensions,
    handleMouseMove,
    isZoomed,
    zoomCenter,
  ]);

  return (
    <div
      className={[
        "relative",
        "w-full",
        "h-full",
        "overflow-hidden",
        "flex",
        "flex-col",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex-grow relative" ref={containerRef}>
        <svg
          aria-label="Rating vs Runtime Scatter Plot"
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
                  {hoveredPoint.runtime}m
                </Chip>
                <Chip color="warning" size="sm" variant="flat">
                  ★ {hoveredPoint.avgRating.toFixed(2)}
                </Chip>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                {hoveredPoint.genres.replace(/,/g, " • ")}
              </p>
            </CardBody>
          </Card>
        )}

        {/* Legend Card with Help */}
        <div className="absolute top-4 right-4 flex items-start gap-2">
          <HelpTooltip
            description="Each dot represents a movie plotted by its runtime and average user rating. The trend line shows how ratings correlate with movie length."
            interactions={[
              { icon: "👆", text: "Hover points for movie details" },
              { icon: "🎭", text: "Select genres in the network to filter" },
            ]}
            title="Rating vs Runtime"
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
                      {runtimes.length.toLocaleString()} movies
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Tooltip
                    content="Each dot represents a movie's average rating"
                    placement="left"
                  >
                    <div className="flex items-center gap-2 cursor-help">
                      <span className="inline-block w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
                      <span className="text-gray-300">Movie rating</span>
                    </div>
                  </Tooltip>
                  <Tooltip
                    content="Polynomial regression showing the overall trend"
                    placement="left"
                  >
                    <div className="flex items-center gap-2 cursor-help">
                      <span
                        aria-hidden
                        className="w-6 h-0.5 rounded bg-emerald-400"
                      />
                      <span className="text-gray-300">Trend line</span>
                    </div>
                  </Tooltip>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {runtimes.length === 0 && selectedGenres.length > 0 && (
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

        {runtimes.length === 0 && selectedGenres.length === 0 && (
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

      {/* X-Axis Range Slider */}
      <RangeSlider
        defaultMax={180}
        defaultMin={60}
        formatValue={(v) => `${v}m`}
        label="Runtime"
        max={xFullExtent.max}
        min={xFullExtent.min}
        onRangeChange={handleRangeChange}
        step={5}
      />
    </div>
  );
}

export function RuntimeKPIPanel({
  className,
  df,
  selectedGenres = [],
}: RuntimeKPIPanelProps): React.ReactElement {
  const stats = useMemo((): RuntimeStats => {
    if (!df) {
      return {
        avgRatingLong: 0,
        avgRatingMedium: 0,
        avgRatingShort: 0,
        avgRuntime: 0,
        longestRuntime: 0,
        shortestRuntime: 0,
        totalMovies: 0,
      };
    }

    const allGenres = df.column("genres").values as string[];
    const allRuntimes = df.column("runtimeMinutes").values as number[];
    const allRatings = df.column("avgRating").values as number[];

    let totalRuntime = 0;
    let totalMovies = 0;
    let shortestRuntime = Infinity;
    let longestRuntime = 0;

    // For rating by length category
    let shortCount = 0,
      shortSum = 0;
    let mediumCount = 0,
      mediumSum = 0;
    let longCount = 0,
      longSum = 0;

    for (let i = 0; i < allGenres.length; i++) {
      const runtime = allRuntimes[i];
      if (!runtime || runtime <= 0 || runtime > 600) continue;

      // Filter by selected genres if any
      if (selectedGenres.length > 0) {
        const titleGenres = allGenres[i].split(",");
        if (!selectedGenres.every((g) => titleGenres.includes(g))) continue;
      }

      totalRuntime += runtime;
      totalMovies += 1;
      shortestRuntime = Math.min(shortestRuntime, runtime);
      longestRuntime = Math.max(longestRuntime, runtime);

      const rating = allRatings[i];
      if (runtime < 90) {
        shortSum += rating;
        shortCount += 1;
      } else if (runtime <= 150) {
        mediumSum += rating;
        mediumCount += 1;
      } else {
        longSum += rating;
        longCount += 1;
      }
    }

    return {
      avgRatingLong: longCount > 0 ? longSum / longCount : 0,
      avgRatingMedium: mediumCount > 0 ? mediumSum / mediumCount : 0,
      avgRatingShort: shortCount > 0 ? shortSum / shortCount : 0,
      avgRuntime: totalMovies > 0 ? totalRuntime / totalMovies : 0,
      longestRuntime: longestRuntime === 0 ? 0 : longestRuntime,
      shortestRuntime: shortestRuntime === Infinity ? 0 : shortestRuntime,
      totalMovies,
    };
  }, [df, selectedGenres]);

  const formatRuntime = (minutes: number): string => {
    if (minutes === 0) return "—";
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className={["flex flex-col gap-4", className ?? ""].join(" ")}>
      {/* Runtime Overview */}
      <Card className="bg-black/40 backdrop-blur-md border-white/10">
        <CardBody className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⏱️</span>
            <span className="text-sm font-medium text-white/90">
              Runtime Overview
            </span>
          </div>
          <div className="space-y-3">
            <div className="text-center py-2">
              <div className="text-xs text-gray-400 mb-1">Average Runtime</div>
              <span className="text-2xl font-bold text-emerald-400 font-mono">
                {formatRuntime(stats.avgRuntime)}
              </span>
            </div>
            <div className="border-t border-white/10 pt-3 grid grid-cols-2 gap-2">
              <div className="text-center">
                <div className="text-[10px] text-gray-400">Shortest</div>
                <div className="text-sm font-mono text-gray-300">
                  {formatRuntime(stats.shortestRuntime)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-400">Longest</div>
                <div className="text-sm font-mono text-gray-300">
                  {formatRuntime(stats.longestRuntime)}
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 pt-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Total movies</span>
                <span className="text-gray-300 font-mono">
                  {stats.totalMovies.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Rating by Length Category */}
      <Card className="bg-black/40 backdrop-blur-md border-white/10">
        <CardBody className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📊</span>
            <span className="text-sm font-medium text-white/90">
              Rating by Length
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Short (&lt;90m)</span>
              </div>
              <Chip color="warning" size="sm" variant="flat">
                ★ {stats.avgRatingShort.toFixed(2)}
              </Chip>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Medium (90-150m)</span>
              </div>
              <Chip color="warning" size="sm" variant="flat">
                ★ {stats.avgRatingMedium.toFixed(2)}
              </Chip>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Long (&gt;150m)</span>
              </div>
              <Chip color="warning" size="sm" variant="flat">
                ★ {stats.avgRatingLong.toFixed(2)}
              </Chip>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
