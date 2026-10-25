/** Validation message under a form field; renders nothing when there is none. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="text-xs text-red-600">{message}</span>;
}

/** Form-level message (API failure, expired session, conflict); renders nothing when there is none. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {message}
    </p>
  );
}
