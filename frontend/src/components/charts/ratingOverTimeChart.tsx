import type { DataFrame } from "danfojs";

import { Button, Card, CardBody, Chip, Tooltip } from "@heroui/react";
import * as d3 from "d3";
import { regressionPoly } from "d3-regression";
import { Layers } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { imdbTitleUrl } from "../../utils";
import { HelpTooltip } from "../HelpTooltip";
import { RangeSlider } from "../RangeSlider";
import {
  type MovieSuggestion,
  SearchAutocomplete,
} from "../SearchAutocomplete";

export interface RatingOverTimeChartProps {
  className?: string;
  df?: DataFrame;
  selectedGenres?: string[];
}

interface HoveredPoint {
  avgRating: number;
  genres: string;
  imdbId: number;
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

  // X-axis range filter state
  const [xRangeMin, setXRangeMin] = useState<null | number>(null);
  const [xRangeMax, setXRangeMax] = useState<null | number>(null);

  // Zoom state
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomCenter, setZoomCenter] = useState<null | { x: number; y: number }>(
    null,
  );

  // Search state
  const [activeSearch, setActiveSearch] = useState("");
  const [isExactSelection, setIsExactSelection] = useState(false);

  // Legend state
  const [isLegendMinimized, setIsLegendMinimized] = useState(false);

  // Ctrl key state for cursor change
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // Listen for Ctrl key presses
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey) {
        setIsCtrlPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent): void => {
      if (!e.ctrlKey && !e.metaKey) {
        setIsCtrlPressed(false);
      }
    };
    const handleBlur = (): void => {
      setIsCtrlPressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    // Handle window blur (user switches tabs/windows)
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Extract all filtered data from DataFrame (without x-range filter)
  const allData = useMemo(() => {
    if (!df)
      return { avgRatings: [], genres: [], ids: [], titles: [], years: [] };

    const allGenres = df.column("genres").values as string[];
    const allYears = df.column("year").values as number[];
    const allRatings = df.column("avgRating").values as number[];
    const allTitles = df.column("title").values as string[];
    const allIds = df.column("id").values as number[];

    if (selectedGenres.length === 0) {
      return {
        avgRatings: allRatings,
        genres: allGenres,
        ids: allIds,
        titles: allTitles,
        years: allYears,
      };
    }

    // Filter by selected genres
    const filteredYears: number[] = [];
    const filteredRatings: number[] = [];
    const filteredTitles: string[] = [];
    const filteredGenres: string[] = [];
    const filteredIds: number[] = [];

    for (let i = 0; i < allGenres.length; i++) {
      const titleGenres = allGenres[i].split(",");
      if (selectedGenres.every((g) => titleGenres.includes(g))) {
        filteredYears.push(allYears[i]);
        filteredRatings.push(allRatings[i]);
        filteredTitles.push(allTitles[i]);
        filteredGenres.push(allGenres[i]);
        filteredIds.push(allIds[i]);
      }
    }

    return {
      avgRatings: filteredRatings,
      genres: filteredGenres,
      ids: filteredIds,
      titles: filteredTitles,
      years: filteredYears,
    };
  }, [df, selectedGenres]);

  // Calculate full x-axis extent from all data
  const xFullExtent = useMemo(() => {
    if (allData.years.length === 0) return { max: 2025, min: 1900 };
    const extent = d3.extent(allData.years) as [number, number];
    return { max: extent[1], min: extent[0] };
  }, [allData.years]);

  // Initialize range to full extent when data changes
  useEffect(() => {
    setXRangeMin(xFullExtent.min);
    setXRangeMax(xFullExtent.max);
  }, [xFullExtent.min, xFullExtent.max]);

  // Apply x-range filter to get displayed data
  const { avgRatings, genres, ids, titles, years } = useMemo(() => {
    const effectiveMin = xRangeMin ?? xFullExtent.min;
    const effectiveMax = xRangeMax ?? xFullExtent.max;

    const filteredYears: number[] = [];
    const filteredRatings: number[] = [];
    const filteredTitles: string[] = [];
    const filteredGenres: string[] = [];
    const filteredIds: number[] = [];

    for (let i = 0; i < allData.years.length; i++) {
      const year = allData.years[i];
      if (year >= effectiveMin && year <= effectiveMax) {
        filteredYears.push(year);
        filteredRatings.push(allData.avgRatings[i]);
        filteredTitles.push(allData.titles[i]);
        filteredGenres.push(allData.genres[i]);
        filteredIds.push(allData.ids[i]);
      }
    }

    return {
      avgRatings: filteredRatings,
      genres: filteredGenres,
      ids: filteredIds,
      titles: filteredTitles,
      years: filteredYears,
    };
  }, [allData, xRangeMin, xRangeMax, xFullExtent]);

  // Create movie suggestions for autocomplete
  const movieSuggestions = useMemo((): MovieSuggestion[] => {
    return titles.map((title, i) => ({
      genres: genres[i],
      rating: avgRatings[i],
      title,
      year: years[i],
    }));
  }, [titles, genres, avgRatings, years]);

  // Handler for range slider changes
  const handleRangeChange = useCallback((min: number, max: number) => {
    setXRangeMin(min);
    setXRangeMax(max);
  }, []);

  // Generate seeded random jitter for each point (stable across re-renders)
  // Jitter within ±0.4 of a year to spread points horizontally
  const jitterValues = useMemo(() => {
    const jitterSeed = 12345;
    return years.map((_, i) => {
      const x = Math.sin(jitterSeed + i * 9999) * 10000;
      return (x - Math.floor(x)) * 0.8 - 0.4; // Range: -0.4 to +0.4
    });
  }, [years]);

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

      for (let i = 0; i < years.length; i++) {
        const px = xScale(years[i] + jitterValues[i]);
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
          imdbId: ids[closestIdx],
          title: titles[closestIdx],
          x: event.clientX - bbox.left + 15,
          y: event.clientY - bbox.top - 10,
          year: years[closestIdx],
        });
      } else {
        setHoveredPoint(null);
      }
    },
    [years, avgRatings, titles, genres, ids, jitterValues],
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

    // Create defs for clipping
    const defs = svg.append("defs");

    // Add clip path to hide points outside chart area
    defs
      .append("clipPath")
      .attr("id", "chart-clip-rating-time")
      .append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight);

    const chartG = g
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Use nice rounded domains for better scale
    const xExtent = d3.extent(years) as [number, number];
    const yMin = Math.floor((d3.min(avgRatings) ?? 0) * 2) / 2;
    const yMax = Math.ceil((d3.max(avgRatings) ?? 10) * 2) / 2;

    // Calculate zoom domains
    let xDomain: [number, number] = xExtent;
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
    const highlightColor = "#fbbf24"; // Amber color for search matches

    // Point sizes - larger when zoomed
    const baseSize = isZoomed ? 10 : 2;
    const highlightSize = isZoomed ? 20 : 6;
    const hoverSize = isZoomed ? 24 : 8;

    // Find matched indices based on search
    const matchedIndices = new Set<number>();
    if (activeSearch.trim()) {
      const searchLower = activeSearch.toLowerCase();
      if (isExactSelection) {
        // For exact selection, match the entire title exactly
        for (let i = 0; i < titles.length; i++) {
          if (titles[i].toLowerCase() === searchLower) {
            matchedIndices.add(i);
          }
        }
      } else {
        // For custom search, use substring matching
        for (let i = 0; i < titles.length; i++) {
          if (titles[i].toLowerCase().includes(searchLower)) {
            matchedIndices.add(i);
          }
        }
      }
    }

    // Create a clipped group for scatter points
    const pointsG = chartG
      .append("g")
      .attr("clip-path", "url(#chart-clip-rating-time)");

    // First render all regular (non-highlighted) circles
    const regularIndices = indices.filter((i) => !matchedIndices.has(i));
    pointsG
      .selectAll("circle.regular")
      .data(regularIndices)
      .join("circle")
      .attr("class", "regular")
      .attr("cx", (i) => xScale(years[i] + jitterValues[i]))
      .attr("cy", (i) => yScale(avgRatings[i]))
      .attr("r", baseSize)
      .attr("fill", pointColor)
      .attr("fill-opacity", 0.5)
      .attr("stroke", pointColor)
      .attr("stroke-width", 0)
      .style("cursor", "pointer")
      .on("mouseenter", function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("r", hoverSize)
          .attr("fill-opacity", 1)
          .attr("stroke-width", 2);
      })
      .on("mouseleave", function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("r", baseSize)
          .attr("fill-opacity", 0.5)
          .attr("stroke-width", 0);
      });

    // Then render highlighted circles on top
    const highlightedIndices = indices.filter((i) => matchedIndices.has(i));
    pointsG
      .selectAll("circle.highlighted")
      .data(highlightedIndices)
      .join("circle")
      .attr("class", "highlighted")
      .attr("cx", (i) => xScale(years[i] + jitterValues[i]))
      .attr("cy", (i) => yScale(avgRatings[i]))
      .attr("r", highlightSize)
      .attr("fill", highlightColor)
      .attr("fill-opacity", 1)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseenter", function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("r", hoverSize)
          .attr("fill-opacity", 1)
          .attr("stroke-width", 2);
      })
      .on("mouseleave", function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("r", highlightSize)
          .attr("fill-opacity", 1)
          .attr("stroke-width", 2);
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

    // Add glow effect for trend line (reuse existing defs)
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
      .style(
        "cursor",
        isCtrlPressed ? "pointer" : isZoomed ? "zoom-out" : "zoom-in",
      )
      .on("mousemove", (event: MouseEvent) => {
        handleMouseMove(event, xScale, yScale, margin);
      })
      .on("mouseleave", () => {
        setHoveredPoint(null);
      })
      .on("click", (event: MouseEvent) => {
        // Check for Ctrl+click to open IMDb
        if (event.ctrlKey || event.metaKey) {
          // Find closest point to open IMDb link
          const bbox = containerRef.current?.getBoundingClientRect();
          if (!bbox) return;
          const mouseX = event.clientX - bbox.left - margin.left;
          const mouseY = event.clientY - bbox.top - margin.top;

          let closestIdx = -1;
          let closestDist = Infinity;

          for (let i = 0; i < years.length; i++) {
            const px = xScale(years[i] + jitterValues[i]);
            const py = yScale(avgRatings[i]);
            const dist = Math.hypot(mouseX - px, mouseY - py);

            if (dist < closestDist && dist < 30) {
              closestDist = dist;
              closestIdx = i;
            }
          }

          if (closestIdx >= 0) {
            window.open(imdbTitleUrl(ids[closestIdx]), "_blank");
          }
          return;
        }

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
    activeSearch,
    avgRatings,
    dimensions,
    genres,
    handleMouseMove,
    ids,
    isCtrlPressed,
    isExactSelection,
    isZoomed,
    jitterValues,
    titles,
    years,
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
          aria-label="Rating Over Time Scatter Plot"
          className="w-full h-full"
          ref={svgRef}
          role="img"
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        >
          <g ref={gRef} />
        </svg>

        {/* Search Input */}
        <div className="absolute top-4 left-20">
          <SearchAutocomplete
            hasActiveSearch={!!activeSearch}
            onClear={() => {
              setActiveSearch("");
            }}
            onSearch={(query, isExact) => {
              setActiveSearch(query);
              setIsExactSelection(isExact);
            }}
            placeholder="Search movies..."
            suggestions={movieSuggestions}
          />
        </div>

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
                  ★ {hoveredPoint.avgRating.toFixed(2)}
                </Chip>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                {hoveredPoint.genres.replace(/,/g, " • ")}
              </p>
              <p className="text-[11px] text-purple-300 mt-2">
                Ctrl + click to open on IMDb
              </p>
            </CardBody>
          </Card>
        )}

        {/* Legend Card with Help */}
        <div className="absolute top-4 right-4 flex items-start gap-2">
          <HelpTooltip
            description="Each dot represents a movie plotted by its release year and average user rating. The trend line shows how ratings have changed over time. Hover over points to see movie details, or use the search bar to highlight specific movies."
            interactions={[
              { icon: "🔍", text: "Click to zoom in, click again to zoom out" },
              { icon: "🔎", text: "Search to highlight matching movies" },
            ]}
            title="Ratings Over Time"
          />
          <Button
            aria-label={isLegendMinimized ? "Show legend" : "Hide legend"}
            isIconOnly
            onPress={() => {
              setIsLegendMinimized(!isLegendMinimized);
            }}
            size="sm"
            variant="ghost"
          >
            <Layers className="w-4 h-4" />
          </Button>
          <Card
            className={`bg-black/40 backdrop-blur-md border-white/10 overflow-hidden transition-all duration-300 ease-in-out ${
              isLegendMinimized
                ? "max-w-0 opacity-0 border-0 p-0"
                : "max-w-xs opacity-100"
            }`}
          >
            <CardBody className="p-3">
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
                      <span
                        aria-hidden
                        className="w-6 h-0.5 rounded bg-pink-400"
                      />
                      <span className="text-gray-300">Trend line</span>
                    </div>
                  </Tooltip>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

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

      {/* X-Axis Range Slider */}
      <RangeSlider
        defaultMax={xFullExtent.max}
        defaultMin={xFullExtent.min}
        formatValue={(v) => v.toString()}
        label="Years"
        max={xFullExtent.max}
        min={xFullExtent.min}
        onRangeChange={handleRangeChange}
        step={1}
      />
    </div>
  );
}
