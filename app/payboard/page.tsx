"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Input } from "@/components/ui";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

type LocationOption = {
  id: string;
  name: string;
};

type ContactOption = {
  id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone_e164?: string | null;
};

type JobRow = {
  id: string;
  contact: ContactOption | null;
  location: LocationOption | null;
  artist_free_text: string | null;
  session_date: string | null;
  total_cents: number;
  deposit_cents: number | null;
  status: string;
  created_at: string;
  paid_total_cents: number;
  paid_in_month_cents: number;
  open_cents: number;
};

type RevenueStats = {
  revenue_cents: number;
  jobs_count: number;
  payments_count: number;
};

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR"
});

function formatCents(value: number) {
  return currencyFormatter.format((value || 0) / 100);
}

function createMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString("de-DE", {
      month: "long",
      year: "numeric"
    });
    options.push({ value, label });
  }
  return options;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("de-DE");
}

function getContactDisplayName(contact: ContactOption) {
  const directName = contact.name?.trim();
  if (directName) return directName;

  const firstName = contact.first_name?.trim() ?? "";
  const lastName = contact.last_name?.trim() ?? "";
  const combinedName = `${firstName} ${lastName}`.trim();
  if (combinedName) return combinedName;

  const phone = contact.phone_e164?.trim();
  if (phone) return phone;

  return "—";
}

export default function PayboardPage() {
  const monthOptions = useMemo(() => createMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value ?? "");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [revenue, setRevenue] = useState<RevenueStats>({
    revenue_cents: 0,
    jobs_count: 0,
    payments_count: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showJobForm, setShowJobForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobRow | null>(null);
  const [showOnlyMonthPayments, setShowOnlyMonthPayments] = useState(false);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [jobForm, setJobForm] = useState({
    contact_id: "",
    location_id: "",
    artist_free_text: "",
    session_date: "",
    total_eur: "",
    deposit_eur: "",
    status: "geplant"
  });
  const [paymentForm, setPaymentForm] = useState({
    paid_eur: "",
    paid_at: "",
    method: "bar"
  });

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter((contact) => {
      const name = contact.name?.toLowerCase() ?? "";
      const firstName = contact.first_name?.toLowerCase() ?? "";
      const lastName = contact.last_name?.toLowerCase() ?? "";
      const phone = contact.phone_e164?.toLowerCase() ?? "";
      return name.includes(q) || firstName.includes(q) || lastName.includes(q) || phone.includes(q);
    });
  }, [contacts, contactSearch]);

  const loadLocations = async () => {
    const response = await fetchWithAuth("/api/contacts/stats");
    if (!response.ok) return;
    const payload = await response.json();
    const options = (payload?.stats?.byLocation ?? []).map((loc: any) => ({
      id: String(loc.id),
      name: String(loc.name)
    }));
    setLocations(options);
  };

  const loadJobs = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetchWithAuth(
        `/api/payboard/jobs?month=${selectedMonth}&location_id=${selectedLocation}`
      );
      if (!response.ok) {
        const text = await response.text();
        setErrorMessage(text);
        return;
      }
      const payload = await response.json();
      setJobs(payload.jobs ?? []);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Fehler beim Laden");
    } finally {
      setIsLoading(false);
    }
  };

  const loadRevenue = async () => {
    const response = await fetchWithAuth(
      `/api/payboard/revenue?month=${selectedMonth}&location_id=${selectedLocation}`
    );
    if (!response.ok) return;
    const payload = await response.json();
    setRevenue({
      revenue_cents: Number(payload.revenue_cents ?? 0),
      jobs_count: Number(payload.jobs_count ?? 0),
      payments_count: Number(payload.payments_count ?? 0)
    });
  };

  const loadContacts = async () => {
    const response = await fetchWithAuth("/api/contacts/list?pageSize=200");
    if (!response.ok) return;
    const payload = await response.json();
    setContacts(payload.contacts ?? []);
  };

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (!selectedMonth) return;
    loadJobs();
    loadRevenue();
  }, [selectedMonth, selectedLocation]);

  const visibleJobs = useMemo(() => {
    if (!showOnlyMonthPayments) return jobs;
    return jobs.filter((job) => Number(job.paid_in_month_cents ?? 0) > 0);
  }, [jobs, showOnlyMonthPayments]);

  const handleOpenJobForm = () => {
    setShowJobForm(true);
    setShowPaymentForm(false);
    setSelectedJob(null);
    setJobForm({
      contact_id: "",
      location_id: "",
      artist_free_text: "",
      session_date: "",
      total_eur: "",
      deposit_eur: "",
      status: "geplant"
    });
    setContactSearch("");
    loadContacts();
  };

  const handleJobSubmit = async () => {
    const totalCents = Math.round(Number(jobForm.total_eur.replace(",", ".")) * 100);
    const depositCentsRaw = jobForm.deposit_eur.trim()
      ? Math.round(Number(jobForm.deposit_eur.replace(",", ".")) * 100)
      : null;

    if (!jobForm.contact_id || !jobForm.location_id) {
      setErrorMessage("Kontakt und Standort sind Pflichtfelder.");
      return;
    }
    if (!Number.isFinite(totalCents) || totalCents < 0) {
      setErrorMessage("Gesamtpreis muss >= 0 sein.");
      return;
    }
    if (depositCentsRaw !== null && (!Number.isFinite(depositCentsRaw) || depositCentsRaw < 0)) {
      setErrorMessage("Anzahlung muss >= 0 sein.");
      return;
    }

    const response = await fetchWithAuth("/api/payboard/jobs", {
      method: "POST",
      body: JSON.stringify({
        contact_id: jobForm.contact_id,
        location_id: jobForm.location_id,
        artist_free_text: jobForm.artist_free_text,
        session_date: jobForm.session_date || null,
        total_cents: totalCents,
        deposit_cents: depositCentsRaw,
        status: jobForm.status
      })
    });

    if (!response.ok) {
      const text = await response.text();
      setErrorMessage(text);
      return;
    }
    setShowJobForm(false);
    setErrorMessage("");
    await loadJobs();
    await loadRevenue();
  };

  const handlePaymentOpen = (job: JobRow) => {
    setSelectedJob(job);
    setShowPaymentForm(true);
    setShowJobForm(false);
    setPaymentForm({
      paid_eur: "",
      paid_at: new Date().toISOString().slice(0, 10),
      method: "bar"
    });
  };

  const handlePaymentSubmit = async () => {
    if (!selectedJob) return;
    const paidCents = Math.round(Number(paymentForm.paid_eur.replace(",", ".")) * 100);
    if (!Number.isFinite(paidCents) || paidCents <= 0) {
      setErrorMessage("Betrag muss > 0 sein.");
      return;
    }
    const response = await fetchWithAuth("/api/payboard/payments", {
      method: "POST",
      body: JSON.stringify({
        job_id: selectedJob.id,
        paid_cents: paidCents,
        paid_at: paymentForm.paid_at || null,
        method: paymentForm.method
      })
    });

    if (!response.ok) {
      const text = await response.text();
      setErrorMessage(text);
      return;
    }
    setShowPaymentForm(false);
    setSelectedJob(null);
    setErrorMessage("");
    await loadJobs();
    await loadRevenue();
  };

  return (
    <AppShell
      title="Payboard"
      subtitle="Jobs & Payments Übersicht"
      action={
        <Button variant="primary" onClick={handleOpenJobForm}>
          Job anlegen
        </Button>
      }
    >
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-[220px]">
          <label className="text-xs uppercase text-text-muted">Monat</label>
          <select
            className="mt-1 w-full rounded-md border border-base-800 bg-base-950 px-3 py-2 text-sm"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[220px]">
          <label className="text-xs uppercase text-text-muted">Standort</label>
          <select
            className="mt-1 w-full rounded-md border border-base-800 bg-base-950 px-3 py-2 text-sm"
            value={selectedLocation}
            onChange={(event) => setSelectedLocation(event.target.value)}
          >
            <option value="all">Alle</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-base-800 bg-base-950"
            checked={showOnlyMonthPayments}
            onChange={(event) => setShowOnlyMonthPayments(event.target.checked)}
          />
          Nur Jobs mit Zahlungen im Monat
        </label>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-base-800 bg-base-900 p-4">
          <div className="text-xs uppercase text-text-muted">Umsatz Monat</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-200">
            {formatCents(revenue.revenue_cents)}
          </div>
        </div>
        <div className="rounded-lg border border-base-800 bg-base-900 p-4">
          <div className="text-xs uppercase text-text-muted">Jobs Count</div>
          <div className="mt-2 text-2xl font-semibold">{revenue.jobs_count}</div>
        </div>
        <div className="rounded-lg border border-base-800 bg-base-900 p-4">
          <div className="text-xs uppercase text-text-muted">Payments Count</div>
          <div className="mt-2 text-2xl font-semibold">{revenue.payments_count}</div>
        </div>
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-md border border-red-500/60 bg-red-500/10 p-3 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      {showJobForm ? (
        <div className="mb-8 rounded-lg border border-base-800 bg-base-900 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Job anlegen</h2>
            <Button variant="outline" onClick={() => setShowJobForm(false)}>
              Schließen
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase text-text-muted">Kontakt suchen</label>
              <Input
                className="mt-1"
                placeholder="Name oder Telefon"
                value={contactSearch}
                onChange={(event) => setContactSearch(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs uppercase text-text-muted">Kontakt auswählen</label>
              <select
                className="mt-1 w-full rounded-md border border-base-800 bg-base-950 px-3 py-2 text-sm"
                value={jobForm.contact_id}
                onChange={(event) =>
                  setJobForm((prev) => ({ ...prev, contact_id: event.target.value }))
                }
              >
                <option value="">Bitte wählen</option>
                {filteredContacts.map((contact) => {
                  const displayName = getContactDisplayName(contact);
                  const phoneSuffix =
                    contact.phone_e164 && displayName !== contact.phone_e164
                      ? `· ${contact.phone_e164}`
                      : "";
                  return (
                    <option key={contact.id} value={contact.id}>
                      {displayName} {phoneSuffix}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase text-text-muted">Standort</label>
              <select
                className="mt-1 w-full rounded-md border border-base-800 bg-base-950 px-3 py-2 text-sm"
                value={jobForm.location_id}
                onChange={(event) =>
                  setJobForm((prev) => ({ ...prev, location_id: event.target.value }))
                }
              >
                <option value="">Bitte wählen</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase text-text-muted">Artist</label>
              <Input
                className="mt-1"
                placeholder="Freitext"
                value={jobForm.artist_free_text}
                onChange={(event) =>
                  setJobForm((prev) => ({ ...prev, artist_free_text: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase text-text-muted">Gesamtpreis (EUR)</label>
              <Input
                className="mt-1"
                placeholder="0,00"
                value={jobForm.total_eur}
                onChange={(event) =>
                  setJobForm((prev) => ({ ...prev, total_eur: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase text-text-muted">Anzahlung (EUR)</label>
              <Input
                className="mt-1"
                placeholder="0,00"
                value={jobForm.deposit_eur}
                onChange={(event) =>
                  setJobForm((prev) => ({ ...prev, deposit_eur: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase text-text-muted">Termin</label>
              <Input
                className="mt-1"
                type="date"
                value={jobForm.session_date}
                onChange={(event) =>
                  setJobForm((prev) => ({ ...prev, session_date: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase text-text-muted">Status</label>
              <select
                className="mt-1 w-full rounded-md border border-base-800 bg-base-950 px-3 py-2 text-sm"
                value={jobForm.status}
                onChange={(event) =>
                  setJobForm((prev) => ({ ...prev, status: event.target.value }))
                }
              >
                <option value="geplant">Geplant</option>
                <option value="in_arbeit">In Arbeit</option>
                <option value="fertig">Fertig</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={handleJobSubmit}>
              Job speichern
            </Button>
          </div>
        </div>
      ) : null}

      {showPaymentForm && selectedJob ? (
        <div className="mb-8 rounded-lg border border-base-800 bg-base-900 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Zahlung hinzufügen</h2>
              <p className="text-sm text-text-muted">
                {selectedJob.contact?.name ?? "Unbekannter Kontakt"} ·{" "}
                {formatCents(selectedJob.total_cents)}
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowPaymentForm(false)}>
              Schließen
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-xs uppercase text-text-muted">Betrag (EUR)</label>
              <Input
                className="mt-1"
                placeholder="0,00"
                value={paymentForm.paid_eur}
                onChange={(event) =>
                  setPaymentForm((prev) => ({ ...prev, paid_eur: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase text-text-muted">Datum</label>
              <Input
                className="mt-1"
                type="date"
                value={paymentForm.paid_at}
                onChange={(event) =>
                  setPaymentForm((prev) => ({ ...prev, paid_at: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-xs uppercase text-text-muted">Methode</label>
              <select
                className="mt-1 w-full rounded-md border border-base-800 bg-base-950 px-3 py-2 text-sm"
                value={paymentForm.method}
                onChange={(event) =>
                  setPaymentForm((prev) => ({ ...prev, method: event.target.value }))
                }
              >
                <option value="bar">Bar</option>
                <option value="karte">Karte</option>
                <option value="ueberweisung">Überweisung</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={handlePaymentSubmit}>
              Zahlung speichern
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-base-800 bg-base-900">
        <div className="border-b border-base-800 px-4 py-3 text-sm text-text-muted">
          Jobs {isLoading ? "· Laden..." : ""}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-text-muted">
                <th className="px-4 py-2">Kontakt</th>
                <th className="px-4 py-2">Standort</th>
                <th className="px-4 py-2">Artist</th>
                <th className="px-4 py-2">Termin</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Offen</th>
                <th className="px-4 py-2">Fortschritt</th>
                <th className="px-4 py-2">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {visibleJobs.map((job) => {
                const total = Number(job.total_cents ?? 0);
                const paid = Number(job.paid_total_cents ?? 0);
                const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                return (
                  <tr key={job.id} className="border-t border-base-800">
                    <td className="px-4 py-3">
                      <div className="font-medium">{job.contact?.name ?? "Unbekannt"}</div>
                      <div className="text-xs text-text-muted">
                        {job.contact?.phone_e164 ?? "Keine Nummer"}
                      </div>
                    </td>
                    <td className="px-4 py-3">{job.location?.name ?? "—"}</td>
                    <td className="px-4 py-3">{job.artist_free_text ?? "—"}</td>
                    <td className="px-4 py-3">{formatDate(job.session_date)}</td>
                    <td className="px-4 py-3">{formatCents(total)}</td>
                    <td className="px-4 py-3">{formatCents(job.open_cents)}</td>
                    <td className="px-4 py-3">
                      <div className="h-2 w-40 overflow-hidden rounded-full bg-base-800">
                        <div
                          className="h-full bg-emerald-600"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        {progress}% · {formatCents(paid)}
                      </div>
                      <div className="mt-1 text-xs text-emerald-200">
                        Im Monat bezahlt: {formatCents(Number(job.paid_in_month_cents ?? 0))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="outline" onClick={() => handlePaymentOpen(job)}>
                        Zahlung hinzufügen
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {visibleJobs.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-text-muted" colSpan={8}>
                    Keine Jobs vorhanden.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
