import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChoiceArticle } from '@/lib/life-choice';

export default function ChoiceArticleCard({ article }: { article: ChoiceArticle }) {
  return (
    <article className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
      <header className="mb-6 border-b border-stone-100 pb-6">
        <h2 className="text-3xl font-extrabold mb-3 leading-tight">{article.title}</h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-stone-500">작성일: {article.date}</span>
          <span className="text-stone-300">|</span>
          <span className="text-stone-500 font-medium">카테고리: 픽앤조이 초이스</span>
        </div>
      </header>

      {article.image && !article.image.endsWith('.svg') && (
        <div className="relative w-full h-72 md:h-96 rounded-2xl overflow-hidden mb-8">
          <Image
            src={article.image}
            alt={article.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 1200px"
          />
        </div>
      )}

      <div className="choice-post-prose prose prose-stone prose-orange lg:prose-lg max-w-none prose-p:leading-8 prose-h2:text-2xl prose-h3:text-xl prose-h2:font-bold mb-2">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content}</ReactMarkdown>
      </div>
    </article>
  );
}
