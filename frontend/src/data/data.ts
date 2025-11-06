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
