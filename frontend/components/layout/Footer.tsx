export default function Footer() {
  return (
    <footer className="border-t border-border mt-20 py-8 px-4">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Friday. All rights reserved.</p>
        <p>Built with Claude · Powered by LangGraph</p>
      </div>
    </footer>
  );
}
