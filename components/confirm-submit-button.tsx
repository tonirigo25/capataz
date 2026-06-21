"use client";

export function ConfirmSubmitButton({
  children,
  className = "secondary-button",
  message
}: {
  children: React.ReactNode;
  className?: string;
  message: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
