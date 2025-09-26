from collections.abc import Sequence
import pathlib
from typing import Iterable, cast
import pooch  # pyright: ignore[reportMissingTypeStubs]
from dataclasses import dataclass
import polars as pl
import tqdm


@dataclass(frozen=True, kw_only=True, slots=True)
class MovieLens32M:
    links: pl.DataFrame
    movies: pl.DataFrame
    ratings: pl.DataFrame
    tags: pl.DataFrame


@dataclass(frozen=True, kw_only=True, slots=True)
class Imdb:
    title_basics: pl.DataFrame


def _get_path(file_paths: Iterable[str], name: str) -> pathlib.Path:
    return pathlib.Path(next(fp for fp in file_paths if name in fp))


def _read_csv(
    file_path: pathlib.Path,
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
        movies=_read_csv(_get_path(file_paths, "movies.csv")),
        ratings=_read_csv(_get_path(file_paths, "ratings.csv")),
        # TODO: do we even need this? if not, remove
        tags=_read_csv(_get_path(file_paths, "tags.csv")),
    )


def load_imdb() -> Imdb:
    path = pathlib.Path(
        cast(
            str,
            pooch.retrieve(  # pyright: ignore[reportUnknownMemberType]
                url="https://datasets.imdbws.com/title.basics.tsv.gz",
                known_hash="sha256:d0c128601f22cf30a071d6605c2a2b1a2a5303ad9b41fca0bbe2c3ff39d9d1e7",
                processor=pooch.Decompress(),
                progressbar=True,
            ),
        )
    )

    return Imdb(
        title_basics=_read_csv(path, separator="\t", quote_char=None, null_values=r"\N")
    )
