import React, { useState } from "react";
import { BankAccountValidation } from "@data8/types";
import createClient from "openapi-fetch";

const API_KEY = import.meta.env.API_KEY;

const client = createClient<BankAccountValidation.paths>({
  baseUrl: "https://webservices.data-8.co.uk",
});

async function validateBankDetails(sortCode: string, accountNumber: string) {
  const { data, error } = await client.POST("/BankAccountValidation/IsValid.json", {
    headers: { "content-type": "application/json" },
    body: { username: "apikey-" + API_KEY, bankAccountNumber: accountNumber, sortCode},
  });
  if (error) throw new Error(JSON.stringify(error));
  return data;
}

type ValidationResult = Awaited<ReturnType<typeof validateBankDetails>>;

function ResultCard({ result }: { result: ValidationResult }) {
  if (!result) return null;
  const isValid = result.Valid === "Valid";
  return (
    <article style={{ marginTop: "1.5rem", borderLeft: `4px solid ${isValid ? "#2ecc40" : "#ff4136"}`, paddingLeft: "1rem" }}>
      <h3 style={{ color: isValid ? "#2ecc40" : "#ff4136", margin: "0 0 0.5rem" }}>
        {isValid ? "✓ Valid" : "✗ Invalid"}
      </h3>
      <p style={{ margin: 0, color: "#555" }}>{result.Valid}</p>
    </article>
  );
}

export default function BankAccountValidationPage() {
  const [sortCode, setSortCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sortCode.trim() || !accountNumber.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await validateBankDetails(sortCode, accountNumber);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <fieldset style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <input
            type="text"
            value={sortCode}
            onChange={(e) => setSortCode(e.target.value)}
            placeholder="Enter sort code"
            required
            disabled={loading}
          />
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="Enter account number"
            required
            disabled={loading}
          />
          <button type="submit" aria-busy={loading} disabled={loading}>
            {loading ? "Validating…" : "Validate"}
          </button>
        </fieldset>
      </form>

      {error && <p style={{ color: "#ff4136" }}>{error}</p>}
      {result && <ResultCard result={result} />}
    </div>
  );
}
