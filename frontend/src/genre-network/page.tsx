import { Sociogram } from "@/components/charts/sociogram";
import { getGenreNetworkData } from "@/data/data";

export default function GenreNetworkPage(): React.ReactElement {
  const { links, nodes } = getGenreNetworkData();

  return (
    <div className="w-full h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Genre Network</h1>
      <div className="w-full h-[calc(100vh-120px)]">
        <Sociogram links={links} nodes={nodes} />
      </div>
    </div>
  );
}
