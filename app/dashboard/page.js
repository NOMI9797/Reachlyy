import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Redirect to campaigns page by default
export default function Dashboard() {
  redirect("/dashboard/campaigns");
}
