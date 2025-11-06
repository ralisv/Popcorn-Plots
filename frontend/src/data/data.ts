import moviesJson from "./data.json";
import type { MoviesData } from "./types";

export function getMovies(): MoviesData {
  return moviesJson as MoviesData;
}

export const genres: string[] = [
  "Action",
  "Adventure",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Musical",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Sport",
  "Thriller",
  "War",
  "Western",
];

export interface GenreLinkData {
  source: string;
  target: string;
  value: number;
}

// Types for the sociogram
export interface GenreNodeData {
  avgRating?: number;
  count: number;
  id: string;
}

/**
 * Generate nodes and links for the genre network visualization
 * Nodes represent genres, links represent how often genres appear together
 */
export function getGenreNetworkData(): {
  links: GenreLinkData[];
  nodes: GenreNodeData[];
} {
  const movies = getMovies();

  // Track genre statistics
  const genreStats = new Map<
    string,
    { count: number; reviewCount: number; totalRating: number }
  >();

  // Track co-occurrences between genres
  const coOccurrences = new Map<string, number>();

  // Process each movie
  movies.forEach((movie) => {
    const movieGenres = movie.genres || [];
    const avgRating = calculateAvgRating(movie.reviews);

    // Update genre statistics
    movieGenres.forEach((genre) => {
      const stats = genreStats.get(genre) || {
        count: 0,
        reviewCount: 0,
        totalRating: 0,
      };
      stats.count += 1;
      stats.totalRating += avgRating * movie.reviews.length;
      stats.reviewCount += movie.reviews.length;
      genreStats.set(genre, stats);
    });

    // Track co-occurrences (genres appearing together)
    for (let i = 0; i < movieGenres.length; i++) {
      for (let j = i + 1; j < movieGenres.length; j++) {
        const genre1 = movieGenres[i];
        const genre2 = movieGenres[j];

        // Create a consistent key (alphabetically sorted)
        const key =
          genre1 < genre2 ? `${genre1}|${genre2}` : `${genre2}|${genre1}`;

        coOccurrences.set(key, (coOccurrences.get(key) || 0) + 1);
      }
    }
  });

  // Build nodes
  const nodes: GenreNodeData[] = Array.from(genreStats.entries())
    .map(([genre, stats]) => ({
      avgRating:
        stats.reviewCount > 0
          ? stats.totalRating / stats.reviewCount
          : undefined,
      count: stats.count,
      id: genre,
    }))
    .filter((node) => node.count > 0); // Only include genres that have movies

  // Build links (only include co-occurrences above a threshold)
  const minCoOccurrence = 1; // Minimum number of movies sharing genres
  const links: GenreLinkData[] = Array.from(coOccurrences.entries())
    .filter(([, count]) => count >= minCoOccurrence)
    .map(([key, count]) => {
      const [source, target] = key.split("|");
      return { source, target, value: count };
    });

  return { links, nodes };
}

/**
 * Get genre statistics for a specific genre
 */
export function getGenreStats(genreName: string): {
  avgRating: number;
  movieCount: number;
  topMovies: { imdbId: string; rating: number; title: string }[];
} {
  const movies = getMovies();

  const genreMovies = movies.filter((movie) =>
    movie.genres?.includes(genreName),
  );

  const avgRating =
    genreMovies.length > 0
      ? genreMovies.reduce(
          (sum, movie) => sum + calculateAvgRating(movie.reviews),
          0,
        ) / genreMovies.length
      : 0;

  const topMovies = genreMovies
    .map((movie) => ({
      imdbId: movie.imdbId,
      rating: calculateAvgRating(movie.reviews),
      title: movie.title,
    }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10);

  return { avgRating, movieCount: genreMovies.length, topMovies };
}

/**
 * Get the most common genre pairs
 */
export function getTopGenrePairs(
  limit = 10,
): { count: number; genres: [string, string] }[] {
  const { links } = getGenreNetworkData();

  return links
    .map((link) => ({
      count: link.value,
      genres: [link.source, link.target] as [string, string],
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Calculate the average rating for a set of reviews
 */
function calculateAvgRating(reviews: { rating: number }[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return sum / reviews.length;
}
