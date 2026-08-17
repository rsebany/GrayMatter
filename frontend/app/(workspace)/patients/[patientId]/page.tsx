import { PatientDetailPageContent } from "@/components/features/patients";
import { WorkspaceShell } from "@/components/layout";

type PatientDetailPageProps = {
  params: Promise<{ patientId: string }>;
};

export default async function PatientDetailPage({ params }: PatientDetailPageProps) {
  const { patientId } = await params;

  return (
    <WorkspaceShell
      activePage="patients"
      title="Patient detail"
      breadcrumb="Dashboard / Patients / Patient detail"
      mainClassName="flex min-w-0 flex-1 flex-col overflow-x-auto p-4"
    >
      <PatientDetailPageContent patientId={patientId} />
    </WorkspaceShell>
  );
}
