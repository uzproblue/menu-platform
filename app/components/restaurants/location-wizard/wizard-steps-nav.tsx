import clsx from "clsx";

type Step = 1 | 2 | 3 | 4;

type WizardStepsNavProps = {
  step: Step;
  steps: readonly { n: Step; label: string }[];
  ariaLabel: string;
};

export function WizardStepsNav({ step, steps, ariaLabel }: WizardStepsNavProps) {
  return (
    <nav className="mt-8 border-b border-foreground/10 pb-4" aria-label={ariaLabel}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((s) => (
          <div
            key={s.n}
            className="flex items-center gap-2"
            aria-current={step === s.n ? "step" : undefined}
          >
            <span
              className={clsx(
                "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                step === s.n
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : step > s.n
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    : "border-foreground/15 bg-foreground/5 text-foreground/50",
              )}
            >
              {step > s.n ? (
                <svg
                  className="size-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    d="M5 13l4 4L19 7"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                s.n
              )}
            </span>
            <span
              className={clsx(
                "text-xs sm:text-sm",
                step === s.n
                  ? "font-medium text-foreground"
                  : step > s.n
                    ? "text-foreground/70"
                    : "text-foreground/45",
              )}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </nav>
  );
}
