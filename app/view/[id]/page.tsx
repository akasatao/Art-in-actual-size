import { notFound } from "next/navigation";
import ActualSizeViewer from "@/components/ActualSizeViewer";
import { getWork, works } from "@/lib/works";

export function generateStaticParams() {
  return works.map((work) => ({ id: work.id }));
}

export default async function ViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const work = getWork(id);
  if (!work) notFound();

  return <ActualSizeViewer work={work} />;
}
