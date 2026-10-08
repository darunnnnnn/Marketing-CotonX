import { useState } from "react";
import type { ChangeEvent } from "react";
import { FileUp, Info } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { repo } from "../../lib/domain/repository";
import { lookupByEmail } from "../../lib/enrichment";
import { COUNTRY_BY_CODE } from "../../lib/domain/countries";
import type { Company, Contact } from "../../lib/domain/types";
import "../../styles/table.css";

type Parsed = {
  email: string;
  name?: string;
  company?: string;
  country?: string;
  designation?: string;
  phone?: string;
  problem?: string;
};

/** Minimal CSV reader — handles quoted fields and embedded commas. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<string, keyof Parsed> = {
  email: "email",
  "email address": "email",
  "e-mail": "email",
  mail: "email",
  name: "name",
  "contact name": "name",
  "full name": "name",
  person: "name",
  company: "company",
  "company name": "company",
  organisation: "company",
  organization: "company",
  country: "country",
  designation: "designation",
  title: "designation",
  "job title": "designation",
  role: "designation",
  phone: "phone",
  telephone: "phone",
  mobile: "phone",
};

export function Imports() {
  const [rows, setRows] = useState<Parsed[]>([]);
  const [fileName, setFileName] = useState("");
  const [done, setDone] = useState(0);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setDone(0);

    const table = parseCsv(await file.text());
    if (table.length < 2) {
      setRows([]);
      return;
    }

    const headers = table[0].map((header) => HEADER_ALIASES[header.toLowerCase()] ?? null);

    const parsed = table.slice(1).map((cells) => {
      const record: Parsed = { email: "" };
      headers.forEach((field, index) => {
        if (field) record[field] = cells[index] as never;
      });

      if (!record.email) {
        record.problem = "No email column value";
        return record;
      }

      /* Fill the gaps the file left using what the address itself reveals. */
      const guess = lookupByEmail(record.email);
      if (!guess.valid) {
        record.problem = guess.problem;
        return record;
      }
      record.company ??= guess.record.companyName?.value;
      record.country ??= guess.record.countryCode?.value;
      record.name ??= guess.record.contactName?.value;
      record.designation ??= guess.record.roleCategory?.value;
      return record;
    });

    setRows(parsed);
  };

  const importAll = async () => {
    const usable = rows.filter((row) => !row.problem);
    const now = new Date().toISOString();

    const companies: Company[] = [];
    const contacts: Contact[] = [];

    for (const row of usable) {
      const domain = row.email.split("@")[1];
      const code = (row.country ?? "").toUpperCase();
      const profile = COUNTRY_BY_CODE.get(code);
      const companyId = `csv-${domain}`;

      companies.push({
        id: companyId,
        name: row.company ?? domain,
        domain,
        countryCode: profile?.code ?? code,
        country: profile?.name ?? code,
        verified: false,
        sources: ["manual"],
        createdAt: now,
      });

      contacts.push({
        id: `csv-${row.email}`,
        companyId,
        name: row.name,
        email: row.email,
        phone: row.phone,
        designation: row.designation,
        rolePriority: "medium",
        preferredLanguage: profile?.language ?? "en",
        status: "never_contacted",
        sequencePosition: {},
        verified: false,
        sources: ["manual"],
        doNotContact: false,
        callConsent: false,
        createdAt: now,
      });
    }

    await repo.addCompanies(companies);
    await repo.addContacts(contacts);
    setDone(usable.length);
  };

  const bad = rows.filter((row) => row.problem).length;

  return (
    <div className="page">
      <p className="page__lead">
        Bring in buyer lists from trade fairs, spreadsheets or a Gmail Takeout
        export. Columns are matched by name, and anything the file leaves blank
        is filled in from the email address where possible.
      </p>

      <Card title="Upload a CSV">
        <input type="file" accept=".csv,text/csv" onChange={(event) => void onFile(event)} />
        {fileName && (
          <p className="table__sub" style={{ marginTop: "var(--s-3)" }}>
            {fileName} — {rows.length} rows, {bad} with problems
          </p>
        )}
        <div className="notice notice--info" style={{ marginTop: "var(--s-4)" }}>
          <Info size={16} strokeWidth={2} />
          <span>
            Recognised column names: email, name, company, country, designation,
            phone. Order does not matter and unknown columns are ignored.
            Everything imports <strong>unverified</strong> and lands in the review
            queue.
          </span>
        </div>
      </Card>

      {rows.length > 0 && (
        <Card
          title="Preview"
          action={
            done > 0 ? (
              <Badge tone="green">{done} imported</Badge>
            ) : (
              <Button variant="primary" onClick={() => void importAll()}>
                <FileUp size={16} strokeWidth={2} />
                Import {rows.length - bad} rows
              </Button>
            )
          }
          flushBody
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Country</th>
                  <th>Designation</th>
                  <th>Phone</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row, index) => (
                  <tr key={`${row.email}-${index}`}>
                    <td className="table__primary">{row.email || "—"}</td>
                    <td>{row.name ?? "—"}</td>
                    <td>{row.company ?? "—"}</td>
                    <td>{row.country ?? "—"}</td>
                    <td>{row.designation ?? "—"}</td>
                    <td>{row.phone ?? "—"}</td>
                    <td>
                      {row.problem ? <Badge tone="rose">{row.problem}</Badge> : <Badge tone="green">Ready</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {rows.length === 0 && (
        <Card flushBody>
          <EmptyState icon={FileUp} title="No file loaded" hint="Choose a CSV above to see how it will be interpreted before anything is imported." />
        </Card>
      )}
    </div>
  );
}
