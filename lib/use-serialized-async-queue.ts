import { useCallback, useRef } from "react";

/**
 * Returns a function that runs async tasks one after another (FIFO).
 * Prevents bursts of parallel API calls that can exhaust Worker limits.
 */
export function useSerializedAsyncQueue() {
  const tailRef = useRef(Promise.resolve());

  return useCallback((task: () => Promise<void>) => {
    const next = tailRef.current.then(task).catch(() => {
      /* keep queue alive after failure */
    });
    tailRef.current = next;
    return next;
  }, []);
}
