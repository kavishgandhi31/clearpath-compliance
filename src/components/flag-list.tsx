import { NoteEditor } from "@/components/note-editor";
import { Badge } from "@/components/ui/badge";
import { type FlagNote, type NumberedFlag, noteFor } from "@/lib/flags";
import { foundByLabels } from "@/lib/labels";

type Props = {
  flags: NumberedFlag[];
  notes: FlagNote[];
  // Set on the edit page, where the owner writes notes. Without it, notes are read-only.
  editableAdId?: number;
};

export function SuspiciousBanner({ flags }: { flags: NumberedFlag[] }) {
  if (!flags.some(({ flag }) => flag.kind === "suspicious_instructions")) return null;
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
      Suspicious instructions found. AI check skipped, review manually.
    </div>
  );
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function issueCounts(flags: NumberedFlag[]) {
  const suspicious = flags.filter(({ flag }) => flag.kind === "suspicious_instructions").length;
  const warnings = flags.filter(({ rule }) => rule?.severity === "warning").length;
  const blockers = flags.length - suspicious - warnings;
  return [
    ...(suspicious > 0 ? [plural(suspicious, "suspicious instruction")] : []),
    plural(blockers, "blocker"),
    plural(warnings, "warning"),
  ].join(", ");
}

export function FlagList({ flags, notes, editableAdId }: Props) {
  if (flags.length === 0) return <p className="text-muted-foreground">No flags.</p>;

  return (
    <ol className="flex flex-col gap-3">
      {flags.map(({ flag, n, rule }) => {
        const note = noteFor(flag, notes);
        // Keyed by what the flag is, not its number: a new check renumbers flags, and an open note box must stay on its own flag.
        const key = `${flag.kind}:${flag.kind === "rule" ? flag.ruleId : ""}:${flag.quote ?? ""}`;
        return (
          <li key={key} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{n}.</span>
              <span className="font-medium">{rule?.name ?? "Suspicious instructions"}</span>
              {flag.kind === "suspicious_instructions" ? (
                <Badge className="bg-red-100 text-red-900">Review manually</Badge>
              ) : rule?.severity === "warning" ? (
                <Badge className="bg-amber-100 text-amber-900">Warning</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-900">Blocker</Badge>
              )}
              <span className="ml-auto text-xs text-muted-foreground">{foundByLabels[flag.foundBy]}</span>
            </div>
            {flag.quote === null ? (
              <p className="text-muted-foreground italic">Missing from the ad</p>
            ) : (
              <blockquote className="border-l-2 border-amber-400 pl-3 whitespace-pre-wrap">“{flag.quote}”</blockquote>
            )}
            <p>
              <span className="font-medium">Why it was flagged: </span>
              {flag.explanation}
            </p>
            {flag.kind === "suspicious_instructions" ? (
              editableAdId !== undefined && (
                <p className="text-red-900">This flag can&apos;t get a note. Remove the text, then run the check again.</p>
              )
            ) : editableAdId !== undefined ? (
              <NoteEditor adId={editableAdId} ruleId={flag.ruleId} quote={flag.quote} note={note?.note ?? null} />
            ) : (
              note && (
                <p className="rounded-md bg-muted px-3 py-2 whitespace-pre-wrap">
                  <span className="font-medium">Submitter&apos;s note: </span>
                  {note.note}
                </p>
              )
            )}
          </li>
        );
      })}
    </ol>
  );
}
