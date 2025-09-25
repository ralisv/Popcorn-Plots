import pathlib
from typing import Iterable, cast
import pooch  # pyright: ignore[reportMissingTypeStubs]
from dataclasses import dataclass
import pandas as pd
import tqdm


@dataclass(frozen=True, kw_only=True, slots=True)
class MovieLens32M:
    links: pd.DataFrame
    movies: pd.DataFrame
    ratings: pd.DataFrame
    tags: pd.DataFrame


@dataclass(frozen=True, kw_only=True, slots=True)
class Imdb:
    title_basics: pd.DataFrame


def _get_path(file_paths: Iterable[str], name: str) -> pathlib.Path:
    return pathlib.Path(next(fp for fp in file_paths if name in fp))


def _read_csv(
    file_path: pathlib.Path, *, chunk_size: int = 100_000, sep: str = ","
) -> pd.DataFrame:
    with file_path.open() as f:
        total_lines = sum(1 for _ in f) - 1

    chunks: list[pd.DataFrame] = []

    with tqdm.tqdm(
        total=total_lines,
        desc=f"Parsing {file_path.name}",
        leave=False,
        unit=" klines",
        unit_scale=1e-3,
    ) as pbar:
        for chunk in cast(
            pd.DataFrame,
            pd.read_csv(file_path, chunksize=chunk_size, sep=sep),  # pyright: ignore[reportUnknownMemberType]
        ):
            df_chunk = cast(pd.DataFrame, chunk)
            chunks.append(df_chunk)
            pbar.update(len(df_chunk))

    return pd.concat(chunks, ignore_index=True)


def load_movie_lens_32m() -> MovieLens32M:
    file_paths = cast(
        Iterable[str],
        pooch.retrieve(  # pyright: ignore[reportUnknownMemberType]
            url="https://files.grouplens.org/datasets/movielens/ml-32m.zip",
            known_hash="md5:d472be332d4daa821edc399621853b57",
            processor=pooch.Unzip(),  # pyright: ignore[reportUnknownMemberType]
            progressbar=True,
        ),
    )

    return MovieLens32M(
        links=_read_csv(_get_path(file_paths, "links.csv")),
        movies=_read_csv(_get_path(file_paths, "movies.csv")),
        ratings=_read_csv(_get_path(file_paths, "ratings.csv")),
        tags=_read_csv(_get_path(file_paths, "tags.csv")),
    )


def load_imdb() -> Imdb:
    path = pathlib.Path(
        cast(
            str,
            pooch.retrieve(  # pyright: ignore[reportUnknownMemberType]
                url="https://datasets.imdbws.com/title.basics.tsv.gz",
                known_hash="sha256:d0c128601f22cf30a071d6605c2a2b1a2a5303ad9b41fca0bbe2c3ff39d9d1e7",
                processor=pooch.Decompress(),  # pyright: ignore[reportUnknownMemberType]
                progressbar=True,
            ),
        )
    )

    return Imdb(title_basics=_read_csv(path, sep="\t"))
