import { redirect } from "next/navigation";

// City translations moved to a tab of the translated names page; old links still work.
export default function AdminLocationsPage() {
  redirect("/admin/glossary?tab=cities");
}
