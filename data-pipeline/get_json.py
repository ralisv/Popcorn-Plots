import argparse
from datasets import process_movies_to_json

def main():
    parser = argparse.ArgumentParser(
        description="Export MovieLens movies with IMDB data to JSON"
    )
    parser.add_argument(
        "n",
        type=int,
        help="Number of movies to export"
    )
    parser.add_argument(
        "-o", "--output",
        type=str,
        default="movies_export.json",
        help="Output JSON file path (default: movies_export.json)"
    )
    
    args = parser.parse_args()
    
    process_movies_to_json(
        n=args.n,
        output_file=args.output,
    )


if __name__ == "__main__":
    main()
