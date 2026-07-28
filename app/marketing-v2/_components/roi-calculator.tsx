"use client";

import { useMemo, useState } from "react";
import styles from "../page.module.css";

export function RoiCalculator() {
  const [hoursPerWeek, setHoursPerWeek] = useState(4);
  const [hourlyCost, setHourlyCost] = useState(25);
  const [reductionPercent, setReductionPercent] = useState(25);
  const result = useMemo(() => {
    const monthlyHours = hoursPerWeek * 4.33 * (reductionPercent / 100);
    return {
      monthlyHours,
      monthlyValue: monthlyHours * hourlyCost,
    };
  }, [hourlyCost, hoursPerWeek, reductionPercent]);

  return (
    <section className={styles.roiCalculator} aria-labelledby="roi-title">
      <div>
        <span>Calculadora de hipótesis</span>
        <h2 id="roi-title">Pon tus supuestos. No confundas una estimación con un resultado.</h2>
        <p>
          La fórmula estima tiempo administrativo potencialmente liberado. No usa
          datos de clientes ni afirma ahorro real; la validación exige una cohorte medida.
        </p>
      </div>
      <div className={styles.roiInputs}>
        <label>
          <span>Horas administrativas por semana</span>
          <input type="number" min="0" max="80" step="0.5" value={hoursPerWeek} onChange={(event) => setHoursPerWeek(safeNumber(event.target.value, 0, 80))} />
        </label>
        <label>
          <span>Coste interno por hora (€)</span>
          <input type="number" min="0" max="500" step="1" value={hourlyCost} onChange={(event) => setHourlyCost(safeNumber(event.target.value, 0, 500))} />
        </label>
        <label>
          <span>Reducción hipotética (%)</span>
          <input type="number" min="0" max="100" step="1" value={reductionPercent} onChange={(event) => setReductionPercent(safeNumber(event.target.value, 0, 100))} />
        </label>
      </div>
      <dl className={styles.roiResults}>
        <div>
          <dt>Tiempo mensual hipotético</dt>
          <dd>{formatNumber(result.monthlyHours)} h</dd>
        </div>
        <div>
          <dt>Valor bruto hipotético</dt>
          <dd>{formatCurrency(result.monthlyValue)}</dd>
        </div>
      </dl>
      <details>
        <summary>Ver metodología y límites</summary>
        <p>
          Horas semanales × 4,33 semanas × porcentaje editable. El valor bruto
          multiplica ese tiempo por el coste indicado. No descuenta licencia,
          implantación, soporte, errores, curva de aprendizaje ni trabajo que no
          desaparece. No debe usarse como promesa comercial.
        </p>
      </details>
    </section>
  );
}

function safeNumber(value: string, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}
