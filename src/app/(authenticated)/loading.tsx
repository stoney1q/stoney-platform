import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex h-[80vh] w-full flex-col items-center justify-center">
      <Loader2 className="text-primary h-10 w-10 animate-spin" />
      <p className="text-muted-foreground mt-4 text-sm">Loading dashboard...</p>
    </div>
  );
}
