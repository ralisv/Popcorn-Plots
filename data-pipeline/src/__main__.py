#!/usr/bin/env python3

from pathlib import Path
from typing import Final
import polars as pl

from .loaders import load_imdb, load_movie_lens_32m
from .postprocess import postprocess_imdb, postprocess_movielens


OUT_DIR: Final = Path(__file__).parent.parent / "out"


def _write_parquet(df: pl.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    df.write_parquet(
        path,
        compression="zstd",
        compression_level=22,
        statistics=False,
        row_group_size=1_000_000,
    )


def main() -> None:
    print("Loading MovieLens 32M dataset...")
    ml32m = load_movie_lens_32m()

    print("Loading IMDb dataset...")
    imdb = load_imdb()

    print("Postprocessing MovieLens 32M dataset...")
    ratings = postprocess_movielens(ml32m)

    print("Postprocessing IMDb dataset...")
    title_basics = postprocess_imdb(imdb)

    ratings_filtered = ratings.join(
        title_basics.select(pl.col("id").alias("imdbId")).unique(),
        on="imdbId",
        how="semi",
    )
    print(f"Filtered ratings: {ratings.shape[0]} -> {ratings_filtered.shape[0]}")

    title_basics_filtered = title_basics.join(
        ratings_filtered.select(pl.col("imdbId").alias("id")).unique(),
        on="id",
        how="semi",
    )
    print(
        f"Filtered title_basics: {title_basics.shape[0]} -> {title_basics_filtered.shape[0]}"
    )

    print("Writing ratings.parquet...")
    _write_parquet(ratings, OUT_DIR / "ratings.parquet")

    print("Writing title_basics.parquet...")
    _write_parquet(title_basics, OUT_DIR / "title_basics.parquet")


if __name__ == "__main__":
    main()
