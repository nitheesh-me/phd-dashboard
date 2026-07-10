import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, useState } from "react";
import { toast } from "sonner";

function toastError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error ?? "Unknown error");
  toast.error(msg);
}

export function AppQueryClientProvider({ children }: PropsWithChildren): JSX.Element {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            // Only show toast for background refetch failures, not first-load (no data yet)
            if (query.state.data !== undefined) toastError(error);
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            // Only toast if the mutation doesn't have its own onError handler
            if (!mutation.options.onError) toastError(error);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
