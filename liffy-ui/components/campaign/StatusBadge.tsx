"use client";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<string, { label: string; className: string }> = {
    draft: {
      label: "Draft",
      className: "bg-gray-100 text-gray-800",
    },
    ready: {
      label: "Ready",
      className: "bg-blue-100 text-blue-800",
    },
    scheduled: {
      label: "Scheduled",
      className: "bg-yellow-100 text-yellow-800",
    },
    sending: {
      label: "Sending",
      className: "bg-green-100 text-green-800",
    },
    paused: {
      label: "Paused",
      className: "bg-orange-100 text-orange-800",
    },
    completed: {
      label: "Completed",
      className: "bg-purple-100 text-purple-800",
    },
    failed: {
      label: "Failed",
      className: "bg-red-100 text-red-800",
    },
  };

  const { label, className } = config[status] || {
    label: status,
    className: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${className}`}
    >
      {label}
    </span>
  );
}
