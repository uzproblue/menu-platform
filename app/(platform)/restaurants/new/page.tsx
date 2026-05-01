import type { Metadata } from "next";
import { NewLocationWizard } from "@/app/components/restaurants/new-location-wizard";

export const metadata: Metadata = {
  title: "New location · Menu Platform",
  description: "Create a restaurant location",
};

export default function NewRestaurantPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
        <NewLocationWizard />
      </div>
    </div>
  );
}
