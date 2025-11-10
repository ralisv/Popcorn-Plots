import { Card, CardBody } from "@heroui/react";
import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";

// --- Simulation Constants ---

/** The minimum and maximum width of the links between genres. */
const LINK_WIDTH_RANGE: [number, number] = [1, 10];

/** The minimum and maximum opacity for links. */
const LINK_OPACITY_RANGE: [number, number] = [0.2, 0.8];

/** The minimum and maximum strength of the links' gravitational pull. */
const LINK_STRENGTH_RANGE: [number, number] = [0.05, 1];

/** The strength of the charge force between nodes. A negative value pushes nodes apart. */
const NODE_CHARGE_STRENGTH = -800;

/** The target distance between linked nodes. */
const LINK_DISTANCE = 120;

/** The padding around each node to prevent overlapping. */
const NODE_COLLISION_PADDING = 10;

/** The minimum and maximum radius of the nodes. */
const NODE_SIZE_RANGE: [number, number] = [12, 40];

/** The minimum and maximum zoom level. */
const ZOOM_EXTENT: [number, number] = [0.1, 8];

/** The alpha target for the simulation when a node is being dragged. */
const DRAG_ALPHA_TARGET = 0.3;

/** The duration of the hover transition in milliseconds. */
const HOVER_TRANSITION_DURATION = 300;

export interface SociogramProps {
  className?: string;
  links?: GenreLinkDatum[];
  nodes?: GenreNodeDatum[];
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
  target: string;
  value: number;
  x: number;
  y: number;
};

export function Sociogram({
  className,
  links,
  nodes,
}: SociogramProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<null | SVGSVGElement>(null);
  const gRef = useRef<null | SVGGElement>(null);
  const [dimensions, setDimensions] = useState({ height: 0, width: 0 });
  const [hoveredLink, setHoveredLink] = useState<HoveredLinkState>(null);

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
    if (dataNodes.length === 0) return; // Don't render if no data

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
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", event.transform.toString());
      });

    svg.call(zoomBehavior);

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

    // Scale for link width based on connection strength
    const linkWidthScale = d3
      .scaleLinear()
      .domain([0, maxLinkValue])
      .range(LINK_WIDTH_RANGE);

    // Scale for link strength based on connection value
    const linkStrengthScale = d3
      .scaleLinear()
      .domain([0, maxLinkValue])
      .range(LINK_STRENGTH_RANGE);

    // Scale for highlighted link color based on connection strength
    const linkHighlightColorScale = d3
      .scaleLinear<string>()
      .domain([0, maxLinkValue])
      .range(["gray", "lightgray"]);

    const linkOpacityScale = d3
      .scaleLinear()
      .domain([0, maxLinkValue])
      .range(LINK_OPACITY_RANGE);

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

        // Bring hovered link to front and highlight it
        d3.select(event.currentTarget as SVGLineElement)
          .raise()
          .transition()
          .duration(HOVER_TRANSITION_DURATION)
          .attr("stroke", "var(--color-foreground)")
          .attr("stroke-opacity", 1)
          .attr("stroke-width", Math.max(linkWidthScale(d.value) * 1.6, 2));

        // De-emphasize other links
        linkSel
          .filter((l) => l !== d)
          .transition()
          .duration(HOVER_TRANSITION_DURATION)
          .attr("stroke", "var(--color-border)")
          .attr("stroke-opacity", (l) => linkOpacityScale(l.value) * 0.25)
          .attr("stroke-width", (l) => linkWidthScale(l.value) * 0.7);

        // Subtly accent connected nodes and deemphasize others
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
          target: tgt,
          value: d.value,
          x: pointerX,
          y: pointerY,
        });
      })
      .on("mousemove", (event: MouseEvent, d) => {
        const container = containerRef.current;
        const bbox = container?.getBoundingClientRect();
        const pointerX = event.clientX - (bbox?.left ?? 0) + 12;
        const pointerY = event.clientY - (bbox?.top ?? 0) + 12;
        setHoveredLink((prev) =>
          prev
            ? { ...prev, x: pointerX, y: pointerY }
            : {
                source: getNodeId(d.source),
                target: getNodeId(d.target),
                value: d.value,
                x: pointerX,
                y: pointerY,
              },
        );
      })
      .on("mouseleave", () => {
        // Restore link appearance
        linkSel
          .transition()
          .duration(HOVER_TRANSITION_DURATION)
          .attr("stroke", "var(--color-border)")
          .attr("stroke-opacity", (l) => linkOpacityScale(l.value))
          .attr("stroke-width", (l) => linkWidthScale(l.value));

        // Restore nodes
        nodeSel
          .transition()
          .duration(HOVER_TRANSITION_DURATION)
          .attr("stroke", "var(--color-card)")
          .attr("stroke-width", 2)
          .attr("opacity", 1);

        setHoveredLink(null);
      });

    // Scale for node size based on movie count
    const nodeSizeScale = d3
      .scaleSqrt()
      .domain([0, d3.max(dataNodes, (d) => d.count) ?? 1])
      .range(NODE_SIZE_RANGE);

    // Color scale based on average rating
    const ratingColorScale = d3
      .scaleSequential(d3.interpolateRdYlGn)
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
      .attr("stroke", "var(--color-card)")
      .attr("stroke-width", 2)
      .attr("class", "transition-all duration-200 ease-out cursor-pointer")
      .on("mouseenter", function (_event, d) {
        // Enlarge the hovered node
        const currentRadius = nodeSizeScale(d.count);
        d3.select(this)
          .transition()
          .duration(HOVER_TRANSITION_DURATION)
          .attr("r", currentRadius * 1.2)
          .attr("opacity", 1); // Ensure hovered node is fully opaque

        // Highlight connected links
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
      .on("mouseleave", function (_event, d) {
        // Restore node size
        d3.select(this)
          .transition()
          .duration(HOVER_TRANSITION_DURATION)
          .attr("r", nodeSizeScale(d.count));

        // Restore link appearance
        linkSel
          .transition()
          .duration(HOVER_TRANSITION_DURATION)
          .attr("stroke", "var(--color-border)")
          .attr("stroke-opacity", (link) => linkOpacityScale(link.value))
          .attr("stroke-width", (link) => linkWidthScale(link.value));
      });

    // Add tooltips on hover
    nodeSel
      .append("title")
      .text(
        (d) =>
          `${d.id}\nMovies: ${d.count}${
            d.avgRating ? `\nAvg Rating: ${d.avgRating.toFixed(2)}` : ""
          }`,
      );

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

    const simulation = d3
      .forceSimulation<GenreNodeDatum>(dataNodes)
      .force(
        "link",
        d3
          .forceLink<GenreNodeDatum, GenreLinkDatum>(dataLinks)
          .id((d) => d.id)
          .distance(LINK_DISTANCE)
          .strength((d) => linkStrengthScale(d.value)),
      )
      .force("charge", d3.forceManyBody().strength(NODE_CHARGE_STRENGTH))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3
          .forceCollide<GenreNodeDatum>()
          .radius((d) => nodeSizeScale(d.count) + NODE_COLLISION_PADDING),
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
        if (!event.active) simulation.alphaTarget(DRAG_ALPHA_TARGET).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeSel.call(dragBehavior);
    simulation.alpha(1).restart();

    return () => {
      simulation.stop();
      svg.on(".zoom", null);
    };
  }, [dataNodes, dataLinks, dimensions]);

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
          className="pointer-events-none absolute z-20 rounded-md border px-2 py-1 text-xs shadow"
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-border)",
            color: "var(--color-foreground)",
            left: Math.min(hoveredLink.x, Math.max(0, dimensions.width - 180)),
            top: Math.min(hoveredLink.y, Math.max(0, dimensions.height - 80)),
          }}
        >
          <div className="font-semibold mb-0.5">
            {hoveredLink.source} ↔ {hoveredLink.target}
          </div>
          <div>Co-occurrence: {hoveredLink.value}</div>
        </div>
      )}

      {useRatingColorScale && ratingExtent[0] && ratingExtent[1] && (
        <Card className="pointer-events-none absolute bottom-4 left-4">
          <CardBody className="p-3">
            <p className="text-xs mb-2">Avg. Movie Rating</p>
            <div
              className="w-full h-4 rounded-sm"
              style={{
                background: `linear-gradient(to right, ${d3.interpolateRdYlGn(
                  0,
                )}, ${d3.interpolateRdYlGn(0.5)}, ${d3.interpolateRdYlGn(1)})`,
              }}
            />
            <div className="flex justify-between text-xs mt-1">
              <span>{ratingExtent[0].toFixed(2)}</span>
              <span>{ratingExtent[1].toFixed(2)}</span>
            </div>
          </CardBody>
        </Card>
      )}

      {dataNodes.length > 0 && (
        <Card className="pointer-events-none absolute bottom-4 right-4">
          <CardBody className="p-3">
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li>Node size = number of movies</li>
              <li>Link width = co-occurrence frequency</li>
              <li>Drag nodes to pin</li>
              <li>Scroll to zoom, drag to pan</li>
            </ul>
          </CardBody>
        </Card>
      )}

      {dataNodes.length === 0 && (
        <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <CardBody className="p-6 text-center">
            <p className="text-sm text-gray-500">
              No genre data available to visualize
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
