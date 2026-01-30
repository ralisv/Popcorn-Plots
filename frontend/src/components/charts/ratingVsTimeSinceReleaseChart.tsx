import type { DataFrame } from "danfojs";

import { Card, CardBody, Chip, Tooltip } from "@heroui/react";
import * as d3 from "d3";
import { regressionLoess } from "d3-regression";
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { HelpTooltip } from "../HelpTooltip";
import { RangeSlider } from "../RangeSlider";

export interface RatingVsTimeSinceReleaseChartProps {
  className?: string;
  ratingsDf?: DataFrame;
  selectedGenres?: string[];
  titlesDf?: DataFrame;
}

export interface TimeSinceReleaseKPIPanelProps {
  className?: string;
  ratingsDf?: DataFrame;
  selectedGenres?: string[];
  titlesDf?: DataFrame;
}

// KPI Stats for the panel
export interface TimeSinceReleaseStats {
  avgDeltaFirstImpression: number;
  firstImpressionCount: number;
  totalCount: number;
  trend: "down" | "neutral" | "up";
}

interface AggregatedPoint {
  avgRatingDelta: number;
  count: number;
  monthsSinceRelease: number;
}

interface HoveredPoint {
  avgRatingDelta: number;
  count: number;
  monthsSinceRelease: number;
  x: number;
  y: number;
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
  const [xRangeMin, setXRangeMin] = useState<null | number>(null);
  const [xRangeMax, setXRangeMax] = useState<null | number>(null);

  // Legend state
  const [isLegendMinimized, setIsLegendMinimized] = useState(false);

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

  // Pre-compute movie average ratings from ratings data
  const movieAvgRatings = useMemo(() => {
    if (!ratingsDf) return null;

    const ratingImdbIds = ratingsDf.column("imdbId").values as number[];
    const ratingValues = ratingsDf.column("rating").values as number[];

    // Calculate average rating per movie
    const movieStats = new Map<number, { count: number; sum: number }>();
    for (let i = 0; i < ratingImdbIds.length; i++) {
      const imdbId = ratingImdbIds[i];
      const rating = ratingValues[i] / 10; // Convert to 0-10 scale
      const stats = movieStats.get(imdbId);
      if (stats) {
        stats.sum += rating;
        stats.count += 1;
      } else {
        movieStats.set(imdbId, { count: 1, sum: rating });
      }
    }

    // Convert to average map
    const avgMap = new Map<number, number>();
    for (const [imdbId, stats] of movieStats.entries()) {
      avgMap.set(imdbId, stats.sum / stats.count);
    }

    return avgMap;
  }, [ratingsDf]);

  // Pre-compute rating data with years since release and normalized rating (only depends on ratingsDf, titleData, and movieAvgRatings)
  const ratingData = useMemo(() => {
    if (!ratingsDf || !titleData || !movieAvgRatings) return null;

    const ratingImdbIds = ratingsDf.column("imdbId").values as number[];
    const ratingDates = ratingsDf.column("date").values as unknown[];
    const ratingValues = ratingsDf.column("rating").values as number[];

    // Pre-compute: array of { imdbId, yearsSinceRelease, monthsSinceRelease, ratingDelta }
    const result: {
      imdbId: number;
      monthsSinceRelease: number;
      ratingDelta: number;
      yearsSinceRelease: number;
    }[] = [];

    for (let i = 0; i < ratingImdbIds.length; i++) {
      const titleInfo = titleData.get(ratingImdbIds[i]);
      const movieAvg = movieAvgRatings.get(ratingImdbIds[i]);
      if (!titleInfo || movieAvg === undefined) continue;

      // Extract year and month from date
      let ratingYear: number;
      let ratingMonth: number;
      const dateVal = ratingDates[i];
      if (dateVal instanceof Date) {
        ratingYear = dateVal.getFullYear();
        ratingMonth = dateVal.getMonth();
      } else if (typeof dateVal === "string") {
        ratingYear = parseInt(dateVal.substring(0, 4), 10);
        ratingMonth = parseInt(dateVal.substring(5, 7), 10) - 1;
      } else if (typeof dateVal === "number") {
        // Days since Unix epoch (1970-01-01)
        const date = new Date(dateVal * 24 * 60 * 60 * 1000);
        ratingYear = date.getFullYear();
        ratingMonth = date.getMonth();
      } else {
        continue; // Skip invalid dates
      }

      const yearsSinceRelease = ratingYear - titleInfo.year;
      // Calculate months since release (assuming movie released in January of its year)
      const monthsSinceRelease = yearsSinceRelease * 12 + ratingMonth;

      // Normalize rating by subtracting movie's average
      const rating = ratingValues[i] / 10; // Convert to 0-10 scale
      const ratingDelta = rating - movieAvg;

      if (yearsSinceRelease >= 0 && yearsSinceRelease < 100) {
        result.push({
          imdbId: ratingImdbIds[i],
          monthsSinceRelease,
          ratingDelta,
          yearsSinceRelease,
        });
      }
    }

    return result;
  }, [ratingsDf, titleData, movieAvgRatings]);

  // Calculate aggregated data filtered by selected genres (fast operation)
  const allData = useMemo(() => {
    if (!ratingData || !titleData) return [];

    const selectedGenreSet =
      selectedGenres.length > 0 ? new Set(selectedGenres) : null;

    // Aggregate by months since release
    const aggregation = new Map<
      number,
      { count: number; totalDelta: number }
    >();

    for (const { imdbId, monthsSinceRelease, ratingDelta } of ratingData) {
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

      const agg = aggregation.get(monthsSinceRelease);
      if (agg) {
        agg.totalDelta += ratingDelta;
        agg.count += 1;
      } else {
        aggregation.set(monthsSinceRelease, {
          count: 1,
          totalDelta: ratingDelta,
        });
      }
    }

    // Convert to array of points
    const points: AggregatedPoint[] = [];
    for (const [monthsSinceRelease, agg] of aggregation.entries()) {
      if (agg.count >= 10) {
        points.push({
          avgRatingDelta: agg.totalDelta / agg.count,
          count: agg.count,
          monthsSinceRelease,
        });
      }
    }

    points.sort((a, b) => a.monthsSinceRelease - b.monthsSinceRelease);
    return points;
  }, [ratingData, titleData, selectedGenres]);

  // Calculate the full x extent for slider bounds in years (based on genre-filtered data)
  const xFullExtent = useMemo(() => {
    if (allData.length === 0) return { max: 100, min: 0 };
    const extent = d3.extent(allData, (d) => d.monthsSinceRelease) as [
      number,
      number,
    ];
    // Convert to years for slider
    return { max: Math.ceil(extent[1] / 12), min: Math.floor(extent[0] / 12) };
  }, [allData]);

  // Initialize x-range to 0-2 years by default
  useEffect(() => {
    if (allData.length > 0 && xRangeMin === null && xRangeMax === null) {
      setXRangeMin(0);
      setXRangeMax(2);
    }
  }, [allData, xRangeMin, xRangeMax]);

  // Determine if we should show monthly or yearly view based on range
  const useMonthlyView = useMemo(() => {
    if (xRangeMin === null || xRangeMax === null) return false;
    return xRangeMax - xRangeMin < 6;
  }, [xRangeMin, xRangeMax]);

  // Filter and optionally re-aggregate data by x-axis range
  const aggregatedData = useMemo(() => {
    if (xRangeMin === null || xRangeMax === null) return allData;
    const minMonths = xRangeMin * 12;
    const maxMonths = xRangeMax * 12;

    // Filter to range first
    const filtered = allData.filter(
      (d) =>
        d.monthsSinceRelease >= minMonths && d.monthsSinceRelease <= maxMonths,
    );

    // If using monthly view, return as-is
    if (useMonthlyView) {
      return filtered;
    }

    // Otherwise, re-aggregate by years
    const yearAggregation = new Map<
      number,
      { count: number; totalDelta: number }
    >();
    for (const point of filtered) {
      const year = Math.floor(point.monthsSinceRelease / 12);
      const yearInMonths = year * 12; // Store as months for consistent x-axis
      const agg = yearAggregation.get(yearInMonths);
      if (agg) {
        // Weight by count to get proper average
        agg.totalDelta += point.avgRatingDelta * point.count;
        agg.count += point.count;
      } else {
        yearAggregation.set(yearInMonths, {
          count: point.count,
          totalDelta: point.avgRatingDelta * point.count,
        });
      }
    }

    const yearPoints: AggregatedPoint[] = [];
    for (const [monthsSinceRelease, agg] of yearAggregation.entries()) {
      yearPoints.push({
        avgRatingDelta: agg.totalDelta / agg.count,
        count: agg.count,
        monthsSinceRelease,
      });
    }

    yearPoints.sort((a, b) => a.monthsSinceRelease - b.monthsSinceRelease);
    return yearPoints;
  }, [allData, xRangeMin, xRangeMax, useMonthlyView]);

  // Handle range slider change
  const handleRangeChange = useCallback((min: number, max: number) => {
    setXRangeMin(min);
    setXRangeMax(max);
  }, []);

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
        const px = xScale(aggregatedData[i].monthsSinceRelease);
        const py = yScale(aggregatedData[i].avgRatingDelta);
        const dist = Math.hypot(mouseX - px, mouseY - py);

        if (dist < closestDist && dist < 30) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      if (closestIdx >= 0) {
        setHoveredPoint({
          avgRatingDelta: aggregatedData[closestIdx].avgRatingDelta,
          count: aggregatedData[closestIdx].count,
          monthsSinceRelease: aggregatedData[closestIdx].monthsSinceRelease,
          x: event.clientX - bbox.left + 15,
          y: event.clientY - bbox.top - 10,
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

    // Calculate domains (x-axis in months)
    const xExtent = d3.extent(aggregatedData, (d) => d.monthsSinceRelease) as [
      number,
      number,
    ];
    const yMin =
      Math.floor((d3.min(aggregatedData, (d) => d.avgRatingDelta) ?? -1) * 4) /
      4;
    const yMax =
      Math.ceil((d3.max(aggregatedData, (d) => d.avgRatingDelta) ?? 1) * 4) / 4;

    const xScale = d3
      .scaleLinear()
      .domain([0, xExtent[1]])
      .range([0, innerWidth])
      .nice();

    // For normalized data, center around 0
    const yScale = d3
      .scaleLinear()
      .domain([Math.min(-0.2, yMin - 0.1), Math.max(0.2, yMax + 0.1)])
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

    // Axes (display years on x-axis even though data is in months)
    // Generate tick values at year boundaries (multiples of 12 months)
    const xDomain = xScale.domain();
    const minYear = Math.ceil(xDomain[0] / 12);
    const maxYear = Math.floor(xDomain[1] / 12);
    const yearRange = maxYear - minYear;
    // Determine step size based on range to avoid too many ticks
    const yearStep =
      yearRange <= 10 ? 1 : yearRange <= 20 ? 2 : yearRange <= 50 ? 5 : 10;
    const yearTicks: number[] = [];
    for (let y = minYear; y <= maxYear; y += yearStep) {
      yearTicks.push(y * 12); // Convert back to months for the scale
    }

    const xAxis = d3
      .axisBottom(xScale)
      .tickValues(yearTicks)
      .tickFormat((d) => `${Math.round(d.valueOf() / 12)}y`);

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

    // Add zero line for reference
    chartG
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", yScale(0))
      .attr("y2", yScale(0))
      .attr("stroke", "rgba(255,255,255,0.3)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,4");

    chartG
      .append("text")
      .attr("fill", "rgba(255,255,255,0.7)")
      .attr("transform", "rotate(-90)")
      .attr("y", -45)
      .attr("x", -innerHeight / 2)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .text("Rating vs Movie Avg");

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
      .attr("cx", (d) => xScale(d.monthsSinceRelease))
      .attr("cy", (d) => yScale(d.avgRatingDelta))
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
      avgRatingDelta: d.avgRatingDelta,
      monthsSinceRelease: d.monthsSinceRelease,
    }));

    const regression = regressionLoess()
      .x(
        (d: { avgRatingDelta: number; monthsSinceRelease: number }) =>
          d.monthsSinceRelease,
      )
      .y(
        (d: { avgRatingDelta: number; monthsSinceRelease: number }) =>
          d.avgRatingDelta,
      )
      .bandwidth(0.25);

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
        "flex",
        "flex-col",
        "w-full",
        "h-full",
        "overflow-hidden",
        className ?? "",
      ].join(" ")}
    >
      {/* Chart container */}
      <div className="flex-grow relative" ref={containerRef}>
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
                {useMonthlyView
                  ? hoveredPoint.monthsSinceRelease === 0
                    ? "Release Month"
                    : hoveredPoint.monthsSinceRelease === 1
                      ? "1 month after release"
                      : `${hoveredPoint.monthsSinceRelease} months after release`
                  : hoveredPoint.monthsSinceRelease === 0
                    ? "Release Year"
                    : hoveredPoint.monthsSinceRelease === 12
                      ? "1 year after release"
                      : `${Math.round(hoveredPoint.monthsSinceRelease / 12)} years after release`}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Chip
                  color={
                    hoveredPoint.avgRatingDelta >= 0 ? "success" : "danger"
                  }
                  size="sm"
                  variant="flat"
                >
                  {hoveredPoint.avgRatingDelta >= 0 ? "+" : ""}
                  {hoveredPoint.avgRatingDelta.toFixed(3)}
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
            description="Each dot represents the normalized average rating (rating minus movie's overall average) at a specific number of years after release. Values above 0 mean higher than average ratings. This shows how perception changes over time."
            interactions={[
              { icon: "👆", text: "Hover points for details" },
              { icon: "⚪", text: "Dot size = number of ratings" },
            ]}
            title="Normalized Rating vs Time Since Release"
          />
          <Card className="bg-black/40 backdrop-blur-md border-white/10">
            <CardBody className="p-2">
              <button
                className="flex items-center gap-2 text-xs text-gray-300 hover:text-white transition-colors w-full"
                onClick={() => {
                  setIsLegendMinimized(!isLegendMinimized);
                }}
                type="button"
              >
                <span>Legend</span>
                {isLegendMinimized ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronUp className="w-3 h-3" />
                )}
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  isLegendMinimized
                    ? "max-h-0 opacity-0"
                    : "max-h-96 opacity-100"
                }`}
              >
                <div className="flex flex-col gap-3 text-xs mt-3 pt-2 border-t border-white/10">
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
                      content="Normalized rating (vs movie avg) at years after release"
                      placement="left"
                    >
                      <div className="flex items-center gap-2 cursor-help">
                        <span className="inline-block w-3 h-3 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500" />
                        <span className="text-gray-300">
                          Rating delta by time
                        </span>
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
                    <Tooltip
                      content="Zero line - ratings at this level match movie average"
                      placement="left"
                    >
                      <div className="flex items-center gap-2 cursor-help">
                        <span
                          aria-hidden
                          className="w-6 h-0.5 rounded border-b border-dashed border-white/30"
                        />
                        <span className="text-gray-300">Movie average</span>
                      </div>
                    </Tooltip>
                  </div>
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

      {/* X-Axis Range Slider */}
      <RangeSlider
        defaultMax={2}
        defaultMin={0}
        formatValue={(v) => `${v}y`}
        label="Years Since Release"
        max={xFullExtent.max}
        min={xFullExtent.min}
        onRangeChange={handleRangeChange}
        step={1}
      />
    </div>
  );
}

// KPI Panel for Time Since Release stats
export function TimeSinceReleaseKPIPanel({
  className,
  ratingsDf,
  selectedGenres = [],
  titlesDf,
}: TimeSinceReleaseKPIPanelProps): React.ReactElement {
  // Pre-compute title data
  const titleData = useMemo(() => {
    if (!titlesDf) return null;

    const titleIds = titlesDf.column("id").values as number[];
    const titleYears = titlesDf.column("year").values as number[];
    const titleGenres = titlesDf.column("genres").values as string[];

    const titleMap = new Map<number, { genreSet: Set<string>; year: number }>();
    for (let i = 0; i < titleIds.length; i++) {
      titleMap.set(titleIds[i], {
        genreSet: new Set(titleGenres[i].split(",")),
        year: titleYears[i],
      });
    }

    return titleMap;
  }, [titlesDf]);

  // Pre-compute movie average ratings
  const movieAvgRatings = useMemo(() => {
    if (!ratingsDf) return null;

    const ratingImdbIds = ratingsDf.column("imdbId").values as number[];
    const ratingValues = ratingsDf.column("rating").values as number[];

    const movieStats = new Map<number, { count: number; sum: number }>();
    for (let i = 0; i < ratingImdbIds.length; i++) {
      const imdbId = ratingImdbIds[i];
      const rating = ratingValues[i] / 10;
      const stats = movieStats.get(imdbId);
      if (stats) {
        stats.sum += rating;
        stats.count += 1;
      } else {
        movieStats.set(imdbId, { count: 1, sum: rating });
      }
    }

    const avgMap = new Map<number, number>();
    for (const [imdbId, stats] of movieStats.entries()) {
      avgMap.set(imdbId, stats.sum / stats.count);
    }

    return avgMap;
  }, [ratingsDf]);

  // Calculate stats for the KPI panel
  const stats = useMemo((): TimeSinceReleaseStats => {
    if (!ratingsDf || !titleData || !movieAvgRatings) {
      return {
        avgDeltaFirstImpression: 0,
        firstImpressionCount: 0,
        totalCount: 0,
        trend: "neutral",
      };
    }

    const ratingImdbIds = ratingsDf.column("imdbId").values as number[];
    const ratingDates = ratingsDf.column("date").values as unknown[];
    const ratingValues = ratingsDf.column("rating").values as number[];

    const selectedGenreSet =
      selectedGenres.length > 0 ? new Set(selectedGenres) : null;

    let firstImpressionSum = 0;
    let firstImpressionCount = 0;
    let totalCount = 0;

    for (let i = 0; i < ratingImdbIds.length; i++) {
      const imdbId = ratingImdbIds[i];
      const titleInfo = titleData.get(imdbId);
      const movieAvg = movieAvgRatings.get(imdbId);
      if (!titleInfo || movieAvg === undefined) continue;

      // Filter by selected genres
      if (selectedGenreSet) {
        let hasAllGenres = true;
        for (const g of selectedGenreSet) {
          if (!titleInfo.genreSet.has(g)) {
            hasAllGenres = false;
            break;
          }
        }
        if (!hasAllGenres) continue;
      }

      // Extract date info
      let ratingYear: number;
      let ratingMonth: number;
      const dateVal = ratingDates[i];
      if (dateVal instanceof Date) {
        ratingYear = dateVal.getFullYear();
        ratingMonth = dateVal.getMonth();
      } else if (typeof dateVal === "string") {
        ratingYear = parseInt(dateVal.substring(0, 4), 10);
        ratingMonth = parseInt(dateVal.substring(5, 7), 10) - 1;
      } else if (typeof dateVal === "number") {
        const date = new Date(dateVal * 24 * 60 * 60 * 1000);
        ratingYear = date.getFullYear();
        ratingMonth = date.getMonth();
      } else {
        continue;
      }

      const yearsSinceRelease = ratingYear - titleInfo.year;
      if (yearsSinceRelease < 0 || yearsSinceRelease >= 100) continue;

      totalCount += 1;

      const monthsSinceRelease = yearsSinceRelease * 12 + ratingMonth;
      const rating = ratingValues[i] / 10;
      const ratingDelta = rating - movieAvg;

      // First 2 months = first impression
      if (monthsSinceRelease <= 2) {
        firstImpressionSum += ratingDelta;
        firstImpressionCount += 1;
      }
    }

    const avgDeltaFirstImpression =
      firstImpressionCount > 0 ? firstImpressionSum / firstImpressionCount : 0;

    let trend: "down" | "neutral" | "up" = "neutral";
    if (Math.abs(avgDeltaFirstImpression) > 0.02) {
      trend = avgDeltaFirstImpression > 0 ? "up" : "down";
    }

    return { avgDeltaFirstImpression, firstImpressionCount, totalCount, trend };
  }, [ratingsDf, titleData, movieAvgRatings, selectedGenres]);

  const formatDelta = (value: number): string => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(3)}`;
  };

  return (
    <div className={["flex flex-col gap-4", className ?? ""].join(" ")}>
      {/* First Impression vs Global Average */}
      <Card className="bg-black/40 backdrop-blur-md border-white/10">
        <CardBody className="p-4">
          <div className="flex items-center gap-2 mb-3">
            {stats.trend === "up" ? (
              <TrendingUp className="w-5 h-5 text-green-400" />
            ) : stats.trend === "down" ? (
              <TrendingDown className="w-5 h-5 text-red-400" />
            ) : (
              <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                —
              </div>
            )}
            <span className="text-sm font-medium text-white/90">
              First Impression Effect
            </span>
          </div>
          <div className="space-y-4">
            <div className="text-center py-3">
              <div className="text-xs text-gray-400 mb-2">
                First 2 months vs all-time average
              </div>
              <span
                className={`text-3xl font-bold font-mono ${stats.avgDeltaFirstImpression >= 0 ? "text-green-400" : "text-red-400"}`}
              >
                {formatDelta(stats.avgDeltaFirstImpression)}
              </span>
            </div>
            <div className="border-t border-white/10 pt-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">First impression ratings</span>
                <span className="text-cyan-400 font-mono">
                  {stats.firstImpressionCount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs mt-2">
                <span className="text-gray-400">Total ratings</span>
                <span className="text-gray-300 font-mono">
                  {stats.totalCount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Interpretation Card */}
      <Card className="bg-black/40 backdrop-blur-md border-white/10">
        <CardBody className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">💡</span>
            <span className="text-sm font-medium text-white/90">
              Interpretation
            </span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            {stats.trend === "up" ? (
              <>
                First impressions are{" "}
                <span className="text-green-400 font-medium">
                  more positive
                </span>{" "}
                than later ratings. Early viewers rate movies{" "}
                {Math.abs(stats.avgDeltaFirstImpression).toFixed(3)} points
                higher relative to the movie&apos;s overall average.
              </>
            ) : stats.trend === "down" ? (
              <>
                First impressions are{" "}
                <span className="text-red-400 font-medium">more negative</span>{" "}
                than later ratings. Early viewers rate movies{" "}
                {Math.abs(stats.avgDeltaFirstImpression).toFixed(3)} points
                lower relative to the movie&apos;s overall average.
              </>
            ) : (
              <>
                First impressions are{" "}
                <span className="text-gray-300 font-medium">neutral</span>.
                Early ratings closely match the movie&apos;s overall average,
                showing no significant bias.
              </>
            )}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
