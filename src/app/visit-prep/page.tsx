import React from "react";
import { AuthenticatedApp } from "@/components/layout/AuthenticatedApp";
import { VisitPrepContent } from "@/features/records/components/VisitPrepContent";

export default function VisitPrepPage() {
  return (
    <AuthenticatedApp>
      <VisitPrepContent />
    </AuthenticatedApp>
  );
}
