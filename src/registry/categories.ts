import type { Category } from '@/types/tool';

export const categories: Category[] = [
  'Dev',
  'PDF',
  'Image',
  'Files',
  'Draw',
  'Media',
  'Playground'
];

export const categoryColors: Record<Category, string> = {
  Dev: 'bg-blue-500',
  PDF: 'bg-red-500',
  Image: 'bg-green-500',
  Files: 'bg-yellow-500',
  Draw: 'bg-purple-500',
  Media: 'bg-pink-500',
  Playground: 'bg-orange-500'
};
