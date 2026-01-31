import { Autocomplete, AutocompleteItem, Button, Chip } from "@heroui/react";
import { Search, X } from "lucide-react";
import { type Key, useMemo, useState } from "react";

export interface MovieSuggestion {
  genres: string;
  rating?: number;
  title: string;
  year: number;
}

export interface SearchAutocompleteProps {
  /** Whether there's an active search to show the clear button */
  hasActiveSearch: boolean;
  /** Maximum number of suggestions to show */
  maxSuggestions?: number;
  /** Callback when search is cleared */
  onClear: () => void;
  /** Callback when search is activated (on Enter or selection) */
  onSearch: (query: string, isExactSelection: boolean) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** List of movie suggestions with metadata */
  suggestions: MovieSuggestion[];
}

export function SearchAutocomplete({
  hasActiveSearch,
  maxSuggestions = 10,
  onClear,
  onSearch,
  placeholder = "Search...",
  suggestions,
}: SearchAutocompleteProps): React.ReactElement {
  const [inputValue, setInputValue] = useState("");

  // Filter and limit suggestions based on input, with custom search at the top
  const suggestionsWithCustom = useMemo(() => {
    if (!inputValue.trim()) return [];

    const searchLower = inputValue.toLowerCase();
    const matches: (MovieSuggestion & { isCustomSearch?: boolean })[] = [];

    // Add the custom search entry at the top
    matches.push({
      genres: "",
      isCustomSearch: true,
      rating: undefined,
      title: inputValue,
      year: 0,
    });

    // Add matching movies
    for (const item of suggestions) {
      if (item.title.toLowerCase().includes(searchLower)) {
        matches.push(item);
        if (matches.length >= maxSuggestions + 1) break;
      }
    }

    return matches;
  }, [suggestions, inputValue, maxSuggestions]);

  const handleSelectionChange = (key: Key | null): void => {
    if (key !== null) {
      const keyString = String(key);
      // Check if this is the custom search entry by key
      const isCustomSearchSelection = keyString === "__custom_search__";

      // For custom search, use the input value
      // For movie selection, find the movie by matching key and use its title
      let searchTerm = inputValue;
      if (!isCustomSearchSelection) {
        const selectedMovie = suggestionsWithCustom.find(
          (item) =>
            !item.isCustomSearch && `${item.title}-${item.year}` === keyString,
        );
        searchTerm = selectedMovie ? selectedMovie.title : keyString;
      }

      setInputValue(searchTerm);
      onSearch(searchTerm, !isCustomSearchSelection);
    }
  };

  const handleInputChange = (value: string): void => {
    setInputValue(value);
  };

  const handleClear = (): void => {
    setInputValue("");
    onClear();
  };

  return (
    <div className="flex items-center gap-2">
      <Autocomplete
        allowsCustomValue
        aria-label="Search"
        classNames={{
          base: "w-64",
          listboxWrapper: "max-h-[300px]",
          popoverContent:
            "bg-black/90 backdrop-blur-md border border-white/10 p-0",
        }}
        disableSelectorIconRotation
        inputProps={{
          classNames: {
            clearButton: "hidden",
            input: "text-white text-sm placeholder:text-gray-400",
            inputWrapper:
              "bg-black/40 backdrop-blur-md border-white/10 hover:border-white/30",
          },
        }}
        inputValue={inputValue}
        menuTrigger="focus"
        onInputChange={handleInputChange}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder}
        selectorIcon={null}
        size="sm"
        startContent={<Search className="w-4 h-4 text-gray-400" />}
      >
        {suggestionsWithCustom.map((item) => (
          <AutocompleteItem
            key={
              item.isCustomSearch
                ? "__custom_search__"
                : `${item.title}-${item.year}`
            }
            textValue={item.title}
          >
            {item.isCustomSearch ? (
              <div className="flex items-center gap-2 text-sm">
                <Search className="w-4 h-4 text-gray-400" />
                <span className="text-white font-medium">
                  Search: <span className="text-gray-300">{item.title}</span>
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Chip
                    classNames={{
                      base: "h-5 flex-shrink-0",
                      content: "text-[10px] font-medium",
                    }}
                    color="secondary"
                    size="sm"
                    variant="flat"
                  >
                    {item.year}
                  </Chip>
                  <span className="text-sm font-medium text-white truncate">
                    {item.title}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 ml-2 truncate">
                  {item.genres.replace(/,/g, " • ")}
                </span>
              </div>
            )}
          </AutocompleteItem>
        ))}
      </Autocomplete>
      {hasActiveSearch && (
        <Button
          aria-label="Clear search"
          isIconOnly
          onPress={handleClear}
          size="sm"
          variant="ghost"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
