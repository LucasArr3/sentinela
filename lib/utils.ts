import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { 
  differenceInDays, 
  addDays, 
  startOfDay, 
  eachDayOfInterval, 
  startOfMonth, 
  endOfMonth
} from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const BASE_DATE = new Date(2023, 2, 31); // 31 de março de 2023

export function isShiftDay(date: Date): boolean {
  const diff = differenceInDays(startOfDay(date), startOfDay(BASE_DATE));
  return diff % 4 === 0;
}

export function getNextShift(date: Date): Date {
  let current = startOfDay(date);
  while (!isShiftDay(current)) {
    current = addDays(current, 1);
  }
  return current;
}

export function getDaysUntilCycleEnd(date: Date): number {
  const diff = differenceInDays(startOfDay(date), startOfDay(BASE_DATE));
  return 4 - (diff % 4);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function getMonthDays(date: Date) {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return eachDayOfInterval({ start, end });
}

export const QUARTERS = [
  { id: '18-20', label: '18h-20h', start: 18, end: 20 },
  { id: '20-22', label: '20h-22h', start: 20, end: 22 },
  { id: '22-00', label: '22h-00h', start: 22, end: 0 },
  { id: '00-02', label: '00h-02h', start: 0, end: 2 },
  { id: '02-04', label: '02h-04h', start: 2, end: 4 },
  { id: '04-06', label: '04h-06h', start: 4, end: 6 },
];
