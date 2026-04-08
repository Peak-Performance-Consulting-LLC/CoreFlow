import { Card } from './Card';

export function SectionSkeleton({
  title = 'Loading section',
  rows = 3,
}: {
  title?: string;
  rows?: number;
}) {
  return (
    <Card className="p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-32 rounded-full bg-white/10" aria-label={title} />
        <div className="h-10 w-56 rounded-full bg-white/10" />
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={`${title}-${index}`} className="h-12 rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      </div>
    </Card>
  );
}
