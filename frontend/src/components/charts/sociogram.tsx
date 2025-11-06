import { Card, CardBody } from "@heroui/react";
import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";

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
  id: string; // Genre name
  count: number; // Number of movies in this genre
  avgRating?: number; // Average rating for movies in this genre
}

export function Sociogram({
  className,
  links,
  nodes,
}: SociogramProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<null | SVGSVGElement>(null);
  const gRef = useRef<null | SVGGElement>(null);
  const [dimensions, setDimensions] = useState({ height: 0, width: 0 });

  const { dataLinks, dataNodes } = useMemo(() => {
    return {
      dataLinks: (links ?? []).map((l) => ({ ...l })),
      dataNodes: (nodes ?? []).map((n) => ({ ...n })),
    };
  }, [nodes, links]);

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
      .scaleExtent([0.1, 8])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", event.transform.toString());
      });

    svg.call(zoomBehavior);

    const linkLayer = g.append("g").attr("data-layer", "links");
    const nodeLayer = g.append("g").attr("data-layer", "nodes");
    const labelLayer = g.append("g").attr("data-layer", "labels");

    // Scale for link width based on connection strength
    const linkWidthScale = d3
      .scaleLinear()
      .domain([0, d3.max(dataLinks, (d) => d.value) ?? 1])
      .range([1, 5]);

    const linkSel = linkLayer
      .selectAll<SVGLineElement, GenreLinkDatum>("line")
      .data(
        dataLinks,
        ({ source, target }) =>
          `${typeof source === "string" ? source : source.id}-${typeof target === "string" ? target : target.id}`,
      )
      .join("line")
      .attr("stroke", "var(--color-border)")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", (d) => linkWidthScale(d.value));

    // Scale for node size based on movie count
    const nodeSizeScale = d3
      .scaleSqrt()
      .domain([0, d3.max(dataNodes, (d) => d.count) ?? 1])
      .range([12, 40]);

    // Color scale based on genre name hash (for consistent colors)
    const colorScale = d3
      .scaleOrdinal<string>()
      .domain(dataNodes.map((d) => d.id))
      .range(chartColors);

    const nodeSel = nodeLayer
      .selectAll<SVGCircleElement, GenreNodeDatum>("circle")
      .data(dataNodes, (d) => d.id)
      .join("circle")
      .attr("r", (d) => nodeSizeScale(d.count))
      .attr("fill", (d) => colorScale(d.id))
      .attr("stroke", "var(--color-card)")
      .attr("stroke-width", 2)
      .attr("class", "transition-all duration-200 ease-out cursor-pointer")
      .on("mouseenter", function (event, d) {
        const currentRadius = nodeSizeScale(d.count);
        d3.select(this).attr("r", currentRadius * 1.2);
      })
      .on("mouseleave", function (event, d) {
        d3.select(this).attr("r", nodeSizeScale(d.count));
      });

    // Add tooltips on hover
    nodeSel
      .append("title")
      .text(
        (d) =>
          `${d.id}\nMovies: ${d.count}${d.avgRating ? `\nAvg Rating: ${d.avgRating.toFixed(1)}` : ""}`,
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
          .distance(120)
          .strength(0.5),
      )
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3
          .forceCollide<GenreNodeDatum>()
          .radius((d) => nodeSizeScale(d.count) + 10),
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
        if (!event.active) simulation.alphaTarget(0.3).restart();
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
