import type { DataFrame } from "danfojs";

import { ChevronUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import packageJson from "../package.json";
import { RatingOverTimeChart } from "./components/charts/ratingOverTimeChart";
import { RatingVsTimeSinceReleaseChart, TimeSinceReleaseKPIPanel } from "./components/charts/ratingVsTimeSinceReleaseChart";
import { Sociogram } from "./components/charts/sociogram";
import { GenreKPIPanel } from "./components/GenreKPIPanel";
import { RatingKPIPanel } from "./components/KPIPanel";
import { Logo } from "./components/Logo";
import { getGenreNetworkData, joinWithRatings } from "./data/data";
import { fullNameToDisplayName } from "./utils";

export function App({
  ratingsDf,
  titlesDf,
}: {
  ratingsDf: DataFrame;
  titlesDf: DataFrame;
}): React.ReactElement {
  // Join titles with ratings, adding avgRating column
  const df = useMemo(
    () => joinWithRatings(titlesDf, ratingsDf),
    [titlesDf, ratingsDf],
  );

  // Memoize the genre network data
  const { links, nodes } = useMemo(() => getGenreNetworkData(df), [df]);

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = (): void => {
      setShowBackToTop(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTop = useCallback((): void => {
    window.scrollTo({ behavior: "smooth", top: 0 });
  }, []);

  return (
    <div
      className="flex flex-col items-center min-h-screen"
      style={{
        background:
          "radial-gradient(ellipse at top, #1e1b4b 0%, #0f0a1a 40%, #000000 100%)",
      }}
    >
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-pink-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative text-center pt-16 pb-12 px-4">
        <Logo animated className="mb-4" size="lg" />
        <h1
          className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-white via-purple-200 to-indigo-200 bg-clip-text text-transparent tracking-tight pb-1"
          style={{ fontFamily: "'Hahmlet', serif" }}
        >
          Popcorn Plots
        </h1>
        <p className="mt-4 text-lg md:text-xl text-gray-300/90">
          {packageJson.description}
        </p>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-400">
          <span>by</span>
          {packageJson.authors.map(({ name, url }, idx) => (
            <span key={name}>
              <a
                className="hover:text-purple-400 transition-colors underline decoration-gray-600 hover:decoration-purple-400"
                href={url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {fullNameToDisplayName(name)}
              </a>
              {idx < packageJson.authors.length - 1 && (
                <span className="ml-2">&</span>
              )}
            </span>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative flex-grow w-full max-w-[1500px] pl-4 pr-8 md:pl-8 md:pr-16 pb-12">
        <div className="flex flex-col gap-12 w-full">
          {/* Sociogram Section */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-grow bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
              <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
                <span className="text-2xl">🕸️</span>
                Genre Network
              </h2>
              <div className="h-px flex-grow bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
            </div>
            <div className="flex gap-6 items-stretch">
              <div className="flex-grow min-h-[400px] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-2xl shadow-purple-500/5 overflow-hidden">
                <Sociogram
                  links={links}
                  nodes={nodes}
                  onSelectedGenresChange={setSelectedGenres}
                  selectedGenres={selectedGenres}
                />
              </div>
              <div className="w-72 flex-shrink-0 hidden lg:block">
                <GenreKPIPanel
                  links={links}
                  nodes={nodes}
                  selectedGenres={selectedGenres}
                />
              </div>
            </div>
          </section>

          {/* Rating Chart Section */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-grow bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
              <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
                <span className="text-2xl">📊</span>
                Ratings Over Time
              </h2>
              <div className="h-px flex-grow bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
            </div>
            <div className="flex gap-6 items-stretch">
              <div className="flex-grow min-h-[400px] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-2xl shadow-indigo-500/5 overflow-hidden">
                <RatingOverTimeChart df={df} selectedGenres={selectedGenres} />
              </div>
              <div className="w-72 flex-shrink-0 hidden lg:block">
                <RatingKPIPanel df={df} selectedGenres={selectedGenres} />
              </div>
            </div>
          </section>

          {/* Rating vs Time Since Release Section */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-grow bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
              <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
                <span className="text-2xl">⏱️</span>
                Rating vs Time Since Release
              </h2>
              <div className="h-px flex-grow bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            </div>
            <div className="flex gap-6 items-stretch">
              <div className="flex-grow min-h-[550px] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-2xl shadow-cyan-500/5 overflow-hidden">
                <RatingVsTimeSinceReleaseChart
                  ratingsDf={ratingsDf}
                  selectedGenres={selectedGenres}
                  titlesDf={titlesDf}
                />
              </div>
              <div className="w-72 flex-shrink-0 hidden lg:block">
                <TimeSinceReleaseKPIPanel
                  ratingsDf={ratingsDf}
                  selectedGenres={selectedGenres}
                  titlesDf={titlesDf}
                />
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative w-full py-8 mt-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Logo size="sm" />
              <span>Popcorn Plots</span>
              <span className="text-gray-700">•</span>
              <span>{packageJson.description}</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                className="hover:text-purple-400 transition-colors flex items-center gap-1.5"
                href={packageJson.repository}
                rel="noopener noreferrer"
                target="_blank"
              >
                <svg
                  aria-hidden="true"
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    fillRule="evenodd"
                  />
                </svg>
                GitHub
              </a>
              <a
                className="hover:text-purple-400 transition-colors"
                href={packageJson.homepage}
                rel="noopener noreferrer"
                target="_blank"
              >
                Live Demo
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Back to Top Button */}
      <button
        aria-label="Back to top"
        className={[
          "fixed bottom-6 right-6 z-50 p-3 rounded-full",
          "bg-gray-700/80 hover:bg-gray-600 backdrop-blur-sm",
          "text-white shadow-lg shadow-black/25",
          "transition-all duration-300 ease-out",
          showBackToTop
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none",
        ].join(" ")}
        onClick={scrollToTop}
        type="button"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </div>
  );
}
