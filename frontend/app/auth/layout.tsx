/**
 * Auth segment layout — dark shell for login, signup, and password flows.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      {children}
    </div>
  );
}
