import { Card, CardBody } from "@heroui/react";
import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";

export interface SociogramProps {
  className?: string;
  links?: LinkDatum[];
  nodes?: NodeDatum[];
}

interface LinkDatum extends d3.SimulationLinkDatum<NodeDatum> {
  source: NodeDatum | string;
  target: NodeDatum | string;
  value: number;
}

interface NodeDatum extends d3.SimulationNodeDatum {
  group: number;
  id: string;
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
    const fallbackNodes: NodeDatum[] = [
      { group: 1, id: "Alice" },
      { group: 2, id: "Bob" },
      { group: 1, id: "Carol" },
      { group: 3, id: "David" },
      { group: 2, id: "Eve" },
      { group: 3, id: "Frank" },
      { group: 1, id: "Grace" },
      { group: 2, id: "Heidi" },
      { group: 3, id: "Ivan" },
      { group: 1, id: "Judy" },
    ];
    const fallbackLinks: LinkDatum[] = [
      { source: "Alice", target: "Bob", value: 2 },
      { source: "Alice", target: "Carol", value: 5 },
      { source: "Bob", target: "David", value: 1 },
      { source: "Carol", target: "Eve", value: 3 },
      { source: "David", target: "Frank", value: 1 },
      { source: "Eve", target: "Grace", value: 4 },
      { source: "Frank", target: "Alice", value: 1 },
      { source: "Grace", target: "Heidi", value: 2 },
      { source: "Heidi", target: "Ivan", value: 1 },
      { source: "Ivan", target: "Judy", value: 3 },
      { source: "Judy", target: "Alice", value: 2 },
    ];
    return {
      dataLinks: (links ?? fallbackLinks).map((l) => ({ ...l })),
      dataNodes: (nodes ?? fallbackNodes).map((n) => ({ ...n })),
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

    const linkSel = linkLayer
      .selectAll<SVGLineElement, LinkDatum>("line")
      .data(
        dataLinks,
        ({ source, target }) =>
          `${typeof source === "string" ? source : source.id}-${typeof target === "string" ? target : target.id}`,
      )
      .join("line")
      .attr("stroke", "var(--color-border)")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => Math.max(1, Math.sqrt(d.value)));

    const nodeSel = nodeLayer
      .selectAll<SVGCircleElement, NodeDatum>("circle")
      .data(dataNodes, (d) => d.id)
      .join("circle")
      .attr("r", 18)
      .attr(
        "fill",
        (d) =>
          chartColors[(d.group - 1) % chartColors.length] ??
          "var(--color-accent)",
      )
      .attr("stroke", "var(--color-card)")
      .attr("stroke-width", 1.5)
      .attr("class", "transition-all duration-200 ease-out")
      .on("mouseenter", function () {
        d3.select(this).attr("r", 22);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("r", 18);
      });

    const labelSel = labelLayer
      .selectAll<SVGTextElement, NodeDatum>("text")
      .data(dataNodes, (d) => d.id)
      .join("text")
      .text((d) => d.id)
      .attr("font-size", 12)
      .attr("dy", 4)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--color-foreground)")
      .attr("pointer-events", "none");

    const simulation = d3
      .forceSimulation<NodeDatum>(dataNodes)
      .force(
        "link",
        d3
          .forceLink<NodeDatum, LinkDatum>(dataLinks)
          .id((d) => d.id)
          .distance(110)
          .strength(0.6),
      )
      .force("charge", d3.forceManyBody().strength(-320))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<NodeDatum>().radius(28))
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

        labelSel.attr("x", (d) => d.x ?? 0).attr("y", (d) => (d.y ?? 0) + 26);
      });

    const dragBehavior = d3
      .drag<SVGCircleElement, NodeDatum>()
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
        aria-label="Sociogram"
        className="w-full h-full"
        ref={svgRef}
        role="img"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      >
        <g ref={gRef} />
      </svg>

      <Card className="pointer-events-none absolute bottom-4 right-4">
        <CardBody className="p-3">
          <ul className="space-y-1 text-xs list-disc list-inside">
            <li>Drag nodes to pin</li>
            <li>Scroll to zoom</li>
            <li>Drag empty space to pan</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
