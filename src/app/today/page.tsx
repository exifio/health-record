import React from "react";
import { AuthenticatedApp } from "@/components/layout/AuthenticatedApp";
import { HomeContent } from "@/features/home/HomeContent";

export default function TodayPage() {
  return (
    <AuthenticatedApp>
      <HomeContent />
    </AuthenticatedApp>
  );
}
