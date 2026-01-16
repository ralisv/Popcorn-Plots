import type { DataFrame } from "danfojs";
import * as dfd from "danfojs";

export interface GenreLinkData {
  source: string;
  target: string;
  value: number;
}

export interface GenreNodeData {
  avgRating?: number;
  count: number;
  id: string;
}

/**
 * Generate nodes and links for the genre network visualization.
 * Works directly with DataFrame columns.
 */
export function getGenreNetworkData(df: DataFrame): {
  links: GenreLinkData[];
  nodes: GenreNodeData[];
} {
  const genres = df.column("genres").values as string[];
  const avgRatings = df.column("avgRating").values as number[];

  // Track genre statistics
  const genreStats = new Map<string, { count: number; totalRating: number }>();
  // Track co-occurrences between genres
  const coOccurrences = new Map<string, number>();

  for (let i = 0; i < genres.length; i++) {
    const titleGenres = genres[i].split(",");
    const avgRating = avgRatings[i];

    // Update genre statistics
    for (const genre of titleGenres) {
      const stats = genreStats.get(genre) ?? { count: 0, totalRating: 0 };
      stats.count += 1;
      stats.totalRating += avgRating;
      genreStats.set(genre, stats);
    }

    // Track co-occurrences (genres appearing together)
    for (let j = 0; j < titleGenres.length; j++) {
      for (let k = j + 1; k < titleGenres.length; k++) {
        const genre1 = titleGenres[j];
        const genre2 = titleGenres[k];
        const key =
          genre1 < genre2 ? `${genre1}|${genre2}` : `${genre2}|${genre1}`;
        coOccurrences.set(key, (coOccurrences.get(key) ?? 0) + 1);
      }
    }
  }

  // Build nodes
  const nodes: GenreNodeData[] = Array.from(genreStats.entries())
    .map(([genre, stats]) => ({
      avgRating: stats.count > 0 ? stats.totalRating / stats.count : undefined,
      count: stats.count,
      id: genre,
    }))
    .filter((node) => node.count > 0);

  // Build links
  const links: GenreLinkData[] = Array.from(coOccurrences.entries()).map(
    ([key, count]) => {
      const [source, target] = key.split("|");
      return { source, target, value: count };
    },
  );

  return { links, nodes };
}

/**
 * Join titles with ratings and compute average rating per title.
 * Returns a new DataFrame with avgRating column added.
 */
export function joinWithRatings(
  titlesDf: DataFrame,
  ratingsDf: DataFrame,
): DataFrame {
  // Aggregate ratings by imdbId using Map (faster than groupby)
  const ratingImdbIds = ratingsDf.column("imdbId").values as number[];
  const ratingValues = ratingsDf.column("rating").values as number[];

  const ratingAgg = new Map<number, { count: number; sum: number }>();
  for (let i = 0; i < ratingImdbIds.length; i++) {
    const imdbId = ratingImdbIds[i];
    const rating = ratingValues[i];
    const agg = ratingAgg.get(imdbId);
    if (agg) {
      agg.sum += rating;
      agg.count += 1;
    } else {
      ratingAgg.set(imdbId, { count: 1, sum: rating });
    }
  }

  // Extract title columns
  const ids = titlesDf.column("id").values as number[];
  const titles = titlesDf.column("title").values as string[];
  const years = titlesDf.column("year").values as number[];
  const genresCol = titlesDf.column("genres").values as string[];
  const runtimeCol = titlesDf.column("runtimeMinutes").values as number[];

  // Build filtered arrays (only titles with ratings)
  const filteredIds: number[] = [];
  const filteredTitles: string[] = [];
  const filteredYears: number[] = [];
  const filteredGenres: string[] = [];
  const filteredRuntime: number[] = [];
  const avgRatings: number[] = [];

  for (let i = 0; i < ids.length; i++) {
    const agg = ratingAgg.get(ids[i]);
    if (agg) {
      filteredIds.push(ids[i]);
      filteredTitles.push(titles[i]);
      filteredYears.push(years[i]);
      filteredGenres.push(genresCol[i]);
      filteredRuntime.push(runtimeCol[i]);
      avgRatings.push(agg.sum / agg.count);
    }
  }

  // Create new DataFrame with avgRating column
  return new dfd.DataFrame({
    avgRating: avgRatings,
    genres: filteredGenres,
    id: filteredIds,
    runtimeMinutes: filteredRuntime,
    title: filteredTitles,
    year: filteredYears,
  });
}
