/**
 * Converts a full name into a display name format (e.g., "John Doe" -> "J. Doe").
 *
 * @param fullName - The full name to convert.
 * @returns The display name composed of the first initial and last name.
 */
export function fullNameToDisplayName(fullName: string): string {
  const [firstName, lastName] = fullName.split(" ");

  return `${firstName.charAt(0)}. ${lastName}`;
}

export function imdbTitleUrl(imdbId: number): string {
  const paddedId = imdbId.toString().padStart(7, "0");
  return `https://www.imdb.com/title/tt${paddedId}/`;
}
