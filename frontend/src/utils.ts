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

export function publicUrl(path: string | URL): URL {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(path, base);
}
