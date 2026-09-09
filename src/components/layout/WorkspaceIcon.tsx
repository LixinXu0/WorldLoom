export function WorkspaceIcon({
  name,
}: {
  name:
    | "select"
    | "pen"
    | "eraser"
    | "connect"
    | "annotation"
    | "loom";
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "select" ? (
        <path d="m5 3 14 10-7 1-3 7Z" />
      ) : name === "pen" ? (
        <>
          <path d="m15 4 5 5M5 19l1-5L17 3a2 2 0 0 1 3 3L9 17Z" />
          <path d="M3 22c4-3 5 1 9-2" />
        </>
      ) : name === "eraser" ? (
        <>
          <path d="m4 15 9-9a2.2 2.2 0 0 1 3.1 0l3.9 3.9a2 2 0 0 1 0 3.1l-6.5 6.5H7Z" />
          <path d="m12 8 5 5M3 21h18" />
        </>
      ) : name === "connect" ? (
        <>
          <circle cx="5" cy="18" r="3" />
          <circle cx="19" cy="6" r="3" />
          <path d="M7 16c2-7 8 0 10-8" />
        </>
      ) : name === "annotation" ? (
        <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-6 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 5h10M7 13h7" />
      ) : (
        <>
          <path d="M4 8C8 2 16 2 20 8c-4 6-12 6-16 0Z" />
          <path d="M4 16c4-6 12-6 16 0-4 6-12 6-16 0Z" />
          <path
            d="M4 8c4 6 12 6 16 0M4 16c4-6 12-6 16 0"
            opacity=".55"
          />
        </>
      )}
    </svg>
  );
}