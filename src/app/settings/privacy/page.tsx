import React from "react";
import { AuthenticatedApp } from "@/components/layout/AuthenticatedApp";
import { PrivacyContent } from "@/features/settings/PrivacyContent";

export default function PrivacyPage() {
  return (
    <AuthenticatedApp>
      <PrivacyContent />
    </AuthenticatedApp>
  );
}
