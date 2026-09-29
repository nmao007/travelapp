import { notFound } from 'next/navigation';
import { PlannerApp } from '@/components/planner/planner-app';
export default async function PreviewPage({ params }: { params: Promise<{ section?: string[] }> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { section = [] } = await params;
  if (section.length > 1 || !['','today','trip','plan','explore','essentials','wallet','tools','timeline','budget','packing','settings'].includes(section[0] ?? '')) notFound();
  return <PlannerApp review />;
}
