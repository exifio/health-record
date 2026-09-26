import React from "react";
import { AuthenticatedApp } from "@/components/layout/AuthenticatedApp";
import { RecordsListContent } from "@/features/records/components/RecordsListContent";

export default function RecordsPage() {
  return (
    <AuthenticatedApp>
      <RecordsListContent />
    </AuthenticatedApp>
  );
}
