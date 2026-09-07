'use client';

import React, { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ChatMessage } from './chat-message';

export function CopilotDrawer() {
  const [open, setOpen] = useState(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      // @ts-ignore - Ignoring API typing issue
      api: '/api/v1/ai/chat',
      onError: (err: Error) => {
        console.error('Chat error:', err);
      },
    }) as any;

  if (process.env.NEXT_PUBLIC_ENABLE_COPILOT !== 'true') {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            className="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
            title="Stoney Co-Pilot"
          >
            {/* A simple icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.967.714-1.756 1.62-1.928a6.002 6.002 0 00-7.74 0c.906.172 1.62.961 1.62 1.928v.192m5.155-5.255a3.75 3.75 0 11-5.155 0"
              />
            </svg>
          </Button>
        }
      />

      <SheetContent className="flex w-[400px] flex-col p-0 sm:w-[540px]">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Stoney Co-Pilot</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="mt-10 text-center text-gray-500">
              <p>How can I help you today?</p>
            </div>
          )}

          {messages.map((m: any, i: number) => (
            <ChatMessage
              key={m.id || `msg-${i}`}
              role={m.role}
              content={m.content}
            />
          ))}

          {isLoading && (
            <div className="text-sm text-gray-400">Co-Pilot is thinking...</div>
          )}

          {error && (
            <div className="rounded bg-red-50 p-2 text-sm text-red-500">
              An error occurred: {error.message || 'Please try again later.'}
            </div>
          )}
        </div>

        <div className="border-t bg-gray-50 p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={input}
              onChange={handleInputChange}
              placeholder="Ask a question..."
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              Send
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
