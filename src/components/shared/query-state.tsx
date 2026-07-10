import { AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export function SectionEmpty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
        <Info size={16} className="text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-[220px] leading-snug">{text}</p>
    </div>
  );
}

export function QueryState({
  isLoading,
  error,
  empty,
  emptyText,
  children,
}: {
  isLoading: boolean;
  error: Error | null;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle size={14} />
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (empty) return <SectionEmpty text={emptyText} />;

  return <>{children}</>;
}
