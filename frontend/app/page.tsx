import { LuckyDrawDashboard } from "@/components/LuckyDrawDashboard";
import { FHECounterDemo } from "@/components/FHECounterDemo";

export default function Home() {
  return (
    <main className="w-full space-y-12">
      <LuckyDrawDashboard />
      <FHECounterDemo />
    </main>
  );
}
