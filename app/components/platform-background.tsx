/**
 * Decorative backdrop shared by login and authenticated app shell.
 */
export function PlatformBackground() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_50%_-10%,oklch(0.7_0.12_255/0.2),transparent)] dark:bg-[radial-gradient(900px_500px_at_50%_-10%,oklch(0.45_0.15_255/0.18),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_400px_at_100%_100%,oklch(0.75_0.1_200/0.12),transparent)] dark:bg-[radial-gradient(500px_400px_at_100%_100%,oklch(0.4_0.08_200/0.15),transparent)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-size-[2.5rem_2.5rem] bg-[linear-gradient(to_right,oklch(0.5_0.02_260/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.5_0.02_260/0.04)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,oklch(1_0_0/0.03)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.03)_1px,transparent_1px)]"
        aria-hidden
      />
    </>
  );
}
