'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getDocumentDeliveryLogs,
  retryDocumentEmail,
} from '@/lib/documents/actions';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  RefreshCw,
  Mail,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

export function DeliveryStatus({ documentId }: { documentId: string }) {
  const [logs, setLogs] = useState<
    {
      id: string;
      email: string;
      status: string;
      error?: string | null;
      createdAt: Date | string;
    }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await getDocumentDeliveryLogs(documentId);
      setLogs(data);
    } catch (error) {
      console.error('Failed to fetch delivery logs', error);
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs();

    // Poll every 5 seconds if there are pending logs
    const hasPending = logs.some((log) => log.status === 'PENDING');
    let interval: NodeJS.Timeout;

    if (hasPending) {
      interval = setInterval(fetchLogs, 5000);
    }

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, logs]);

  const handleRetry = async (logId: string) => {
    try {
      setIsRetrying(logId);
      await retryDocumentEmail(logId);
      toast.success('Email queued for retry');
      await fetchLogs();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || 'Failed to retry email');
    } finally {
      setIsRetrying(null);
    }
  };

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking delivery status...
      </div>
    );
  }

  if (logs.length === 0) {
    return null;
  }

  return (
    <div className="bg-card space-y-3 rounded-lg border p-4">
      <h3 className="flex items-center gap-2 font-medium">
        <Mail className="h-4 w-4" />
        Email Delivery Status
      </h3>
      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex flex-col">
              <span className="font-medium">{log.email}</span>
              <span className="text-muted-foreground text-xs">
                {new Date(log.createdAt).toLocaleString()}
              </span>
              {log.error && (
                <span className="text-destructive mt-1 text-xs">
                  {log.error}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {log.status === 'PENDING' && (
                <span className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Pending
                </span>
              )}
              {log.status === 'SENT' && (
                <span className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Sent
                </span>
              )}
              {log.status === 'ERROR' && (
                <div className="flex items-center gap-3">
                  <span className="text-destructive flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Failed
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleRetry(log.id)}
                    disabled={isRetrying === log.id}
                  >
                    {isRetrying === log.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3 w-3" />
                    )}
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
