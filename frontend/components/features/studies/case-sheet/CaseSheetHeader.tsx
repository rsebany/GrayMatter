import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { User, UploadCloud } from "lucide-react";

type CaseSheetHeaderProps = {
  step: 1 | 2;
};

export function CaseSheetHeader({ step }: CaseSheetHeaderProps) {
  const isPatientStep = step === 1;

  return (
    <SheetHeader className="space-y-1 mb-8">
      <div className="flex items-center gap-2 text-sky-500 mb-2">
        {isPatientStep ? <User className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
          Step {step} of 2
        </span>
      </div>
      <SheetTitle className="text-2xl font-bold text-foreground">
        {isPatientStep ? "Patient Registration" : "Upload Imaging"}
      </SheetTitle>
      <SheetDescription className="text-muted-foreground">
        {isPatientStep
          ? "Create or select the patient profile for this medical study."
          : "Attach DICOM series and specify clinical context."}
      </SheetDescription>
    </SheetHeader>
  );
}

