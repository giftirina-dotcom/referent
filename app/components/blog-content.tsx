import Markdown from "react-markdown";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-2 text-2xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-3xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 mb-3 border-b border-zinc-200 pb-2 text-xl font-semibold text-zinc-900 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 mb-2 text-lg font-semibold text-zinc-800">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-4 text-base leading-8 text-zinc-700 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-5 space-y-2 pl-1 text-zinc-700">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-5 list-decimal space-y-2 pl-6 text-zinc-700">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="relative pl-5 leading-7 before:absolute before:left-0 before:top-3 before:h-1.5 before:w-1.5 before:rounded-full before:bg-sky-500 [&>ul]:mt-2">
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-6 border-l-4 border-sky-400 bg-sky-50/60 py-3 pl-5 pr-4 text-zinc-700 italic">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-zinc-900">{children}</strong>
  ),
  em: ({ children }) => <em className="text-zinc-600">{children}</em>,
  hr: () => <hr className="my-8 border-zinc-200" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
    >
      {children}
    </a>
  ),
};

type BlogContentProps = {
  content: string;
};

export default function BlogContent({ content }: BlogContentProps) {
  return (
    <article className="blog-content min-h-48 rounded-xl border border-zinc-100 bg-gradient-to-b from-white to-zinc-50/80 px-6 py-8 sm:px-8 [&_ol>li]:pl-0 [&_ol>li]:before:hidden">
      <Markdown components={markdownComponents}>{content}</Markdown>
    </article>
  );
}
