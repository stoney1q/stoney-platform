import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-center">
      <FileQuestion className="text-muted-foreground h-10 w-10" />
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Page Not Found</h2>
        <p className="text-muted-foreground max-w-[400px]">
          The page you are looking for does not exist or you do not have
          permission to view it.
        </p>
      </div>
      <Link
        href="/"
        className={buttonVariants({ variant: 'default', className: 'mt-4' })}
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
