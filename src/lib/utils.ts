import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const HEAD_TYPE_COLORS = [
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-amber-100 text-amber-700 border-amber-200'
];

export const getHeadTypeColorClass = (headType: string) => {
  if (!headType) return 'bg-slate-100 text-slate-700 border-slate-200';
  
  if (headType === 'A型') return HEAD_TYPE_COLORS[0];
  if (headType === 'B型') return HEAD_TYPE_COLORS[1];
  if (headType === 'C型') return HEAD_TYPE_COLORS[2];
  
  let hash = 0;
  for (let i = 0; i < headType.length; i++) {
    hash = headType.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  return HEAD_TYPE_COLORS[3 + (hash % (HEAD_TYPE_COLORS.length - 3))];
};
