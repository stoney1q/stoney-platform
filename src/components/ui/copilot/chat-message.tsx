import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system' | 'data';
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  if (role === 'system' || role === 'data') return null;

  return (
    <div
      className={`mb-4 flex ${
        role === 'user' ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2 ${
          role === 'user'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
        }`}
      >
        {role === 'user' ? (
          <div className="whitespace-pre-wrap">{content}</div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
