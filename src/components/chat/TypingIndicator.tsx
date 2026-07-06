export default function TypingIndicator() {
  return (
    <div className="flex justify-end">
      <div className="bg-secondary/20 border border-secondary/30 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1 items-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-secondary animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
