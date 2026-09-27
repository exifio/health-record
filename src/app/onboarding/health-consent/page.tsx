import React, { Suspense } from "react";
import { AuthenticatedApp } from "@/components/layout/AuthenticatedApp";
import { HealthConsentContent } from "@/features/onboarding/HealthConsentContent";

export default function HealthConsentPage() {
  return (
    <AuthenticatedApp>
      {/* useSearchParams는 Next.js에서 Suspense 경계가 필요하다. */}
      <Suspense fallback={null}>
        <HealthConsentContent />
      </Suspense>
    </AuthenticatedApp>
  );
}
