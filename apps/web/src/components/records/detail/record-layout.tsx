export function RecordLayout({
  header,
  left,
  center,
  right,
}: {
  header: React.ReactNode;
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="@container min-h-full">
      {header}
      <div className="record-grid px-6 py-6">
        <aside style={{ gridArea: "left" }} className="min-w-0">
          {left}
        </aside>
        <div style={{ gridArea: "center" }} className="min-w-0">
          {center}
        </div>
        <aside style={{ gridArea: "right" }} className="min-w-0 space-y-7">
          {right}
        </aside>
      </div>
    </div>
  );
}

export function RecordSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-4 border-b px-6 py-7">
        <div className="size-12 rounded-xl bg-muted" />
        <div className="space-y-2">
          <div className="h-5 w-56 rounded bg-muted" />
          <div className="h-3 w-40 rounded bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-[18rem_1fr] gap-8 px-6 py-6">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-muted" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-16 rounded-lg bg-muted" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
