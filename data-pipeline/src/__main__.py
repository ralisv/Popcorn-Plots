#!/usr/bin/env python3

from pathlib import Path
from typing import Final

import humanize
import polars as pl

from .loaders import load_imdb, load_movie_lens_32m
from .postprocess import postprocess_imdb, postprocess_movielens


OUT_DIR: Final = Path(__file__).parent.parent / "out"


def _write_parquet(df: pl.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    df.write_parquet(
        path, compression="zstd", statistics=False, row_group_size=1_000_000
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

    percentile = 0.75
    rating_counts = ratings_filtered.group_by("imdbId").agg(pl.len().alias("count"))
    min_count_threshold = rating_counts.select(
        pl.col("count").quantile(percentile).alias("threshold")
    ).item()
    print(
        f"Minimum rating count threshold ({percentile * 100}th percentile): {min_count_threshold}"
    )

    movies_above_threshold = rating_counts.filter(
        pl.col("count") >= min_count_threshold
    ).select("imdbId")

    ratings_filtered = ratings_filtered.join(
        movies_above_threshold, on="imdbId", how="semi"
    )
    title_basics_filtered = title_basics_filtered.join(
        movies_above_threshold.select(pl.col("imdbId").alias("id")), on="id", how="semi"
    )

    print("Details of the final ratings dataset:")
    print(ratings_filtered)

    print("Details of the final title_basics dataset:")
    print(title_basics_filtered)

    print("Writing ratings.parquet...")
    ratings_path = OUT_DIR / "ratings.parquet"
    _write_parquet(ratings_filtered, ratings_path)

    print("Writing title_basics.parquet...")
    title_basics_path = OUT_DIR / "title_basics.parquet"
    _write_parquet(title_basics_filtered, title_basics_path)

    print(
        "ratings.parquet:",
        humanize.naturalsize(ratings_path.stat().st_size, binary=True),
    )
    print(
        "title_basics.parquet:",
        humanize.naturalsize(title_basics_path.stat().st_size, binary=True),
    )


if __name__ == "__main__":
    main()
