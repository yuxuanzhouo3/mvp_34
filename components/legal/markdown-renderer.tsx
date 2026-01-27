"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-content max-w-none px-1 sm:px-2 lg:px-4">
      <style dangerouslySetInnerHTML={{
        __html: `
          .markdown-content {
            color: rgb(75 85 99);
          }
          .dark .markdown-content {
            color: rgb(209 213 219);
          }
          .markdown-content h1 {
            font-size: 1rem;
            font-weight: 700;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid rgb(59 130 246);
          }
          @media (min-width: 640px) {
            .markdown-content h1 {
              font-size: 1.125rem;
              margin-bottom: 1.25rem;
            }
          }
          @media (min-width: 1024px) {
            .markdown-content h1 {
              font-size: 1.25rem;
              margin-bottom: 1.5rem;
            }
          }
          .markdown-content h2 {
            font-size: 0.875rem;
            font-weight: 700;
            margin-top: 1.25rem;
            margin-bottom: 0.75rem;
          }
          @media (min-width: 640px) {
            .markdown-content h2 {
              font-size: 1rem;
              margin-top: 1.5rem;
              margin-bottom: 1rem;
            }
          }
          @media (min-width: 1024px) {
            .markdown-content h2 {
              font-size: 1.125rem;
              margin-top: 1.75rem;
            }
          }
          .markdown-content h3 {
            font-size: 0.75rem;
            font-weight: 600;
            margin-top: 1rem;
            margin-bottom: 0.5rem;
          }
          @media (min-width: 640px) {
            .markdown-content h3 {
              font-size: 0.875rem;
              margin-top: 1.25rem;
              margin-bottom: 0.625rem;
            }
          }
          @media (min-width: 1024px) {
            .markdown-content h3 {
              font-size: 1rem;
            }
          }
          .markdown-content h4 {
            font-size: 0.75rem;
            font-weight: 600;
            margin-top: 0.875rem;
            margin-bottom: 0.5rem;
          }
          @media (min-width: 640px) {
            .markdown-content h4 {
              font-size: 0.875rem;
            }
          }
          .markdown-content p {
            font-size: 0.75rem;
            line-height: 1.625;
            margin-bottom: 0.75rem;
          }
          @media (min-width: 640px) {
            .markdown-content p {
              font-size: 0.875rem;
              margin-bottom: 1rem;
            }
          }
          @media (min-width: 1024px) {
            .markdown-content p {
              font-size: 1rem;
            }
          }
          .markdown-content ul, .markdown-content ol {
            margin: 0.75rem 0;
            padding-left: 1.5rem;
          }
          @media (min-width: 640px) {
            .markdown-content ul, .markdown-content ol {
              margin: 1rem 0;
            }
          }
          .markdown-content li {
            font-size: 0.75rem;
            margin-bottom: 0.5rem;
          }
          @media (min-width: 640px) {
            .markdown-content li {
              font-size: 0.875rem;
              margin-bottom: 0.625rem;
            }
          }
          @media (min-width: 1024px) {
            .markdown-content li {
              font-size: 1rem;
            }
          }
          .markdown-content blockquote {
            border-left: 2px solid rgb(59 130 246);
            background: rgb(239 246 255);
            padding: 0.5rem 0.75rem;
            margin: 1rem 0;
            border-radius: 0 0.5rem 0.5rem 0;
          }
          .dark .markdown-content blockquote {
            background: rgba(59 130 246 / 0.2);
          }
          @media (min-width: 640px) {
            .markdown-content blockquote {
              border-left-width: 4px;
              padding: 0.625rem 1rem;
              margin: 1.25rem 0;
            }
          }
          .markdown-content blockquote p {
            font-size: 0.75rem;
          }
          @media (min-width: 640px) {
            .markdown-content blockquote p {
              font-size: 0.875rem;
            }
          }
          .markdown-content-table-wrapper {
            overflow-x: auto;
            margin: 1rem 0;
            -webkit-overflow-scrolling: touch;
          }
          @media (min-width: 640px) {
            .markdown-content-table-wrapper {
              margin: 1.25rem 0;
            }
          }
          .markdown-content table {
            width: 100%;
            font-size: 0.625rem;
            border-radius: 0.5rem;
            border: 1px solid rgb(229 231 235);
            overflow: hidden;
            border-collapse: collapse;
          }
          .dark .markdown-content table {
            border-color: rgb(55 65 81);
          }
          @media (min-width: 640px) {
            .markdown-content table {
              font-size: 0.75rem;
            }
          }
          @media (min-width: 1024px) {
            .markdown-content table {
              font-size: 0.875rem;
            }
          }
          .markdown-content thead {
            background: linear-gradient(to right, rgb(239 246 255), rgb(243 232 255));
          }
          .dark .markdown-content thead {
            background: linear-gradient(to right, rgba(59 130 246 / 0.3), rgba(168 85 247 / 0.3));
          }
          .markdown-content th {
            padding: 0.375rem 0.5rem;
            text-align: left;
            font-size: 0.5625rem;
            font-weight: 600;
            color: rgb(55 65 81);
            border: 1px solid rgb(229 231 235);
          }
          .dark .markdown-content th {
            color: rgb(229 231 235);
            border-color: rgb(55 65 81);
          }
          @media (min-width: 640px) {
            .markdown-content th {
              padding: 0.5rem 0.625rem;
              font-size: 0.625rem;
            }
          }
          @media (min-width: 1024px) {
            .markdown-content th {
              padding: 0.625rem 0.875rem;
              font-size: 0.75rem;
            }
          }
          .markdown-content td {
            padding: 0.375rem 0.5rem;
            font-size: 0.625rem;
            border: 1px solid rgb(229 231 235);
          }
          .dark .markdown-content td {
            border-color: rgb(55 65 81);
          }
          @media (min-width: 640px) {
            .markdown-content td {
              padding: 0.5rem 0.625rem;
              font-size: 0.75rem;
            }
          }
          @media (min-width: 1024px) {
            .markdown-content td {
              padding: 0.625rem 0.875rem;
              font-size: 0.875rem;
            }
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
            margin: 1.5rem 0;
            border: 0;
            border-top: 1px solid rgb(229 231 235);
          }
          .dark .markdown-content hr {
            border-top-color: rgb(75 85 99);
          }
          @media (min-width: 640px) {
            .markdown-content hr {
              margin: 2rem 0;
            }
          }
          .markdown-content strong {
            font-weight: 600;
          }
        `
      }} />
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({node, ...props}) => (
            <div className="markdown-content-table-wrapper">
              <table {...props} />
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
