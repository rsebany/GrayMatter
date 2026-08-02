import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PatientCombobox } from "@/components/features/patients/PatientComboBox";
import type { Patient } from "@/api/domain";
import type { PatientStepData } from "@/components/features/studies/AddCaseSheet";

type CaseSheetPatientStepProps = {
  isNewPatient: boolean;
  patient: PatientStepData;
  selectedPatient?: Patient;
  patients: Patient[];
  setIsNewPatient: (value: boolean) => void;
  setPatient: (value: PatientStepData) => void;
  setSelectedPatient: (value: Patient | undefined) => void;
};

export function CaseSheetPatientStep({
  isNewPatient,
  patient,
  selectedPatient,
  patients,
  setIsNewPatient,
  setPatient,
  setSelectedPatient,
}: CaseSheetPatientStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={!isNewPatient ? "default" : "outline"}
          size="sm"
          className="rounded-lg"
          onClick={() => {
            setIsNewPatient(false);
            setPatient({ id: "", name: "", dob: "" });
            setSelectedPatient(undefined);
          }}
        >
          Select Patient
        </Button>
        <Button
          type="button"
          variant={isNewPatient ? "default" : "outline"}
          size="sm"
          className="rounded-lg"
          onClick={() => {
            setIsNewPatient(true);
            setPatient({ id: "", name: "", dob: "" });
            setSelectedPatient(undefined);
          }}
        >
          New Patient
        </Button>
      </div>

      {isNewPatient ? (
        <>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
              Full Legal Name
            </label>
            <Input
              value={patient.name}
              onChange={(e) => setPatient({ ...patient, name: e.target.value })}
              placeholder="John Doe"
              className="h-12 rounded-xl border-border bg-background text-foreground focus:ring-sky-500/20"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
              Date of Birth
            </label>
            <Input
              type="date"
              value={patient.dob}
              onChange={(e) => setPatient({ ...patient, dob: e.target.value })}
              className="h-12 rounded-xl border-border bg-background text-foreground"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Medical ID will be auto-generated upon registration.
          </p>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
              Select Patient
            </label>
            <PatientCombobox
              key={patient.id || "no-patient"}
              patients={patients}
              value={patient.id}
              onChange={(id, p) => {
                const resolvedName =
                  (p?.name && p.name.trim()) || (p?.id != null ? String(p.id) : "");
                setPatient({
                  id,
                  name: resolvedName,
                  dob: p?.dateOfBirth ?? "",
                });
                setSelectedPatient(p);
              }}
              placeholder="Search by full name..."
            />
          </div>
          {selectedPatient && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                Medical ID (Read-only)
              </label>
              <div className="h-12 rounded-xl border border-border bg-muted px-4 py-2 font-mono text-sm text-muted-foreground">
                {selectedPatient.id}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

