export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div className="animate-pulse">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="h-4 bg-gray-200 rounded flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white border rounded-lg p-5 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-16" />
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="bg-white border rounded-lg p-5 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
      <div className="h-48 bg-gray-100 rounded" />
    </div>
  )
}