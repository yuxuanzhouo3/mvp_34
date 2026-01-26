"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-content prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none">
      <style dangerouslySetInnerHTML={{
        __html: `
          .markdown-content {
            color: rgb(55 65 81);
          }
          .dark .markdown-content {
            color: rgb(209 213 219);
          }
          .markdown-content h1 {
            font-size: 1.5rem;
            font-weight: 700;
            margin-top: 2rem;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid rgb(59 130 246);
          }
          .markdown-content h2 {
            font-size: 1.25rem;
            font-weight: 700;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
          }
          .markdown-content h3 {
            font-size: 1.125rem;
            font-weight: 600;
            margin-top: 1.25rem;
            margin-bottom: 0.5rem;
          }
          .markdown-content h4 {
            font-size: 1rem;
            font-weight: 600;
            margin-top: 1rem;
            margin-bottom: 0.5rem;
          }
          .markdown-content p {
            margin-bottom: 1rem;
            line-height: 1.75;
          }
          .markdown-content ul, .markdown-content ol {
            margin-bottom: 1rem;
            padding-left: 1.5rem;
          }
          .markdown-content li {
            margin-bottom: 0.5rem;
          }
          .markdown-content blockquote {
            border-left: 4px solid rgb(59 130 246);
            padding-left: 1rem;
            margin: 1rem 0;
            font-style: italic;
            color: rgb(75 85 99);
          }
          .dark .markdown-content blockquote {
            color: rgb(156 163 175);
          }
          .markdown-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
          }
          .markdown-content th {
            background: rgb(243 244 246);
            padding: 0.5rem;
            border: 1px solid rgb(209 213 219);
            font-weight: 600;
          }
          .dark .markdown-content th {
            background: rgb(55 65 81);
            border-color: rgb(75 85 99);
          }
          .markdown-content td {
            padding: 0.5rem;
            border: 1px solid rgb(209 213 219);
          }
          .dark .markdown-content td {
            border-color: rgb(75 85 99);
          }
          .markdown-content code {
            background: rgb(243 244 246);
            padding: 0.125rem 0.25rem;
            border-radius: 0.25rem;
            font-size: 0.875em;
          }
          .dark .markdown-content code {
            background: rgb(55 65 81);
          }
          .markdown-content pre {
            background: rgb(243 244 246);
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
            margin: 1rem 0;
          }
          .dark .markdown-content pre {
            background: rgb(55 65 81);
          }
          .markdown-content pre code {
            background: transparent;
            padding: 0;
          }
          .markdown-content a {
            color: rgb(59 130 246);
            text-decoration: underline;
          }
          .dark .markdown-content a {
            color: rgb(96 165 250);
          }
          .markdown-content hr {
            margin: 2rem 0;
            border: 0;
            border-top: 1px solid rgb(229 231 235);
          }
          .dark .markdown-content hr {
            border-top-color: rgb(75 85 99);
          }
          .markdown-content strong {
            font-weight: 600;
          }
        `
      }} />
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
