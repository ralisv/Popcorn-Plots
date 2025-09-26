{
  description = "A Nix flake for a Python data visualization environment on NixOS";

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
      # The development shell for the specified system
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = [
          python-with-packages
        ];
      };
    };
}
