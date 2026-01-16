import { Card, CardBody, Progress } from "@heroui/react";
import { Activity, Link2, Sparkles, Users } from "lucide-react";
import { useMemo } from "react";

interface GenreKPIPanelProps {
  className?: string;
  links?: GenreLinkDatum[];
  nodes?: GenreNodeDatum[];
  selectedGenres?: string[];
}

interface GenreLinkDatum {
  source: GenreNodeDatum | string;
  target: GenreNodeDatum | string;
  value: number;
}

interface GenreNodeDatum {
  avgRating?: number;
  count: number;
  id: string;
}

export function GenreKPIPanel({
  className,
  links = [],
  nodes = [],
  selectedGenres: _selectedGenres = [],
}: GenreKPIPanelProps): React.ReactElement {
  const stats = useMemo(() => {
    if (nodes.length === 0) {
      return {
        avgConnections: 0,
        highestRated: [] as { genre: string; rating: number }[],
        lowestRated: [] as { genre: string; rating: number }[],
        mostConnected: [] as { connections: number; genre: string }[],
        mostPopular: [] as { count: number; genre: string }[],
        totalConnections: 0,
        totalGenres: 0,
        totalMovies: 0,
      };
    }

    const totalGenres = nodes.length;
    const totalMovies = nodes.reduce((sum, n) => sum + n.count, 0);
    const totalConnections = links.length;
    const avgConnections =
      totalGenres > 0 ? (totalConnections * 2) / totalGenres : 0;

    // Most popular genres (by movie count)
    const mostPopular = [...nodes]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((n) => ({ count: n.count, genre: n.id }));

    // Highest rated genres
    const nodesWithRatings = nodes.filter((n) => n.avgRating !== undefined);
    const highestRated = [...nodesWithRatings]
      .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
      .slice(0, 3)
      .map((n) => ({ genre: n.id, rating: n.avgRating ?? 0 }));

    const lowestRated = [...nodesWithRatings]
      .sort((a, b) => (a.avgRating ?? 0) - (b.avgRating ?? 0))
      .slice(0, 3)
      .map((n) => ({ genre: n.id, rating: n.avgRating ?? 0 }));

    // Most connected genres
    const connectionCount = new Map<string, number>();
    for (const link of links) {
      const source =
        typeof link.source === "string" ? link.source : link.source.id;
      const target =
        typeof link.target === "string" ? link.target : link.target.id;
      connectionCount.set(source, (connectionCount.get(source) ?? 0) + 1);
      connectionCount.set(target, (connectionCount.get(target) ?? 0) + 1);
    }
    const mostConnected = Array.from(connectionCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre, connections]) => ({ connections, genre }));

    return {
      avgConnections,
      highestRated,
      lowestRated,
      mostConnected,
      mostPopular,
      totalConnections,
      totalGenres,
      totalMovies,
    };
  }, [nodes, links]);

  const maxCount = Math.max(...nodes.map((n) => n.count), 1);

  return (
    <div className={["flex flex-col gap-4", className ?? ""].join(" ")}>
      {/* Most Popular Genres */}
      <Card className="bg-black/40 backdrop-blur-md border-white/10">
        <CardBody className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="text-purple-400" size={18} />
            <h3 className="text-sm font-semibold text-white">Most Popular</h3>
          </div>
          <div className="space-y-3">
            {stats.mostPopular.map((item, idx) => (
              <div key={item.genre}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-purple-400/60">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-white">
                      {item.genre}
                    </span>
                  </div>
                  <span className="text-sm text-gray-400">
                    {item.count.toLocaleString()}
                  </span>
                </div>
                <Progress
                  aria-label={`${item.genre} popularity`}
                  classNames={{
                    indicator: "bg-gradient-to-r from-purple-500 to-pink-500",
                    track: "bg-white/10",
                  }}
                  size="sm"
                  value={(item.count / maxCount) * 100}
                />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Highest Rated Genres */}
      <Card className="bg-black/40 backdrop-blur-md border-white/10">
        <CardBody className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="text-yellow-400" size={18} />
            <h3 className="text-sm font-semibold text-white">Highest Rated</h3>
          </div>
          <div className="space-y-2">
            {stats.highestRated.map((item, idx) => (
              <div
                className="flex items-center justify-between p-2 rounded-lg bg-white/5"
                key={item.genre}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-yellow-400/60">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-white">
                    {item.genre}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">★</span>
                  <span className="text-sm font-semibold text-white">
                    {item.rating.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
            {stats.highestRated.length === 0 && (
              <div className="text-xs text-gray-500 text-center py-2">
                No rating data
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Most Connected Genres */}
      <Card className="bg-black/40 backdrop-blur-md border-white/10">
        <CardBody className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="text-indigo-400" size={18} />
            <h3 className="text-sm font-semibold text-white">Most Connected</h3>
          </div>
          <div className="space-y-2">
            {stats.mostConnected.map((item, idx) => (
              <div
                className="flex items-center justify-between p-2 rounded-lg bg-white/5"
                key={item.genre}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-indigo-400/60">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-white">
                    {item.genre}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Activity className="text-indigo-400" size={14} />
                  <span className="text-sm font-semibold text-white">
                    {item.connections}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
