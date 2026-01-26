"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase";
import { Button, Chip, Input } from "@/components/ui";
import { computeSystemLabels } from "@/lib/import-utils";

const systemLabelOptions = [
  "system:erstgespraech_geplant",
  "system:tattoo_termin_geplant",
  "system:anzahlung_erhalten",
  "system:preis_gesetzt",
  "system:task_faellig",
  "system:inaktiv_14",
  "system:inaktiv_30"
];

export default function DashboardPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [systemFilters, setSystemFilters] = useState<string[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadContacts = async () => {
      setIsLoading(true);
      const { data } = await supabaseClient
        .from("contacts")
        .select(
          "id, full_name, phone_e164, status, updated_at, location:locations(name), last_received_at, last_sent_at, date_erstgespraech, date_tattoo_termin, price_deposit_cents, price_total_cents, tasks:tasks(due_at,status)"
        )
        .order("updated_at", { ascending: false })
        .limit(200);
      setContacts(data ?? []);
      setIsLoading(false);
    };
    loadContacts();
  }, []);

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesQuery = query
        ? [contact.full_name, contact.phone_e164]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase())
        : true;
      const matchesStatus = statusFilter === "all" || contact.status === statusFilter;
      const lastActivity =
        contact.last_received_at || contact.last_sent_at || contact.updated_at;
      const hasDueTask = (contact.tasks || []).some(
        (task: any) => task.status === "offen" && new Date(task.due_at) <= new Date()
      );
      const systemLabels = computeSystemLabels({
        date_erstgespraech: contact.date_erstgespraech,
        date_tattoo_termin: contact.date_tattoo_termin,
        price_deposit_cents: contact.price_deposit_cents,
        price_total_cents: contact.price_total_cents,
        has_due_task: hasDueTask,
        last_activity_at: lastActivity
      });
      const matchesSystem = systemFilters.length
        ? systemFilters.every((label) => systemLabels.includes(label))
        : true;
      return matchesQuery && matchesStatus && matchesSystem;
    });
  }, [contacts, query, statusFilter, systemFilters]);

  return (
    <div className="min-h-screen px-8 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kontakte</h1>
          <p className="text-sm text-text-muted">Mini-CRM Übersicht</p>
        </div>
        <Button variant="primary">Kontakt anlegen</Button>
      </header>

      <section className="mb-6 grid gap-4 rounded-lg border border-base-800 bg-base-850 p-4 md:grid-cols-3">
        <Input
          placeholder="Suche nach Name, Telefon, E-Mail"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">Alle Status</option>
          <option value="neu">Neu</option>
          <option value="in_bearbeitung">In Bearbeitung</option>
          <option value="termin">Termin</option>
          <option value="abgeschlossen">Abgeschlossen</option>
          <option value="verloren">Verloren</option>
        </select>
        <div className="flex flex-wrap gap-2">
          {systemLabelOptions.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() =>
                setSystemFilters((prev) =>
                  prev.includes(label)
                    ? prev.filter((item) => item !== label)
                    : [...prev, label]
                )
              }
            >
              <Chip label={label} selected={systemFilters.includes(label)} />
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-base-800 bg-base-850">
        <div className="grid grid-cols-4 gap-4 border-b border-base-800 px-4 py-3 text-xs uppercase text-text-muted">
          <span>Name</span>
          <span>Telefon</span>
          <span>Standort</span>
          <span>Status</span>
        </div>
        {isLoading ? (
          <div className="px-4 py-6 text-sm text-text-muted">Lade Daten...</div>
        ) : (
          filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="grid grid-cols-4 gap-4 border-b border-base-800 px-4 py-3 text-sm"
            >
              <span>{contact.full_name || "Unbekannt"}</span>
              <span>{contact.phone_e164}</span>
              <span>{contact.location?.name ?? "-"}</span>
              <span>{contact.status}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
