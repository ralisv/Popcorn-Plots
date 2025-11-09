import { useState } from "react";
import packageJson from "../package.json";
import { Sociogram } from "./components/charts/sociogram";
import { TrendlineChart } from "./components/charts/trendline-ratings";
import { getGenreNetworkData } from "./data/data";
import { fullNameToDisplayName } from "./utils";

export function App(): React.ReactElement {
  const { links, nodes } = getGenreNetworkData();
  const [selectedIds, setSelectedIds] = useState<string[]>(["Drama", "Horror"]);

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
        <div className="w-full h-[60vh] bg-gray-900/30 rounded-lg border border-gray-700">
          <Sociogram
            links={links}
            nodes={nodes}
            onSelectionChange={(ids) => {
              setSelectedIds(ids);
            }}
            selectedIds={selectedIds}
          />
        </div>
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2 text-white">
            Ratings over time
          </h2>
          <div className="w-full bg-gray-900/30 rounded-lg border border-gray-700 p-4">
            <TrendlineChart
              height={500}
              selectedGenres={selectedIds}
              width={900}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
