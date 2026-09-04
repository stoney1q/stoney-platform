'use client';

import React, { useState } from 'react';
// @ts-expect-error - Ignore module resolution if not using node16/bundler
import { useChat } from 'ai/react';
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

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/v1/ai/chat',
    onError: (err: Error) => {
      console.error('Chat error:', err);
    },
  });

  if (process.env.NEXT_PUBLIC_ENABLE_COPILOT !== 'true') {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg flex items-center justify-center z-50"
            title="Stoney Co-Pilot"
          >
            {/* A simple icon */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.967.714-1.756 1.62-1.928a6.002 6.002 0 00-7.74 0c.906.172 1.62.961 1.62 1.928v.192m5.155-5.255a3.75 3.75 0 11-5.155 0" />
            </svg>
          </Button>
        }
      />

      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Stoney Co-Pilot</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-10">
              <p>How can I help you today?</p>
            </div>
          )}

          {messages
            .filter((m: { role: string }) => m.role !== 'tool')
            .map((m: { id?: string; role: 'user'|'assistant'|'system'|'data'; content: string }, i: number) => (
            <ChatMessage key={m.id || `msg-${i}`} role={m.role} content={m.content} />
          ))}

          {isLoading && (
            <div className="text-sm text-gray-400">Co-Pilot is thinking...</div>
          )}

          {error && (
            <div className="text-sm text-red-500 p-2 bg-red-50 rounded">
              An error occurred: {error.message || 'Please try again later.'}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
