'use client';

export interface AssignableUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

interface OwnerSelectProps {
  users: AssignableUser[];
  value: string;
  onChange: (userId: string) => void;
  showUnassigned?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ownerDisplayName(u: AssignableUser): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
  return name || u.email;
}

export default function OwnerSelect({
  users,
  value,
  onChange,
  showUnassigned = true,
  disabled = false,
  className = '',
}: OwnerSelectProps) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50 ${className}`}
    >
      {showUnassigned && <option value="">-- Unassigned --</option>}
      {users.map(u => (
        <option key={u.id} value={u.id}>
          {ownerDisplayName(u)} ({u.role})
        </option>
      ))}
    </select>
  );
}
