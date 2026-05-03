type Props = { isActive: boolean };

export function StatusBadge({ isActive }: Props) {
  if (isActive) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-sm font-semibold bg-green-100 text-green-800">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-600">
      Inactive
    </span>
  );
}
