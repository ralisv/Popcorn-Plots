import { useState } from "react";
import packageJson from "../package.json";
import { RatingOverTimeChart } from "./components/charts/RatingOverTimeChart";
import { Sociogram } from "./components/charts/sociogram";
import { getGenreNetworkData, getMovies } from "./data/data";
import { fullNameToDisplayName } from "./utils";

export function App(): React.ReactElement {
  const { links, nodes } = getGenreNetworkData();
  const movies = getMovies();
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  return (
    <div
      className="flex flex-col items-center min-h-screen pt-12"
      style={{
        background:
          "radial-gradient(ellipse at center, #1f2937 0%, #000000 85%)",
      }}
    >
      <header className="text-center mb-6">
        <h1
          className="text-6xl font-bold text-white"
          style={{ fontFamily: "'Hahmlet', serif" }}
        >
          🎬 Popcorn Plots 🍿
        </h1>
        <p className="mt-4 text-gray-300 text-lg">
          {packageJson.authors
            .map(({ name }) => fullNameToDisplayName(name))
            .join(" & ")}
        </p>
        <p className="mt-2 text-gray-400 text-sm">
          Genre Network Visualization
        </p>
      </header>

      <main className="flex-grow w-full max-w-7xl px-8 pb-8">
        <div className="flex flex-col gap-8 w-full">
          <div className="h-[80vh] bg-gray-900/30 rounded-lg border border-gray-700">
            <Sociogram
              links={links}
              nodes={nodes}
              onSelectedGenresChange={setSelectedGenres}
              selectedGenres={selectedGenres}
            />
          </div>
          <div className="h-[80vh] bg-gray-900/30 rounded-lg border border-gray-700">
            <RatingOverTimeChart
              movies={movies}
              selectedGenres={selectedGenres}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
