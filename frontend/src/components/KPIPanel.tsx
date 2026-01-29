import type { DataFrame } from "danfojs";

import { Card, CardBody } from "@heroui/react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";

interface RatingKPIPanelProps {
  className?: string;
  df?: DataFrame;
  selectedGenres?: string[];
}

export function RatingKPIPanel({
  className,
  df,
  selectedGenres = [],
}: RatingKPIPanelProps): React.ReactElement {
  const stats = useMemo(() => {
    if (!df) {
      return {
        avgRating: 0,
        bottomMovies: [] as { rating: number; title: string; year: number }[],
        highestRatedYear: 0,
        lowestRatedYear: 0,
        movieCount: 0,
        ratingTrend: "stable" as const,
        topMovies: [] as { rating: number; title: string; year: number }[],
        yearRange: [0, 0] as [number, number],
      };
    }

    const allGenres = df.column("genres").values as string[];
    const allYears = df.column("year").values as number[];
    const allRatings = df.column("avgRating").values as number[];
    const allTitles = df.column("title").values as string[];

    // Filter by selected genres if any
    let filteredIndices: number[] = [];
    if (selectedGenres.length === 0) {
      filteredIndices = allGenres.map((_, i) => i);
    } else {
      for (let i = 0; i < allGenres.length; i++) {
        const titleGenres = allGenres[i].split(",");
        if (selectedGenres.every((g) => titleGenres.includes(g))) {
          filteredIndices.push(i);
        }
      }
    }

    const movieCount = filteredIndices.length;
    const avgRating =
      movieCount > 0
        ? filteredIndices.reduce((sum, i) => sum + allRatings[i], 0) /
          movieCount
        : 0;

    const years = filteredIndices.map((i) => allYears[i]);
    const yearRange: [number, number] = [
      Math.min(...years, 2024),
      Math.max(...years, 1900),
    ];

    // Calculate rating by year for trend
    const ratingsByYear = new Map<number, number[]>();
    for (const i of filteredIndices) {
      const year = allYears[i];
      if (!ratingsByYear.has(year)) ratingsByYear.set(year, []);
      const yearRatings = ratingsByYear.get(year);
      if (yearRatings) yearRatings.push(allRatings[i]);
    }

    const yearAvgs = Array.from(ratingsByYear.entries())
      .map(([year, ratings]) => ({
        avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
        year,
      }))
      .sort((a, b) => a.year - b.year);

    // Find highest and lowest rated years
    let highestRatedYear = yearRange[1];
    let lowestRatedYear = yearRange[0];
    let highestAvg = 0;
    let lowestAvg = 10;
    for (const { avg, year } of yearAvgs) {
      if (avg > highestAvg) {
        highestAvg = avg;
        highestRatedYear = year;
      }
      if (avg < lowestAvg) {
        lowestAvg = avg;
        lowestRatedYear = year;
      }
    }

    // Calculate overall trend (compare first decade to last decade)
    let ratingTrend: "down" | "stable" | "up" = "stable";
    if (yearAvgs.length >= 10) {
      const firstDecade = yearAvgs.slice(0, Math.floor(yearAvgs.length / 3));
      const lastDecade = yearAvgs.slice(-Math.floor(yearAvgs.length / 3));
      const firstAvg =
        firstDecade.reduce((s, y) => s + y.avg, 0) / firstDecade.length;
      const lastAvg =
        lastDecade.reduce((s, y) => s + y.avg, 0) / lastDecade.length;
      if (lastAvg - firstAvg > 0.2) ratingTrend = "up";
      else if (firstAvg - lastAvg > 0.2) ratingTrend = "down";
    }

    // Get top and bottom rated movies
    const movieData = filteredIndices.map((i) => ({
      rating: allRatings[i],
      title: allTitles[i],
      year: allYears[i],
    }));

    const topMovies = [...movieData]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);

    const bottomMovies = [...movieData]
      .sort((a, b) => a.rating - b.rating)
      .slice(0, 3);

    return {
      avgRating,
      bottomMovies,
      highestRatedYear,
      lowestRatedYear,
      movieCount,
      ratingTrend,
      topMovies,
      yearRange,
    };
  }, [df, selectedGenres]);

  return (
    <div className={["flex flex-col gap-4", className ?? ""].join(" ")}>
      {/* Main KPI Card */}
      <Card className="bg-black/40 backdrop-blur-md border-white/10">
        <CardBody className="p-6">
          <div className="text-center mb-6">
            <div className="text-5xl font-bold text-white mb-1">
              {stats.avgRating.toFixed(2)}
              <span className="text-2xl text-yellow-400 ml-1">★</span>
            </div>
            <div className="text-sm text-gray-400">Average Rating</div>
            <div className="flex items-center justify-center gap-1 mt-2">
              {stats.ratingTrend === "up" && (
                <>
                  <TrendingUp className="text-emerald-400" size={16} />
                  <span className="text-xs text-emerald-400">Improving</span>
                </>
              )}
              {stats.ratingTrend === "down" && (
                <>
                  <TrendingDown className="text-rose-400" size={16} />
                  <span className="text-xs text-rose-400">Declining</span>
                </>
              )}
              {stats.ratingTrend === "stable" && (
                <span className="text-xs text-gray-500">Stable trend</span>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-emerald-400">
                {stats.highestRatedYear}
              </div>
              <div className="text-[10px] text-gray-400">Best Year</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-rose-400">
                {stats.lowestRatedYear}
              </div>
              <div className="text-[10px] text-gray-400">Lowest Year</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Top Rated Movies */}
      <Card className="bg-black/40 backdrop-blur-md border-white/10">
        <CardBody className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="text-emerald-400" size={18} />
            <h3 className="text-sm font-semibold text-white">Top Rated</h3>
          </div>
          <div className="space-y-2">
            {stats.topMovies.map((movie, idx) => (
              <div
                className="flex items-center justify-between p-2 rounded-lg bg-white/5"
                key={`${movie.title}-${movie.year}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-lg font-bold text-emerald-400/60 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {movie.title}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {movie.year}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <span className="text-yellow-400">★</span>
                  <span className="text-sm font-semibold text-white">
                    {movie.rating.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
            {stats.topMovies.length === 0 && (
              <div className="text-xs text-gray-500 text-center py-2">
                Not enough data
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Bottom Rated Movies */}
      <Card className="bg-black/40 backdrop-blur-md border-white/10">
        <CardBody className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="text-rose-400" size={18} />
            <h3 className="text-sm font-semibold text-white">Lowest Rated</h3>
          </div>
          <div className="space-y-2">
            {stats.bottomMovies.map((movie, idx) => (
              <div
                className="flex items-center justify-between p-2 rounded-lg bg-white/5"
                key={`${movie.title}-${movie.year}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-lg font-bold text-rose-400/60 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {movie.title}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {movie.year}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <span className="text-yellow-400">★</span>
                  <span className="text-sm font-semibold text-white">
                    {movie.rating.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
            {stats.bottomMovies.length === 0 && (
              <div className="text-xs text-gray-500 text-center py-2">
                Not enough data
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
