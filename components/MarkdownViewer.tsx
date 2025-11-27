'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownViewerProps {
  content: string;
}

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="prose prose-gray max-w-none prose-headings:text-black prose-p:text-black prose-strong:text-black prose-ul:space-y-1 prose-li:text-black" style={{ color: 'black' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Customize heading styles
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold text-gray-800 mb-6 mt-8 border-b-2 border-gray-200 pb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-bold text-gray-800 mb-4 mt-6">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold text-gray-700 mb-3 mt-4">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-lg font-semibold text-gray-700 mb-2 mt-3">{children}</h4>
          ),
          // Style paragraphs with special handling for section headers
          p: ({ children }) => {
            // Helper function to extract text from nested children
            const extractText = (node: any): string => {
              if (typeof node === 'string') return node;
              if (node?.props?.children) {
                if (Array.isArray(node.props.children)) {
                  return node.props.children.map(extractText).join('');
                }
                return extractText(node.props.children);
              }
              return '';
            };

            // Helper function to check if a node contains a strong element that would render as div
            const containsDivStrong = (node: any): boolean => {
              if (!node) return false;
              
              // Check if this node is a strong element
              if (node?.props?.node?.tagName === 'strong') {
                const text = extractText(node);
                return (/^[a-z]\.\s+.+/i).test(text) || (text.endsWith(':') && text.length < 40);
              }
              
              // Check children recursively
              if (node?.props?.children) {
                if (Array.isArray(node.props.children)) {
                  return node.props.children.some((child: any) => containsDivStrong(child));
                }
                return containsDivStrong(node.props.children);
              }
              
              return false;
            };

            // Check if this paragraph contains any element that would be rendered as a div
            if (Array.isArray(children)) {
              if (children.some(child => containsDivStrong(child))) {
                return <>{children}</>;
              }
            } else if (containsDivStrong(children)) {
              return <>{children}</>;
            }
            
            return <p className="text-black mb-4 leading-relaxed text-base" style={{ color: 'black' }}>{children}</p>;
          },
          // Style lists with better formatting
          ul: ({ children }) => (
            <ul className={`mb-4 space-y-2 ml-0`}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal mb-4 space-y-3 ml-6">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-black pl-2" style={{ color: 'black' }}>{children}</li>
          ),
          // Style blockquotes
          blockquote: ({ children }) => {
            // Convert any p elements inside blockquotes to divs to avoid nesting issues
            const processedChildren = Array.isArray(children) 
              ? children.map((child, index) => {
                  if (child?.type === 'p' || child?.props?.node?.tagName === 'p') {
                    return <div key={index} className="text-black mb-2">{child.props?.children || child}</div>;
                  }
                  return child;
                })
              : children;
              
            return (
              <blockquote className="border-l-4 border-gray-500 pl-4 my-4 italic bg-gray-100 p-4 rounded">
                {processedChildren}
              </blockquote>
            );
          },
          // Style code blocks
          code: (props: any) => {
            const { inline, children } = props || {};
            if (inline) {
              return <code className="bg-gray-200 px-1 py-0.5 rounded text-sm">{children}</code>;
            }
            return (
              <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto mb-4">
                <code>{children}</code>
              </pre>
            );
          },
          // Style horizontal rules
          hr: () => <hr className="my-8 border-gray-300" />,
          // Style strong text with special handling for section headers
          strong: ({ children, node }) => {
            const text = children?.toString() || '';
            
            // Check if this strong element is inside a paragraph or other inline context
            // If so, don't render as a div to avoid hydration errors
            const column: number = (node as any)?.position?.start?.column ?? 0;
            const isInlineContext = column > 1;
            
            // Check if this is a section header like "a. Multiple Choice Questions (MCQs)"
            if (!isInlineContext && (/^[a-z]\.\s+.+/i).test(text)) {
              return (
                <div className="relative bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 px-5 py-4 mb-6 mt-8 rounded-lg shadow-sm">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-500 rounded-l-lg"></div>
                  <strong className="text-xl font-bold text-gray-800 flex items-center">
                    <span className="text-2xl mr-3">📋</span>
                    {children}
                  </strong>
                </div>
              );
            }
            // Check if this is a subsection like "Structure:" or "Example Questions:"
            if (!isInlineContext && text.endsWith(':') && text.length < 40) {
              return (
                <div className="mt-6 mb-4">
                  <div className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-md">
                    <strong className="text-lg font-bold flex items-center">
                      <span className="text-xl mr-2">📌</span>
                      {children}
                    </strong>
                  </div>
                </div>
              );
            }
            return <strong className="font-bold text-gray-800">{children}</strong>;
          },
          // Style emphasis
          em: ({ children }) => (
            <em className="italic text-black" style={{ color: 'black' }}>{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
} 