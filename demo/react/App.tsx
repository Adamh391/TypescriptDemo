import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import EmailValidationPage from "./pages/EmailValidationPage";
import PredictiveAddressPage from "./pages/PredictiveAddressPage";
import PredictiveAddressHostPage from "./pages/PredictiveAddressHostPage";
import BankAccountValidationPage from "./pages/BankAccountValidationPage";
import PhoneValidationPage from "./pages/PhoneValidationPage";
import "../helpers/data8-theme.css";

const API_KEY = import.meta.env.API_KEY;

function MissingApiKeyMessage() {
  return (
    <main className="container demo-shell">
      <DemoHeader framework="React" />
      <section className="demo-content">
        <h2 className="message--warning">Missing API_KEY environment variable</h2>
        <p>
          This demo requires an API key in <code>API_KEY</code> before it can call Data8 services.
        </p>
        <p>
          Add <code>API_KEY=your-key-here</code> to a <code>.env</code> file in the project root,
          then restart the dev server.
        </p>
        <p>
          If you do not have a key yet, create one at{" "}
          <a href="https://portal.data-8.co.uk/development/api-keys" target="_blank" rel="noreferrer">
            https://portal.data-8.co.uk/development/api-keys
          </a>
          .
        </p>
      </section>
    </main>
  );
}

function DemoHeader({ framework }: { framework: string }) {
  return (
    <header className="demo-header">
      <div>
        <h1 className="demo-brand-title">Data<span>8</span></h1>
        <p className="demo-brand-subtitle">{framework} demonstration</p>
      </div>
    </header>
  );
}

const tabs = [
  { id: "email", label: "Email Validation", component: EmailValidationPage },
  { id: "address", label: "Predictive Address", component: PredictiveAddressPage },
  { id: "address-host", label: "Predictive Address Component", component: PredictiveAddressHostPage },
  { id: "bank", label: "Bank Account Validation", component: BankAccountValidationPage },
  { id: "phone", label: "Phone Validation", component: PhoneValidationPage },
] as const;

function App() {
  const [activeTab, setActiveTab] = useState<string>("email");
  const ActiveComponent = tabs.find((t) => t.id === activeTab)!.component;

  return (
    <main className="container demo-shell">
      <DemoHeader framework="React" />
      <nav className="service-tabs" aria-label="Data8 services">
        <ul>
          {tabs.map((tab) => (
            <li key={tab.id}>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab(tab.id); }}
                aria-current={activeTab === tab.id ? "page" : undefined}
              >
                {tab.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <section className="demo-content">
        <ActiveComponent />
      </section>
    </main>
  );
}

const root = createRoot(document.getElementById("root")!);

if (!API_KEY) {
  console.error(
    "Missing API_KEY. Add API_KEY=your-key-here to a .env file in the project root and restart the dev server. Get a key at https://portal.data-8.co.uk/development/api-keys"
  );
  root.render(<MissingApiKeyMessage />);
} else {
  root.render(<App />);
}
