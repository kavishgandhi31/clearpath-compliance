import { CopyButton } from "@/components/copy-button";
import type { NumberedFlag } from "@/lib/flags";

type ApprovedText = { id: string; name: string; text: string };

// One entry per approved text a flag points to. We never write legal text: the Submitter copies it and edits the ad themselves.
export function Suggestions({ flags, approvedTexts }: { flags: NumberedFlag[]; approvedTexts: ApprovedText[] }) {
  const suggestions = approvedTexts
    .map((approved) => ({
      approved,
      flagNumbers: flags
        .filter(({ flag }) => flag.kind === "rule" && flag.approvedTextId === approved.id)
        .map(({ n }) => n),
    }))
    .filter(({ flagNumbers }) => flagNumbers.length > 0);

  if (suggestions.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-medium">Suggested approved text</h3>
      <ul className="flex flex-col gap-3">
        {suggestions.map(({ approved, flagNumbers }) => (
          <li key={approved.id} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {approved.name}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  for flag {flagNumbers.join(", ")}
                </span>
              </span>
              <CopyButton text={approved.text} />
            </div>
            <p className="text-muted-foreground">{approved.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
