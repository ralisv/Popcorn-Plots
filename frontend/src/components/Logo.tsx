interface LogoProps {
  /** Whether to animate the logo with a bounce effect */
  animated?: boolean;
  /** Additional class names */
  className?: string;
  /** Size variant for the logo */
  size?: "lg" | "md" | "sm";
}

const sizeClasses = { lg: "text-7xl", md: "text-5xl", sm: "text-2xl" } as const;

const popcornSizeClasses = {
  lg: "text-4xl -right-3 -bottom-1",
  md: "text-2xl -right-2 -bottom-0.5",
  sm: "text-base -right-1 bottom-0",
} as const;

export function Logo({
  animated = false,
  className = "",
  size = "md",
}: LogoProps): React.ReactElement {
  return (
    <div
      className={[
        "relative inline-block",
        animated ? "animate-bounce-slow" : "",
        className,
      ].join(" ")}
    >
      <span
        aria-label="Movie camera and popcorn"
        className={sizeClasses[size]}
        role="img"
      >
        🎬
      </span>
      <span
        aria-hidden="true"
        className={["absolute", popcornSizeClasses[size]].join(" ")}
      >
        🍿
      </span>
    </div>
  );
}
