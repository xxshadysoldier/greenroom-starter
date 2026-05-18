import { notFound } from "next/navigation";
import { getShowById } from "@/lib/queries";
import { hydrateForm } from "@/lib/dealRules";
import { DealForm } from "./deal-form";

export default async function DealEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getShowById(id);
  if (!data) notFound();

  const initial = hydrateForm(data.deal);

  return (
    <DealForm
      showId={data.show.id}
      show={{
        date: data.show.date,
        doorsTime: data.show.doorsTime,
        setTime: data.show.setTime,
        status: data.show.status,
      }}
      artist={
        data.artist ? { name: data.artist.name, genre: data.artist.genre } : null
      }
      agent={
        data.agent
          ? {
              name: data.agent.name,
              email: data.agent.email,
              agencyName: data.agency?.name ?? null,
            }
          : null
      }
      initial={initial}
      hasSavedDeal={!!data.deal}
    />
  );
}
