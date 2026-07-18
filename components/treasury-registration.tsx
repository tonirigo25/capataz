import { createCashMovement, createCashTransfer, createFinancialAccount } from "@/app/(app)/tesoreria/actions";
import type { ReactNode } from "react";

type Account = { id: string; name: string };

export function TreasuryRegistration({ accounts, returnTo }: { accounts: Account[]; returnTo: string }) {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const dateValue = now.toISOString().slice(0, 16);

  return (
    <section aria-labelledby="treasury-registration" className="section-shell">
      <div className="mb-4">
        <h2 id="treasury-registration" className="type-section-title text-content">Registro de caja</h2>
        <p className="type-secondary mt-1 max-w-3xl">Flujos existentes para mantener cuentas, movimientos y transferencias. La previsión por vencimientos no crea movimientos bancarios.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <details className="rounded-xl border border-border bg-surface p-4" open={!accounts.length}>
          <summary className="cursor-pointer font-semibold text-content">Crear cuenta o caja</summary>
          <form action={createFinancialAccount} className="mt-4 grid gap-3">
            <input type="hidden" name="returnTo" value={returnTo} />
            <Field label="Nombre"><input className="field" name="name" required /></Field>
            <Field label="Tipo"><select className="field" name="type" defaultValue="bank"><option value="bank">Cuenta bancaria manual</option><option value="cash">Caja</option><option value="other">Otra cuenta</option></select></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Saldo inicial"><input className="field" name="openingBalance" type="number" step="0.01" defaultValue="0" required /></Field><Field label="Saldo mínimo"><input className="field" name="minimumBalance" type="number" step="0.01" /></Field></div>
            <input type="hidden" name="currency" value="EUR" />
            <button className="primary-button" type="submit">Guardar cuenta</button>
          </form>
        </details>

        <details className="rounded-xl border border-border bg-surface p-4">
          <summary className="cursor-pointer font-semibold text-content">Registrar movimiento</summary>
          {accounts.length ? <form action={createCashMovement} className="mt-4 grid gap-3">
            <input type="hidden" name="returnTo" value={returnTo} />
            <Field label="Cuenta"><select className="field" name="accountId" required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field>
            <Field label="Tipo"><select className="field" name="type" defaultValue="inflow"><option value="inflow">Entrada</option><option value="outflow">Salida</option><option value="adjustment">Ajuste</option></select></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Importe"><input className="field" name="amount" type="number" step="0.01" required /></Field><Field label="Fecha"><input className="field" name="date" type="datetime-local" defaultValue={dateValue} required /></Field></div>
            <Field label="Descripción"><input className="field" name="description" required /></Field>
            <button className="primary-button" type="submit">Registrar movimiento</button>
          </form> : <p className="type-secondary mt-4">Crea primero una cuenta o caja.</p>}
        </details>

        <details className="rounded-xl border border-border bg-surface p-4">
          <summary className="cursor-pointer font-semibold text-content">Transferir entre cuentas</summary>
          {accounts.length > 1 ? <form action={createCashTransfer} className="mt-4 grid gap-3">
            <input type="hidden" name="returnTo" value={returnTo} />
            <div className="grid grid-cols-2 gap-3"><Field label="Desde"><select className="field" name="fromAccountId" required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Hasta"><select className="field" name="toAccountId" required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field></div>
            <Field label="Importe"><input className="field" name="amount" type="number" step="0.01" min="0.01" required /></Field>
            <Field label="Fecha"><input className="field" name="date" type="datetime-local" defaultValue={dateValue} required /></Field>
            <input type="hidden" name="description" value="Transferencia entre cuentas" />
            <button className="primary-button" type="submit">Registrar transferencia</button>
          </form> : <p className="type-secondary mt-4">Se necesitan al menos dos cuentas activas.</p>}
        </details>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label><span className="label mb-1 block">{label}</span>{children}</label>;
}
