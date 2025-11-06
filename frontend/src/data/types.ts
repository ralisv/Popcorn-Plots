export interface Movie {
  endYear?: number;
  genres: string[];
  imdbId: string;
  reviews: MovieReview[];
  runtimeMinutes?: number;
  startYear: number;
  title: string;
  titleType: "movie" | "tvMovie";
}

export interface MovieReview {
  rating: number;
  timestamp: number;
}

export type MoviesData = Movie[];
