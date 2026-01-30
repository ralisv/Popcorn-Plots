import { Card, CardBody, Chip } from "@heroui/react";
import * as d3 from "d3";
import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HelpTooltip } from "../HelpTooltip";

// --- Simulation Constants ---

/** The minimum and maximum width of the links between genres. */
const LINK_WIDTH_RANGE: [number, number] = [1, 10];

/** The minimum and maximum opacity for links. */
const LINK_OPACITY_RANGE: [number, number] = [0.2, 0.8];

/** The target distance between linked nodes. */
const LINK_DISTANCE = 120;

/** The padding around each node to prevent overlapping. */
const NODE_COLLISION_PADDING = 10;

/** The minimum and maximum radius of the nodes. */
const NODE_SIZE_RANGE: [number, number] = [10, 50];

/** The minimum and maximum zoom level. */
const ZOOM_EXTENT: [number, number] = [0.5, 8];

/** The duration of the hover transition in milliseconds. */
const HOVER_TRANSITION_DURATION = 300;

// --- Force Strength Constants (all normalized 0-1) ---

/**
 * Base symmetric link force strength (0-1).
 * Controls how strongly all linked nodes are pulled together symmetrically.
 * Higher = nodes cluster more tightly along links.
 */
const SYMMETRIC_LINK_STRENGTH = 1;

/**
 * Controls how strongly nodes push each other apart.
 */
const CHARGE_STRENGTH = -1500;

/** Maximum distance (in pixels) for charge force to apply. */
const CHARGE_MAX_DISTANCE = 1000;

/** Strength of the centering force (0-1). Keeps the graph centered. */
const CENTER_STRENGTH = 0.05;

/** Strength of the collision force (0-1). Prevents node overlap. */
const COLLISION_STRENGTH = 0.8;

/** Velocity decay (0-1). Higher = more damping/stability, lower = more inertia. */
const VELOCITY_DECAY = 0.3;

/** Alpha decay rate. Higher = faster settling, lower = longer simulation. */
const ALPHA_DECAY = 0.01;

export interface SociogramProps {
  className?: string;
  links?: GenreLinkDatum[];
  nodes?: GenreNodeDatum[];
  onSelectedGenresChange?: (
    genres: ((prevGenres: string[]) => string[]) | string[],
  ) => void;
  selectedGenres?: string[];
}

interface GenreLinkDatum extends d3.SimulationLinkDatum<GenreNodeDatum> {
  source: GenreNodeDatum | string;
  target: GenreNodeDatum | string;
  value: number;
}

interface GenreNodeDatum extends d3.SimulationNodeDatum {
  avgRating?: number; // Average rating for movies in this genre
  count: number; // Number of movies in this genre
  id: string; // Genre name
}

type HoveredLinkState = null | {
  source: string;
  sourceCount: number;
  target: string;
  targetCount: number;
  value: number;
  x: number;
  y: number;
};

type HoveredNodeState = null | {
  avgRating?: number;
  count: number;
  id: string;
  x: number;
  y: number;
};

export function Sociogram({
  className,
  links,
  nodes,
  onSelectedGenresChange,
  selectedGenres = [],
}: SociogramProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<null | SVGSVGElement>(null);
  const gRef = useRef<null | SVGGElement>(null);
  const [dimensions, setDimensions] = useState({ height: 0, width: 0 });
  const [hoveredLink, setHoveredLink] = useState<HoveredLinkState>(null);
  const [hoveredNode, setHoveredNode] = useState<HoveredNodeState>(null);

  // Refs to store zoom behavior and simulation for reset functionality
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<
    SVGSVGElement,
    unknown
  > | null>(null);
  const simulationRef = useRef<d3.Simulation<
    GenreNodeDatum,
    GenreLinkDatum
  > | null>(null);

  const selectedGenresRef = useRef(selectedGenres);
  useEffect(() => {
    selectedGenresRef.current = selectedGenres;
  }, [selectedGenres]);

  const handleNodeClick = useCallback(
    (genreId: string): void => {
      if (!onSelectedGenresChange) return;

      onSelectedGenresChange((prev) =>
        prev.includes(genreId)
          ? prev.filter((g) => g !== genreId)
          : [...prev, genreId],
      );
    },
    [onSelectedGenresChange],
  );

  const handleClearSelection = useCallback((): void => {
    onSelectedGenresChange?.([]);
  }, [onSelectedGenresChange]);

  const handleRemoveGenre = useCallback(
    (genreId: string): void => {
      if (!onSelectedGenresChange) return;
      onSelectedGenresChange((prev) => prev.filter((g) => g !== genreId));
    },
    [onSelectedGenresChange],
  );

  const handleResetView = useCallback((): void => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;

    const svg = d3.select(svgRef.current);

    // Reset zoom to identity transform with smooth transition
    svg
      .transition()
      .duration(500)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);

    // Restart simulation to re-center nodes
    if (simulationRef.current) {
      // Release all fixed positions
      simulationRef.current.nodes().forEach((node) => {
        node.fx = null;
        node.fy = null;
      });
      simulationRef.current.alpha(0.5).restart();
    }
  }, []);

  const { dataLinks, dataNodes } = useMemo(() => {
    return {
      dataLinks: (links ?? []).map((l) => ({ ...l })),
      dataNodes: (nodes ?? []).map((n) => ({ ...n })),
    };
  }, [nodes, links]);

  const { ratingExtent, useRatingColorScale } = useMemo(() => {
    const ratingExtent = d3.extent(
      dataNodes.flatMap((d) => (d.avgRating ? [d.avgRating] : [])),
    );
    const useRatingColorScale = ratingExtent[0] !== undefined;
    return { ratingExtent, useRatingColorScale };
  }, [dataNodes]);

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
    if (dataNodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    g.selectAll("*").remove();

    const chartColors = [
      "var(--color-chart-1)",
      "var(--color-chart-2)",
      "var(--color-chart-3)",
      "var(--color-chart-4)",
      "var(--color-chart-5)",
    ];

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent(ZOOM_EXTENT)
      .on("start", () => {
        svg.style("cursor", "grabbing");
      })
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", event.transform.toString());
      })
      .on("end", () => {
        svg.style("cursor", "grab");
      });

    // Store zoom behavior ref for reset functionality
    zoomBehaviorRef.current = zoomBehavior;

    svg.call(zoomBehavior).style("cursor", "grab");

    const linkLayer = g.append("g").attr("data-layer", "links");
    const nodeLayer = g.append("g").attr("data-layer", "nodes");
    const labelLayer = g.append("g").attr("data-layer", "labels");

    const getNodeId = (node: GenreNodeDatum | string): string =>
      typeof node === "string" ? node : node.id;

    const isLinkConnectedToNode = (
      link: GenreLinkDatum,
      nodeId: string,
    ): boolean =>
      getNodeId(link.source) === nodeId || getNodeId(link.target) === nodeId;

    const maxLinkValue = d3.max(dataLinks, (d) => d.value) ?? 1;

    const linkWidthScale = d3
      .scaleLinear()
      .domain([0, maxLinkValue])
      .range(LINK_WIDTH_RANGE);

    const linkHighlightColorScale = d3
      .scaleLinear<string>()
      .domain([0, maxLinkValue])
      .range(["gray", "lightgray"]);

    const linkOpacityScale = d3
      .scaleLinear()
      .domain([0, maxLinkValue])
      .range(LINK_OPACITY_RANGE);

    const nodeSizeScale = d3
      .scaleSqrt()
      .domain([0, d3.max(dataNodes, (d) => d.count) ?? 1])
      .range(NODE_SIZE_RANGE);

    const ratingColorScale = d3
      .scaleSequential(d3.interpolatePRGn)
      .domain(ratingExtent as [number, number]);

    const genreColorScale = d3
      .scaleOrdinal<string>()
      .domain(dataNodes.map((d) => d.id))
      .range(chartColors);

    const nodeSel = nodeLayer
      .selectAll<SVGCircleElement, GenreNodeDatum>("circle")
      .data(dataNodes, (d) => d.id)
      .join("circle")
      .attr("r", (d) => nodeSizeScale(d.count))
      .attr("fill", (d) => {
        if (useRatingColorScale && d.avgRating) {
          return ratingColorScale(d.avgRating);
        }
        return genreColorScale(d.id);
      })
      .attr("class", "transition-all duration-200 ease-out cursor-pointer")
      .on("click", (_event, d) => {
        handleNodeClick(d.id);
      });

    const linkSel = linkLayer
      .selectAll<SVGLineElement, GenreLinkDatum>("line")
      .data(
        dataLinks,
        ({ source, target }) =>
          `${typeof source === "string" ? source : source.id}-${
            typeof target === "string" ? target : target.id
          }`,
      )
      .join("line")
      .attr("stroke", "var(--color-border)")
      .attr("stroke-opacity", (d) => linkOpacityScale(d.value))
      .attr("stroke-width", (d) => linkWidthScale(d.value))
      .attr("class", "cursor-pointer")
      .on("mouseenter", (event: MouseEvent, d) => {
        const container = containerRef.current;
        const bbox = container?.getBoundingClientRect();
        const pointerX = event.clientX - (bbox?.left ?? 0) + 12;
        const pointerY = event.clientY - (bbox?.top ?? 0) + 12;

        const src = getNodeId(d.source);
        const tgt = getNodeId(d.target);

        const srcNode = dataNodes.find((n) => n.id === src);
        const tgtNode = dataNodes.find((n) => n.id === tgt);

        d3.select(event.currentTarget as SVGLineElement)
          .raise()
          .transition()
          .duration(HOVER_TRANSITION_DURATION)
          .attr("stroke", "var(--color-foreground)")
          .attr("stroke-opacity", 1)
          .attr("stroke-width", Math.max(linkWidthScale(d.value) * 1.6, 2));

        linkSel
          .filter((l) => l !== d)
          .transition()
          .duration(HOVER_TRANSITION_DURATION)
          .attr("stroke", "var(--color-border)")
          .attr("stroke-opacity", (l) => linkOpacityScale(l.value) * 0.25)
          .attr("stroke-width", (l) => linkWidthScale(l.value) * 0.7);

        nodeSel
          .transition()
          .duration(HOVER_TRANSITION_DURATION)
          .attr("stroke", (n) =>
            n.id === src || n.id === tgt
              ? "var(--color-foreground)"
              : "var(--color-card)",
          )
          .attr("stroke-width", (n) => (n.id === src || n.id === tgt ? 3 : 2))
          .attr("opacity", (n) => (n.id === src || n.id === tgt ? 1 : 0.6));

        setHoveredLink({
          source: src,
          sourceCount: srcNode?.count ?? 0,
          target: tgt,
          targetCount: tgtNode?.count ?? 0,
          value: d.value,
          x: pointerX,
          y: pointerY,
        });
      })
      .on("mousemove", (event: MouseEvent) => {
        const container = containerRef.current;
        const bbox = container?.getBoundingClientRect();
        const pointerX = event.clientX - (bbox?.left ?? 0) + 12;
        const pointerY = event.clientY - (bbox?.top ?? 0) + 12;
        setHoveredLink((prev) =>
          prev ? { ...prev, x: pointerX, y: pointerY } : null,
        );
      })
      .on("mouseleave", () => {
        linkSel
          .transition()
          .duration(HOVER_TRANSITION_DURATION)
          .attr("stroke", "var(--color-border)")
          .attr("stroke-opacity", (l) => linkOpacityScale(l.value))
          .attr("stroke-width", (l) => linkWidthScale(l.value));

        nodeSel
          .transition("node-hover")
          .duration(HOVER_TRANSITION_DURATION)
          .attr("r", (n) => nodeSizeScale(n.count))
          .attr("stroke", (n) =>
            selectedGenresRef.current.includes(n.id)
              ? "var(--color-primary)"
              : "var(--color-card)",
          )
          .attr("stroke-width", (n) =>
            selectedGenresRef.current.includes(n.id) ? 4 : 2,
          )
          .attr("opacity", 1);

        setHoveredLink(null);
      });

    nodeSel
      .on("mouseenter", function (event: MouseEvent, d) {
        const container = containerRef.current;
        const bbox = container?.getBoundingClientRect();
        const pointerX = event.clientX - (bbox?.left ?? 0) + 15;
        const pointerY = event.clientY - (bbox?.top ?? 0) - 10;

        setHoveredNode({
          avgRating: d.avgRating,
          count: d.count,
          id: d.id,
          x: pointerX,
          y: pointerY,
        });

        const currentRadius = nodeSizeScale(d.count);
        d3.select(this)
          .transition("node-hover")
          .duration(HOVER_TRANSITION_DURATION)
          .attr("r", currentRadius * 1.2)
          .attr("opacity", 1);

        const connectedLinks = dataLinks.filter((link) =>
          isLinkConnectedToNode(link, d.id),
        );
        const localMax = d3.max(connectedLinks, (link) => link.value) ?? 0;

        linkSel
          .transition()
          .duration(HOVER_TRANSITION_DURATION)
          .attr("stroke", (link) => {
            return isLinkConnectedToNode(link, d.id)
              ? linkHighlightColorScale(link.value)
              : "var(--color-border)";
          })
          .attr("stroke-opacity", (link) => {
            if (!isLinkConnectedToNode(link, d.id)) {
              return linkOpacityScale(link.value) * 0.25;
            }

            if (localMax <= 0) {
              return 1;
            }

            const relativeStrength = link.value / localMax;

            return d3.interpolateNumber(
              LINK_OPACITY_RANGE[0],
              1,
            )(relativeStrength);
          })
          .attr("stroke-width", (link) => {
            const baseWidth = linkWidthScale(link.value);

            if (!isLinkConnectedToNode(link, d.id)) {
              return baseWidth * 0.6;
            }

            if (localMax <= 0) {
              return Math.max(baseWidth, LINK_WIDTH_RANGE[1]);
            }

            const relativeStrength = link.value / localMax;
            const normalizedWidth = d3.interpolateNumber(
              LINK_WIDTH_RANGE[0],
              LINK_WIDTH_RANGE[1] * 1.2,
            )(relativeStrength);

            return Math.max(baseWidth, normalizedWidth);
          });
      })
      .on("mousemove", (event: MouseEvent) => {
        const container = containerRef.current;
        const bbox = container?.getBoundingClientRect();
        const pointerX = event.clientX - (bbox?.left ?? 0) + 15;
        const pointerY = event.clientY - (bbox?.top ?? 0) - 10;
        setHoveredNode((prev) =>
          prev ? { ...prev, x: pointerX, y: pointerY } : null,
        );
      })
      .on("mouseleave", function () {
        setHoveredNode(null);

        // Reset ALL nodes to their default radius to handle any transition interruptions
        nodeSel
          .transition("node-hover")
          .duration(HOVER_TRANSITION_DURATION)
          .attr("r", (n) => nodeSizeScale(n.count))
          .attr("opacity", 1);

        linkSel
          .transition()
          .duration(HOVER_TRANSITION_DURATION)
          .attr("stroke", "var(--color-border)")
          .attr("stroke-opacity", (link) => linkOpacityScale(link.value))
          .attr("stroke-width", (link) => linkWidthScale(link.value));
      });

    const labelSel = labelLayer
      .selectAll<SVGTextElement, GenreNodeDatum>("text")
      .data(dataNodes, (d) => d.id)
      .join("text")
      .text((d) => d.id)
      .attr("font-size", 11)
      .attr("font-weight", 600)
      .attr("dy", 4)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--color-foreground)")
      .attr("pointer-events", "none")
      .attr("class", "select-none");

    // Build a map from node id to node for quick lookups
    const nodeById = new Map(dataNodes.map((n) => [n.id, n]));

    // Create the standard forceLink - this handles visual link updates
    // Strength is based on the mutual dependency percentage
    const linkForce = d3
      .forceLink<GenreNodeDatum, GenreLinkDatum>(dataLinks)
      .id((d) => d.id)
      .distance(LINK_DISTANCE)
      .strength((d) => {
        const source =
          typeof d.source === "string" ? nodeById.get(d.source) : d.source;
        const target =
          typeof d.target === "string" ? nodeById.get(d.target) : d.target;
        if (!source || !target) return SYMMETRIC_LINK_STRENGTH * 0.1;

        // Use minimum percentage - the weaker side's dependency
        // This is already 0-1 normalized
        const sourcePercentage = d.value / source.count;
        const targetPercentage = d.value / target.count;
        const percentage = Math.max(sourcePercentage, targetPercentage);

        // Scale by the constant (minPercentage is 0-1, result is 0 to SYMMETRIC_LINK_STRENGTH)
        return SYMMETRIC_LINK_STRENGTH * percentage;
      });

    const simulation = d3
      .forceSimulation<GenreNodeDatum>(dataNodes)
      .velocityDecay(VELOCITY_DECAY)
      .alphaDecay(ALPHA_DECAY)
      .force("link", linkForce)
      .force(
        "charge",
        d3
          .forceManyBody()
          .strength(CHARGE_STRENGTH)
          .distanceMax(CHARGE_MAX_DISTANCE),
      )
      .force(
        "center",
        d3.forceCenter(width / 2, height / 2).strength(CENTER_STRENGTH),
      )
      .force(
        "collide",
        d3
          .forceCollide<GenreNodeDatum>()
          .radius((d) => nodeSizeScale(d.count) + NODE_COLLISION_PADDING)
          .strength(COLLISION_STRENGTH)
          .iterations(2),
      )
      .on("tick", () => {
        linkSel
          .attr("x1", (d) =>
            typeof d.source === "string" ? 0 : (d.source.x ?? 0),
          )
          .attr("y1", (d) =>
            typeof d.source === "string" ? 0 : (d.source.y ?? 0),
          )
          .attr("x2", (d) =>
            typeof d.target === "string" ? 0 : (d.target.x ?? 0),
          )
          .attr("y2", (d) =>
            typeof d.target === "string" ? 0 : (d.target.y ?? 0),
          );

        nodeSel.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);

        labelSel
          .attr("x", (d) => d.x ?? 0)
          .attr("y", (d) => (d.y ?? 0) + nodeSizeScale(d.count) + 14);
      });

    const dragBehavior = d3
      .drag<SVGCircleElement, GenreNodeDatum>()
      .on("start", (event, d) => {
        svg.style("cursor", "grabbing");
        if (!event.active) simulation.alphaTarget(0.5).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
        // Keep simulation warm during drag for responsive feel
        simulation.alpha(0.5);
      })
      .on("end", (event, d) => {
        svg.style("cursor", "grab");
        if (!event.active) simulation.alphaTarget(0);
        // Release the node to let it settle naturally with inertia
        d.fx = null;
        d.fy = null;
        // Give a small kick to let physics settle smoothly
        simulation.alpha(0.3).restart();
      });

    nodeSel.call(dragBehavior);
    simulation.alpha(1).restart();

    // Store simulation ref for reset functionality
    simulationRef.current = simulation;

    return () => {
      simulation.stop();
      svg.on(".zoom", null);
    };
  }, [dataNodes, dataLinks, dimensions, handleNodeClick]);

  useEffect(() => {
    if (!gRef.current) return;
    const g = d3.select(gRef.current);
    g.selectAll<SVGCircleElement, GenreNodeDatum>("circle")
      .transition()
      .duration(200)
      .attr("stroke", (d) =>
        selectedGenres.includes(d.id)
          ? "var(--color-primary)"
          : "var(--color-card)",
      )
      .attr("stroke-width", (d) => (selectedGenres.includes(d.id) ? 4 : 2));
  }, [selectedGenres]);

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
      {/* Selected Genres Display */}
      {selectedGenres.length > 0 && (
        <Card className="absolute top-4 left-1/2 -translate-x-1/2 z-30 max-w-2xl bg-black/40 backdrop-blur-md border-white/10">
          <CardBody className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-gray-400">
                Selected:
              </span>
              {selectedGenres.map((genre) => (
                <Chip
                  className="cursor-pointer"
                  color="secondary"
                  key={genre}
                  onClose={() => {
                    handleRemoveGenre(genre);
                  }}
                  size="sm"
                  variant="flat"
                >
                  {genre}
                </Chip>
              ))}
              <button
                className="text-xs text-gray-500 hover:text-white transition-colors ml-1 px-2 py-1 rounded hover:bg-white/10"
                onClick={handleClearSelection}
                type="button"
              >
                Clear all
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      <svg
        aria-label="Genre Network Visualization"
        className="w-full h-full"
        ref={svgRef}
        role="img"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      >
        <g ref={gRef} />
      </svg>

      {hoveredLink && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute z-20 rounded-xl px-4 py-3 text-xs shadow-2xl backdrop-blur-md"
          style={{
            background: "rgba(0, 0, 0, 0.85)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "white",
            left: Math.min(hoveredLink.x, Math.max(0, dimensions.width - 260)),
            top: Math.min(hoveredLink.y, Math.max(0, dimensions.height - 140)),
          }}
        >
          <div className="font-semibold mb-3 text-sm text-purple-300">
            {hoveredLink.source} & {hoveredLink.target}
          </div>
          <div className="space-y-2 text-[11px]">
            <div className="pb-2 border-b border-white/10">
              <span className="text-gray-400">Movies with both genres: </span>
              <span className="font-semibold text-white">
                {hoveredLink.value.toLocaleString()}
              </span>
            </div>
            {hoveredLink.sourceCount > 0 && (
              <div>
                <span className="text-gray-400">
                  Of all{" "}
                  <span className="text-purple-300">{hoveredLink.source}</span>{" "}
                  movies,{" "}
                </span>
                <span className="font-medium text-indigo-300">
                  {(
                    (hoveredLink.value / hoveredLink.sourceCount) *
                    100
                  ).toFixed(1)}
                  %
                </span>
                <span className="text-gray-400"> also have </span>
                <span className="text-purple-300">{hoveredLink.target}</span>
              </div>
            )}
            {hoveredLink.targetCount > 0 && (
              <div>
                <span className="text-gray-400">
                  Of all{" "}
                  <span className="text-purple-300">{hoveredLink.target}</span>{" "}
                  movies,{" "}
                </span>
                <span className="font-medium text-indigo-300">
                  {(
                    (hoveredLink.value / hoveredLink.targetCount) *
                    100
                  ).toFixed(1)}
                  %
                </span>
                <span className="text-gray-400"> also have </span>
                <span className="text-purple-300">{hoveredLink.source}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Node Hover Tooltip */}
      {hoveredNode && (
        <Card
          className="pointer-events-none absolute z-40 bg-black/80 backdrop-blur-md border-white/10"
          style={{
            left: Math.min(hoveredNode.x, dimensions.width - 180),
            top: Math.min(hoveredNode.y, dimensions.height - 100),
          }}
        >
          <CardBody className="p-3">
            <p className="font-semibold text-sm text-white">{hoveredNode.id}</p>
            <div className="flex items-center gap-2 mt-2">
              <Chip color="primary" size="sm" variant="flat">
                {hoveredNode.count.toLocaleString()} movies
              </Chip>
              {hoveredNode.avgRating && (
                <Chip color="warning" size="sm" variant="flat">
                  ★ {hoveredNode.avgRating.toFixed(2)}
                </Chip>
              )}
            </div>
            <p className="text-[10px] text-gray-500 mt-2">
              Click to filter by this genre
            </p>
          </CardBody>
        </Card>
      )}

      {useRatingColorScale && ratingExtent[0] && ratingExtent[1] && (
        <Card className="pointer-events-none absolute bottom-4 left-4 bg-black/40 backdrop-blur-md border-white/10">
          <CardBody className="p-4">
            <p className="text-xs text-gray-300 mb-2 font-medium">
              Avg. Movie Rating
            </p>
            <div
              className="w-32 h-3 rounded-full overflow-hidden"
              style={{
                background: `linear-gradient(to right, ${d3.interpolatePRGn(
                  0,
                )}, ${d3.interpolatePRGn(0.5)}, ${d3.interpolatePRGn(1)})`,
              }}
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1.5 px-0.5">
              <span>{ratingExtent[0].toFixed(2)}</span>
              <span>{ratingExtent[1].toFixed(2)}</span>
            </div>
          </CardBody>
        </Card>
      )}

      {dataNodes.length > 0 && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <button
            className="p-2 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 hover:border-white/30 text-gray-400 hover:text-white transition-colors"
            onClick={handleResetView}
            title="Reset view"
            type="button"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <HelpTooltip
            description="Discover how movie genres relate to each other. Larger nodes represent more popular genres. Thicker connections mean genres appear together more often."
            interactions={[
              { icon: "👆", text: "Click a genre to filter movies" },
              { icon: "✋", text: "Drag nodes to rearrange" },
              { icon: "🔍", text: "Scroll to zoom in/out" },
              { icon: "🖐️", text: "Drag empty space to pan" },
            ]}
            title="Genre Network"
          />
        </div>
      )}

      {dataNodes.length === 0 && (
        <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-md border-white/10">
          <CardBody className="p-8 text-center">
            <div className="text-4xl mb-4">🕸️</div>
            <p className="text-sm text-gray-400">
              No genre data available to visualize
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
