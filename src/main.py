#!/usr/bin/env python3

from datasets import load_movie_lens_32m, load_imdb


def main() -> None:
    print("Loading MovieLens 32M dataset...")
    ml32m = load_movie_lens_32m()

    print("Ratings:")
    print(ml32m.ratings)

    print("Links:")
    print(ml32m.links)

    print("\nLoading IMDB dataset...")
    imdb = load_imdb()

    print("IMDB Title Basics:")
    print(imdb.title_basics)


if __name__ == "__main__":
    main()
