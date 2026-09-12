/** One line under a field. Rendered only when there is something to say, so layout stays put otherwise. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="animate-in fade-in slide-in-from-top-1 duration-150 text-[12px] font-medium text-danger-700">
      {message}
    </p>
  );
}
