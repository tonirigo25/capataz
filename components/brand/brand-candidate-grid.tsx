import { BrandCandidate } from "@/components/brand/brand-mark";

const candidates = [
  {
    id: "relay" as const,
    name: "Relay",
    description: "Cuatro decisiones conectadas por una ruta legible. Es el símbolo seleccionado.",
    selected: true,
  },
  {
    id: "weave" as const,
    name: "Trama",
    description: "Tres responsabilidades coordinadas por un flujo central.",
    selected: false,
  },
  {
    id: "bridge" as const,
    name: "Puente",
    description: "Módulos independientes que convergen en una entrega compartida.",
    selected: false,
  },
] as const;

const sizes = [16, 24, 32, 64, 128] as const;

export function BrandCandidateGrid() {
  return (
    <section className="brand-candidates" aria-labelledby="brand-candidates-title">
      <div className="brand-candidates__intro">
        <p className="marketing-eyebrow">Exploración vectorial</p>
        <h2 id="brand-candidates-title" className="marketing-title">Tres caminos. Una identidad propia.</h2>
        <p>
          Relay se selecciona por su lectura nítida a 16 px, su trayectoria abierta y su neutralidad sectorial.
          No depende de una inicial ni de un icono de oficio.
        </p>
      </div>
      <div className="brand-candidates__grid">
        {candidates.map((candidate) => (
          <article key={candidate.id} className="brand-candidate">
            <header>
              <div>
                <span>Candidato {candidate.id === "relay" ? "01" : candidate.id === "weave" ? "02" : "03"}</span>
                <h3>{candidate.name}</h3>
              </div>
              {candidate.selected ? <strong>Seleccionado</strong> : null}
            </header>
            <p>{candidate.description}</p>
            <div className="brand-candidate__sizes" aria-label={`${candidate.name} en cinco tamaños`}>
              {sizes.map((size) => (
                <span key={size}>
                  <BrandCandidate candidate={candidate.id} style={{ width: size, height: size }} />
                  <small>{size}</small>
                </span>
              ))}
            </div>
            <div className="brand-candidate__grounds">
              <span className="is-light"><BrandCandidate candidate={candidate.id} /></span>
              <span className="is-dark"><BrandCandidate candidate={candidate.id} /></span>
              <span className="is-mono"><BrandCandidate candidate={candidate.id} /></span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
