from collections.abc import Sequence
from pathlib import Path
from typing import Iterable, cast
import pooch  # pyright: ignore[reportMissingTypeStubs]
from dataclasses import dataclass
import polars as pl
import tqdm
import json
from typing import Any, Set
import polars as pl


@dataclass(frozen=True, kw_only=True, slots=True)
class MovieLens32M:
    links: pl.DataFrame
    ratings: pl.DataFrame


@dataclass(frozen=True, kw_only=True, slots=True)
class Imdb:
    title_basics: pl.DataFrame


def _get_path(file_paths: Iterable[str], name: str) -> Path:
    return Path(next(fp for fp in file_paths if name in fp))


def _read_csv(
    file_path: Path,
    *,
    separator: str = ",",
    quote_char: str | None = '"',
    null_values: str | Sequence[str] | None = None,
) -> pl.DataFrame:
    with file_path.open() as f:
        total_lines = sum(1 for _ in f) - 1

    reader = pl.read_csv_batched(
        file_path,
        separator=separator,
        quote_char=quote_char,
        null_values=null_values,
    )

    chunks: list[pl.DataFrame] = []

    with tqdm.tqdm(
        total=total_lines,
        desc=f"Parsing {file_path.name}",
        leave=False,
        unit=" lines",
    ) as pbar:
        while batches := reader.next_batches(1):
            for df_chunk in batches:
                chunks.append(df_chunk)
                pbar.update(df_chunk.height)

    return pl.concat(chunks)


def load_movie_lens_32m() -> MovieLens32M:
    file_paths = cast(
        Iterable[str],
        pooch.retrieve(  # pyright: ignore[reportUnknownMemberType]
            url="https://files.grouplens.org/datasets/movielens/ml-32m.zip",
            known_hash="md5:d472be332d4daa821edc399621853b57",
            processor=pooch.Unzip(),
            progressbar=True,
        ),
    )

    return MovieLens32M(
        links=_read_csv(_get_path(file_paths, "links.csv")),
        ratings=_read_csv(_get_path(file_paths, "ratings.csv")),
    )


def load_imdb() -> Imdb:
    path = Path(
        cast(
            str,
            pooch.retrieve(  # pyright: ignore[reportUnknownMemberType]
                url="https://datasets.imdbws.com/title.basics.tsv.gz",
                known_hash=None,
                processor=pooch.Decompress(),
                progressbar=True,
            ),
        )
    )

    return Imdb(
        title_basics=_read_csv(path, separator="\t", quote_char=None, null_values=r"\N")
    )

def filter_genres(genres_str: str, excluded_genres: Set[str]) -> str:
    """Remove excluded genres from a comma-separated genre string."""
    if not genres_str or genres_str == "(no genres listed)" or genres_str == "\\N":
        return genres_str
    
    genres = [g.strip() for g in genres_str.split(",")]
    filtered = [g for g in genres if g not in excluded_genres]
    return ",".join(filtered) if filtered else ""


def should_include_movie(genres_str: str, excluded_genres: Set[str], title_type: str, allowed_title_types: Set[str]) -> bool:
    """Check if movie should be included based on genres and title type."""
    if title_type not in allowed_title_types:
        return False
    
    if not genres_str or genres_str == "(no genres listed)" or genres_str == "\\N":
        genres = []
    else:
        genres = [g.strip() for g in genres_str.split(",")]
    remaining = [g for g in genres if g not in excluded_genres]
    
    return len(remaining) > 0


def process_movies_to_json(
    n: int,
    output_file: str,
) -> None:
    """
    Process MovieLens and IMDB data and export to JSON.
    
    Args:
        n: Number of movies to export
        output_file: Path to output JSON file
        excluded_genres: List of genres to exclude
    """
    excluded_genres = {"Adult", "Film-Noir", "Game-Show", "Music", "News", "Reality-TV", "Short", "Talk-Show"}
    allowed_title_types = {"movie", "tvMovie"}
    
    print("Loading MovieLens dataset...")
    ml_data = load_movie_lens_32m()
    
    print("Loading IMDB dataset...")
    imdb_data = load_imdb()
    
    print("Processing data...")
    
    # Convert MovieLens imdbId to tconst format (add "tt" prefix and zero-pad to 7 digits)
    links_converted = ml_data.links.with_columns([
        pl.concat_str([
            pl.lit("tt"),
            pl.col("imdbId").cast(pl.String).str.zfill(7)
        ]).alias("tconst")
    ])
    
    # Join MovieLens links with IMDB data on tconst
    movies_with_imdb = (
        links_converted
        .join(imdb_data.title_basics, on="tconst", how="left")
    )
    
    # Filter movies by titleType - keep only movie and tvMovie
    movies_with_imdb = movies_with_imdb.filter(
        (pl.col("titleType").is_null()) | 
        (pl.col("titleType") == "movie") | 
        (pl.col("titleType") == "tvMovie")
    )
    
    # Filter by genres and title type if excluded_set is provided
    if excluded_genres:
        movies_with_imdb = movies_with_imdb.filter(
            pl.struct(["genres", "titleType"]).map_elements(
                lambda x: should_include_movie(
                    x["genres"] if x["genres"] else "",
                    excluded_genres,
                    x["titleType"] if x["titleType"] else "",
                    allowed_title_types
                ),
                return_dtype=pl.Boolean
            )
        )
    else:
        # Still need to filter by title type even without genre filtering
        movies_with_imdb = movies_with_imdb.filter(
            pl.col("titleType").map_elements(
                lambda x: x in allowed_title_types if x and x != "\\N" else True,
                return_dtype=pl.Boolean
            )
        )
    
    # Take first n movies after filtering
    movies_with_imdb = movies_with_imdb.head(n)
    
    # Get movie IDs for fetching ratings
    movie_ids = movies_with_imdb.select("movieId").to_series()
    
    print(f"Fetching ratings for {len(movie_ids)} movies...")
    ratings = ml_data.ratings.filter(pl.col("movieId").is_in(movie_ids))

    # Build result list
    result: list[Any] = []
    
    print("Building JSON structure...")
    for row in movies_with_imdb.iter_rows(named=True):
        tconst = row.get("tconst")
        if not tconst:
            continue
        
        movie_id = row["movieId"]
        
        # Get movie ratings
        movie_ratings = ratings.filter(pl.col("movieId") == movie_id)
        reviews = []
        
        movie_ratings = movie_ratings.head(200)
        for rating_row in movie_ratings.iter_rows(named=True):
            reviews.append({
                "rating": rating_row["rating"],
                "timestamp": rating_row["timestamp"]
            })
        
        # Build movie object - prefer IMDB data when available
        genres_raw = row.get("genres", "")
        if genres_raw and genres_raw != "\\N":
            genres_list = [g.strip() for g in genres_raw.split(",")]
            # Filter out excluded genres
            if excluded_genres:
                genres_list = [g for g in genres_list if g not in excluded_genres]
        else:
            genres_list = []
        
        movie_obj = {
            "imdbId": tconst,
            "title": row.get("primaryTitle") or "",
            "startYear": row.get("startYear"),
            "endYear": row.get("endYear"),
            "runtimeMinutes": row.get("runtimeMinutes"),
            "titleType": row.get("titleType"),
            "genres": genres_list,
            "reviews": reviews
        }
        
        # Remove None values and empty strings
        movie_obj = {k: v for k, v in movie_obj.items() 
                    if v is not None and v != "" and v != "\\N"}

        result.append(movie_obj)

    # Write to JSON file
    print(f"Writing {len(result)} movies to {output_file}...")
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"Done! Exported {len(result)} movies with {len(ratings)} total reviews.")
