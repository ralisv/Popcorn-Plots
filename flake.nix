{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};

      python-with-packages = pkgs.python3.withPackages (
        ps: with ps; [
          humanize
          ipykernel
          jupyterlab
          matplotlib
          notebook
          numpy
          pip
          polars
          pooch
          seaborn
          tqdm
        ]
      );
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = [
          python-with-packages
        ]
        ++ (with pkgs; [
          bun
          pre-commit
        ]);
      };

      shellHook = ''
        pre-commit install
      '';
    };
}
