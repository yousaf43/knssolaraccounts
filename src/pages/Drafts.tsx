import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileEdit, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { toast } from "sonner";
import {
  listDrafts,
  deleteDraft,
  clearDrafts,
  subscribeDrafts,
  draftKindLabels,
  type Draft,
} from "@/lib/drafts";
import { useSettings } from "@/contexts/SettingsContext";

const formatWhen = (iso: string, formatDate: (d: string | Date) => string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${formatDate(d)} ${d.toLocaleTimeString()}`;
};

export default function Drafts() {
  const navigate = useNavigate();
  const { formatDate } = useSettings();
  const [drafts, setDrafts] = useState<Draft[]>(() => listDrafts());

  useEffect(() => subscribeDrafts(() => setDrafts(listDrafts())), []);

  const resume = (draft: Draft) => {
    navigate(`/invoices?draft=${encodeURIComponent(draft.id)}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileEdit className="w-6 h-6 text-primary" />
            Drafts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Adhoori invoices, quotations aur sales orders yahan auto-save hoti hain — Resume kar ke wahin se continue karein.
          </p>
        </div>
        {drafts.length > 0 && (
          <ConfirmDeleteDialog
            title={`Clear all ${drafts.length} drafts?`}
            description="Saare saved drafts permanently delete ho jayenge."
            onConfirm={() => {
              clearDrafts();
              toast.success("All drafts cleared");
            }}
          >
            <Button variant="outline" size="sm">
              <Trash2 className="w-4 h-4 mr-2" /> Clear All
            </Button>
          </ConfirmDeleteDialog>
        )}
      </div>

      <Card className="p-0 overflow-hidden">
        {drafts.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileEdit className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Koi draft nahi hai</p>
            <p className="text-sm mt-1">Jab bhi aap koi document banate hain, wo yahan khud save hota rehta hai.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Sr #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Last Saved</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.map((d, idx) => (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => resume(d)}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{draftKindLabels[d.kind] || d.kind}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{d.label || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{d.summary || "—"}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{formatWhen(d.updatedAt, formatDate)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" onClick={() => resume(d)}>
                        <Play className="w-4 h-4 mr-1" /> Resume
                      </Button>
                      <ConfirmDeleteDialog
                        title={`Delete draft "${d.label || "Untitled"}"?`}
                        description="Yeh draft permanently delete ho jayega — Trash me nahi jayega."
                        onConfirm={() => {
                          deleteDraft(d.id);
                          toast.success("Draft deleted");
                        }}
                      >
                        <Button size="sm" variant="ghost">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </ConfirmDeleteDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
