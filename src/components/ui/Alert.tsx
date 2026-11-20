/** A short message after an action. Errors say what happened and what to do. */
export function Alert({ tone = "error", children }: { tone?: "error" | "info"; children: React.ReactNode }) {
  const styles = tone === "error" ? "bg-red-50 text-red-800" : "bg-wash text-ink";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-sm ${styles}`}>
      {children}
    </p>
  );
}
