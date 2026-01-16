// Title data from title_basics.parquet
export interface Title {
  genres: string[];
  id: number;
  runtimeMinutes?: number;
  title: string;
  year: number;
}

// Title with computed average rating
export interface TitleWithRatings extends Title {
  avgRating: number;
}
