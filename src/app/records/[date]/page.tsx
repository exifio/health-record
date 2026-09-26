import React from "react";
import { AuthenticatedApp } from "@/components/layout/AuthenticatedApp";
import { RecordDateContent } from "@/features/records/components/RecordDateContent";

interface RecordDatePageProps {
  params: Promise<{ date: string }>;
}

export default async function RecordDatePage({ params }: RecordDatePageProps) {
  const { date } = await params;

  return (
    <AuthenticatedApp>
      <RecordDateContent date={date} />
    </AuthenticatedApp>
  );
}
