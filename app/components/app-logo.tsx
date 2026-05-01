import Link from "next/link";

type AppLogoProps = {
  href?: string;
  className?: string;
};

/** Compact mark for header / branding. */
export function AppLogo({ href = "/", className = "" }: AppLogoProps) {
  const mark = (
    <span
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-xl border border-foreground/15 bg-background/80 shadow-sm ring-1 ring-foreground/5 backdrop-blur-sm sm:size-9 ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 32 32"
        className="size-4 text-foreground sm:size-5"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8 8h6v6H8V8zm10 0h6v6h-6V8zM8 18h6v6H8v-6zm10 0h6v6h-6v-6z"
          fill="currentColor"
          opacity="0.9"
        />
      </svg>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
        {mark}
      </Link>
    );
  }

  return mark;
}
