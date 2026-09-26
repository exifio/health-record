import React from "react";
import { AuthenticatedApp } from "@/components/layout/AuthenticatedApp";
import { SettingsContent } from "@/features/settings/SettingsContent";

export default function SettingsPage() {
  return (
    <AuthenticatedApp>
      <SettingsContent />
    </AuthenticatedApp>
  );
}
