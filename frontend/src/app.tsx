import packageJson from "../package.json";
import { Sociogram } from "./components/charts/sociogram";
import { fullNameToDisplayName } from "./utils";

export function App(): React.ReactElement {
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
      </header>


      <main className="flex-grow p-8">
        <Sociogram />
      </main>
    </div>
  );
}
