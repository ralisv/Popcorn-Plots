from .loaders import MovieLens32M, Imdb
import polars as pl


def postprocess_movielens(data: MovieLens32M) -> pl.DataFrame:
    ratings = (
        data.ratings.join(data.links, on="movieId", how="left")
        .drop("movieId", "tmdbId", "userId")
        .with_columns(
            pl.col("imdbId").cast(pl.UInt32),  # i64 -> u32
            pl.col("timestamp")
            .mul(1000)
            .cast(pl.Datetime("ms"))
            .dt.truncate("1w")
            .cast(pl.Date),  # i64 -> date (truncated to week)
        )
        .rename({"timestamp": "date"})
        .group_by("imdbId", "date")
        .agg(
            pl.col("rating").mean().mul(10).cast(pl.UInt8),  # average rating -> u8
        )
    )

    return ratings


def postprocess_imdb(data: Imdb) -> pl.DataFrame:
    excluded_genres = {
        "Adult",
        "Film-Noir",
        "Game-Show",
        "Music",
        "News",
        "Reality-TV",
        "Short",
        "Talk-Show",
    }

    with pl.StringCache():
        title_basics = (
            data.title_basics.drop_nulls("genres")
            .rename({"primaryTitle": "title", "tconst": "id", "startYear": "year"})
            .with_columns(
                pl.col("id").str.replace("tt", "").cast(pl.UInt32),  # str -> u32
                pl.col("year").cast(pl.UInt16),  # i64 -> u16
                pl.col("runtimeMinutes").cast(pl.UInt32),  # i64 -> u32
                pl.col("genres")
                .str.split(",")
                .cast(pl.List(pl.Categorical))
                .list.set_difference(
                    excluded_genres
                ),  # str -> list[cat], remove excluded
            )
            .filter(
                pl.col("titleType").is_in({"movie", "tvMovie"}),
                pl.col("genres").list.len() != 0,
            )
            .drop("endYear", "isAdult", "originalTitle", "titleType")
        )

    return title_basics
