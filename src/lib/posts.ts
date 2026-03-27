import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const postsDirectory = path.join(process.cwd(), 'src/content/posts');

export interface PostData {
  slug: string;
  title: string;
  date: string;
  summary: string;
  description?: string;
  category?: string;
  tags?: string[];
  image?: string;
  content: string;
}

export function getSortedPostsData(): PostData[] {
  let fileNames: string[] = [];
  try {
    if (!fs.existsSync(postsDirectory)) {
      fs.mkdirSync(postsDirectory, { recursive: true });
    }
    fileNames = fs.readdirSync(postsDirectory);
  } catch (error) {
    return [];
  }
  
  const allPostsData = fileNames
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => {
      const slug = fileName.replace(/\.md$/, '');
      const fullPath = path.join(postsDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, 'utf8');

      const matterResult = matter(fileContents);
      
      let dateStr = matterResult.data.date || '';
      if (dateStr instanceof Date) {
        // YYYY-MM-DD
        const year = dateStr.getFullYear();
        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else if (typeof dateStr === 'string' && dateStr) {
        // Assume it's already YYYY-MM-DD or similar
        dateStr = dateStr.split('T')[0];
      }

      return {
        slug: matterResult.data.slug || slug,
        title: matterResult.data.title || slug,
        date: dateStr,
        summary: matterResult.data.summary || '',
        description: matterResult.data.description,
        category: matterResult.data.category,
        tags: matterResult.data.tags,
        image: matterResult.data.image,
        content: matterResult.content,
      };
    });

  return allPostsData.sort((a, b) => {
    if (a.date < b.date) {
      return 1;
    } else {
      return -1;
    }
  });
}

export function getPostData(slug: string): PostData | null {
  const fullPath = path.join(postsDirectory, `${slug}.md`);
  try {
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const matterResult = matter(fileContents);
    
    let dateStr = matterResult.data.date || '';
    if (dateStr instanceof Date) {
        const year = dateStr.getFullYear();
        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
    } else if (typeof dateStr === 'string' && dateStr) {
        dateStr = dateStr.split('T')[0];
    }

    return {
      slug,
      title: matterResult.data.title || slug,
      date: dateStr,
      summary: matterResult.data.summary || '',
      category: matterResult.data.category,
      tags: matterResult.data.tags,
      image: matterResult.data.image,
      content: matterResult.content,
    };
  } catch (e) {
    return null;
  }
}
