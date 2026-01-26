export type CsvRow = Record<string, string>;

export type NormalizedContact = {
  gender?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone_raw?: string | null;
  phone_e164: string;
  email?: string | null;
  telegram?: string | null;
  source_origin?: string | null;
  form_size?: string | null;
  artist_booking?: string | null;
  created_in_system_at?: string | null;
  date_erstgespraech?: string | null;
  date_tattoo_termin?: string | null;
  price_deposit_cents?: number | null;
  price_total_cents?: number | null;
  last_sent_at?: string | null;
  last_received_at?: string | null;
  location_name?: string | null;
  labels?: string[];
};

export type ImportIssue = {
  row: number;
  field: string;
  message: string;
};

const labelSplitRegex = /,/g;

export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) {
    digits = `+${digits.slice(2)}`;
  }
  if (digits.startsWith("0") && !digits.startsWith("00")) {
    digits = `+49${digits.slice(1)}`;
  } else if (digits.startsWith("49") && !digits.startsWith("+") && !digits.startsWith("0049")) {
    digits = `+${digits}`;
  }
  if (digits.startsWith("+")) {
    digits = `+${digits.replace(/\D/g, "")}`;
  } else {
    digits = digits.replace(/\D/g, "");
    digits = `+${digits}`;
  }
  const numeric = digits.replace(/\D/g, "");
  if (numeric.length < 8 || numeric.length > 16) {
    return null;
  }
  return `+${numeric}`;
}

export function parseEuroCents(value: string): number | null {
  const cleaned = value
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  if (Number.isNaN(parsed)) return null;
  return Math.round(parsed * 100);
}

export function parseOptionalDate(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split("T")[0];
}

export function parseOptionalDateTime(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function mapRow(row: CsvRow, rowIndex: number): {
  contact: NormalizedContact | null;
  issues: ImportIssue[];
} {
  const issues: ImportIssue[] = [];
  const phoneRaw = row["Telefon"]?.trim() ?? "";
  const phoneE164 = normalizePhone(phoneRaw);
  if (!phoneE164) {
    issues.push({
      row: rowIndex,
      field: "Telefon",
      message: "Telefonnummer nicht gültig"
    });
  }

  const contact: NormalizedContact | null = phoneE164
    ? {
        gender: row["Geschlecht"] || null,
        first_name: row["Vorname"] || null,
        last_name: row["Nachname"] || null,
        phone_raw: phoneRaw || null,
        phone_e164: phoneE164,
        email: row["E-Mail-Adresse"] || null,
        telegram: row["Telegram Account"] || null,
        source_origin: row["Herkunft"] || null,
        form_size: row["Formular | Größe Tattoo"] || null,
        artist_booking: row["Buchung bei Artist"] || null,
        created_in_system_at: parseOptionalDateTime(row["Datum Eintragung"] || "") ?? null,
        date_erstgespraech: parseOptionalDate(row["Datum Erstgespräch"] || "") ?? null,
        date_tattoo_termin: parseOptionalDate(row["Datum Tattoo-Termin"] || "") ?? null,
        price_deposit_cents: row["Preis | Anzahlung"]
          ? parseEuroCents(row["Preis | Anzahlung"])
          : null,
        price_total_cents: row["Preis | Gesamt"]
          ? parseEuroCents(row["Preis | Gesamt"])
          : null,
        last_sent_at: parseOptionalDateTime(row["Zuletzt gesendete Nachricht am"] || "") ?? null,
        last_received_at:
          parseOptionalDateTime(row["Zuletzt empfangene Nachricht am"] || "") ?? null,
        location_name: row["Standort"] || null,
        labels: row["Labels"]
          ? row["Labels"]
              .split(labelSplitRegex)
              .map((label) => label.trim())
              .filter(Boolean)
          : []
      }
    : null;

  return { contact, issues };
}
