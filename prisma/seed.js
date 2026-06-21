const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const baseDay = new Date();
const at = (offset, hour = 9, minute = 0) =>
  new Date(baseDay.getFullYear(), baseDay.getMonth(), baseDay.getDate() + offset, hour, minute, 0);

async function main() {
  await prisma.usuarioPerfil.deleteMany();
  await prisma.empresa.deleteMany();
  await prisma.eventoAgenda.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.material.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.work.deleteMany();
  await prisma.client.deleteMany();

  await prisma.client.createMany({
    data: [
      {
        id: "client-juan",
        nombre: "Juan Perez",
        telefono: "+34 600 111 222",
        email: "juan.perez@example.com",
        direccion: "Calle Mayor 18, Getafe",
        tipo: "Particular",
        estado: "obra_activa",
        origen: "WhatsApp",
        notas: "Quiere rematar la cocina antes de final de mes.",
        fechaCreacion: at(-36),
        ultimaInteraccion: at(0, 8, 20)
      },
      {
        id: "client-marta",
        nombre: "Marta López",
        telefono: "+34 611 333 444",
        email: "marta.lopez@example.com",
        direccion: "Avenida del Puerto 42, Valencia",
        tipo: "Particular",
        estado: "seguimiento_pendiente",
        origen: "Referido",
        notas: "Presupuesto enviado, falta toque de seguimiento.",
        fechaCreacion: at(-18),
        ultimaInteraccion: at(-3, 17, 30)
      },
      {
        id: "client-lozano",
        nombre: "Reformas Lozano",
        telefono: "+34 622 555 666",
        email: "obra@lozano.example.com",
        direccion: "Poligono Sur nave 7, Leganes",
        tipo: "Pyme",
        estado: "pendiente_datos",
        origen: "Web",
        notas: "Faltan medidas y fotos de dos banos.",
        fechaCreacion: at(-8),
        ultimaInteraccion: at(-1, 11, 10)
      },
      {
        id: "client-ana",
        nombre: "Ana Gomez",
        telefono: "+34 633 777 888",
        email: "ana.gomez@example.com",
        direccion: "Calle Olivo 5, Madrid",
        tipo: "Particular",
        estado: "presupuesto_pendiente",
        origen: "Instagram",
        notas: "Pidio precio para alicatado y plato de ducha.",
        fechaCreacion: at(-5),
        ultimaInteraccion: at(-2, 19, 0)
      },
      {
        id: "client-cafe",
        nombre: "Cafe Norte",
        telefono: "+34 644 999 000",
        email: "admin@cafenorte.example.com",
        direccion: "Plaza Nueva 3, Alcobendas",
        tipo: "Negocio",
        estado: "pendiente_cobro",
        origen: "Cliente recurrente",
        notas: "Factura vencida por remates del aseo.",
        fechaCreacion: at(-60),
        ultimaInteraccion: at(-6, 10, 45)
      },
      {
        id: "client-pedro",
        nombre: "Pedro Sanchez",
        telefono: "+34 655 444 222",
        email: "pedro.sanchez@example.com",
        direccion: "Calle Rio 11, Madrid",
        tipo: "Particular",
        estado: "visita_pendiente",
        origen: "Llamada",
        notas: "Quiere revisar humedades y pintar dormitorio.",
        fechaCreacion: at(-3),
        ultimaInteraccion: at(-1, 18, 20)
      },
      {
        id: "client-ruiz",
        nombre: "Construcciones Ruiz",
        telefono: "+34 666 333 111",
        email: "admin@ruiz.example.com",
        direccion: "Avenida Industria 22, Fuenlabrada",
        tipo: "Pyme",
        estado: "pendiente_cobro",
        origen: "Cliente recurrente",
        notas: "Vencimiento de factura próximo para repasar.",
        fechaCreacion: at(-42),
        ultimaInteraccion: at(-4, 9, 15)
      }
    ]
  });

  await prisma.empresa.create({
    data: {
      id: "empresa-demo",
      nombreComercial: "Reformas Rigo",
      razonSocial: "Reformas Rigo SL",
      nifCif: "B12345678",
      direccionFiscal: "Calle Oficios 21",
      codigoPostal: "28020",
      ciudad: "Madrid",
      provincia: "Madrid",
      pais: "España",
      telefono: "+34 600 000 000",
      email: "hola@reformasrigo.example",
      web: "https://reformasrigo.example",
      personaContacto: "Antonio Rigo",
      iban: "ES00 0000 0000 0000 0000 0000",
      condicionesPorDefecto: "Validez 15 días. Forma de pago según presupuesto aceptado.",
      textoLegal: "Documento interno demo. Verificar datos fiscales con gestoría.",
      logoUrl: "/icons/capataz.svg",
      selloUrl: "/icons/capataz.svg",
      colorMarca: "#f6c945",
      ivaDefecto: 21,
      seriePresupuestos: "2026",
      serieFacturas: "2026",
      prefijoPresupuesto: "PRES",
      prefijoFactura: "FAC"
    }
  });

  await prisma.work.createMany({
    data: [
      {
        id: "work-cocina-juan",
        clienteId: "client-juan",
        titulo: "Cocina Juan",
        direccion: "Calle Mayor 18, Getafe",
        tipoTrabajo: "Reforma de cocina",
        estado: "en_curso",
        fechaInicio: at(-9),
        fechaFinPrevista: at(8),
        presupuestoAprobado: 9200,
        gastoReal: 2680,
        margenEstimado: 2440,
        notas: "Pendiente encimera y remates de lechada."
      },
      {
        id: "work-bano-cafe",
        clienteId: "client-cafe",
        titulo: "Aseo Cafe Norte",
        direccion: "Plaza Nueva 3, Alcobendas",
        tipoTrabajo: "Bano comercial",
        estado: "pendiente_remates",
        fechaInicio: at(-24),
        fechaFinPrevista: at(-3),
        presupuestoAprobado: 5800,
        gastoReal: 4100,
        margenEstimado: 850,
        notas: "Falta silicona de mampara y cobrar factura final."
      },
      {
        id: "work-atico-marta",
        clienteId: "client-marta",
        titulo: "Pintura atico Marta",
        direccion: "Avenida del Puerto 42, Valencia",
        tipoTrabajo: "Pintura y pequenos remates",
        estado: "pendiente_inicio",
        fechaInicio: at(5),
        fechaFinPrevista: at(9),
        presupuestoAprobado: 2600,
        gastoReal: 0,
        margenEstimado: 760,
        notas: "Esperando aceptacion final del presupuesto."
      }
    ]
  });

  await prisma.budget.createMany({
    data: [
      {
        id: "budget-2026-001",
        clienteId: "client-juan",
        obraId: "work-cocina-juan",
        numero: "P-2026-001",
        titulo: "Reforma cocina completa",
        partidas: JSON.stringify([
          { concepto: "Demolicion y desescombro", cantidad: 1, precio: 950 },
          { concepto: "Fontaneria y electricidad", cantidad: 1, precio: 1850 },
          { concepto: "Alicatado y pavimento", cantidad: 1, precio: 2900 },
          { concepto: "Mano de oficial y peon", cantidad: 1, precio: 1900 }
        ]),
        subtotal: 7600,
        iva: 1596,
        total: 9196,
        margenEstimado: 2440,
        estado: "aceptado",
        fechaCreacion: at(-34),
        fechaEnvio: at(-32),
        fechaSeguimiento: at(-29),
        condiciones: "Validez 30 dias. Materiales de gama media incluidos."
      },
      {
        id: "budget-2026-002",
        clienteId: "client-marta",
        obraId: "work-atico-marta",
        numero: "P-2026-002",
        titulo: "Pintura atico y remates",
        partidas: JSON.stringify([
          { concepto: "Preparacion y tapado", cantidad: 1, precio: 380 },
          { concepto: "Pintura plastica paredes y techos", cantidad: 1, precio: 1420 },
          { concepto: "Remates y limpieza final", cantidad: 1, precio: 350 }
        ]),
        subtotal: 2150,
        iva: 451.5,
        total: 2601.5,
        margenEstimado: 760,
        estado: "pendiente_respuesta",
        fechaCreacion: at(-12),
        fechaEnvio: at(-10),
        fechaSeguimiento: at(1, 10),
        condiciones: "Inicio sujeto a disponibilidad de materiales."
      },
      {
        id: "budget-2026-003",
        clienteId: "client-ana",
        obraId: null,
        numero: "P-2026-003",
        titulo: "Bano con plato y mampara",
        partidas: JSON.stringify([
          { concepto: "Roza, fonta y colocacion plato", cantidad: 1, precio: 1150 },
          { concepto: "Alicatao zona ducha", cantidad: 1, precio: 980 },
          { concepto: "Mampara frontal", cantidad: 1, precio: 490 }
        ]),
        subtotal: 2620,
        iva: 550.2,
        total: 3170.2,
        margenEstimado: 920,
        estado: "borrador",
        fechaCreacion: at(-2),
        fechaEnvio: null,
        fechaSeguimiento: null,
        condiciones: "Pendiente confirmar medidas exactas."
      },
      {
        id: "budget-2026-004",
        clienteId: "client-lozano",
        obraId: null,
        numero: "P-2026-004",
        titulo: "Dos banos nave Lozano",
        partidas: JSON.stringify([
          { concepto: "Visita tecnica y medicion", cantidad: 1, precio: 0 },
          { concepto: "Partidas pendientes de definir", cantidad: 1, precio: 0 }
        ]),
        subtotal: 0,
        iva: 0,
        total: 0,
        margenEstimado: 0,
        estado: "pendiente_revision",
        fechaCreacion: at(-1),
        fechaEnvio: null,
        fechaSeguimiento: null,
        condiciones: "Faltan fotos, medidas y calidades."
      }
    ]
  });

  await prisma.invoice.createMany({
    data: [
      {
        id: "invoice-2026-011",
        clienteId: "client-juan",
        obraId: "work-cocina-juan",
        numero: "F-2026-011",
        concepto: "Primer hito cocina Juan",
        importeBase: 991.74,
        iva: 208.26,
        total: 1200,
        pagado: 500,
        pendiente: 700,
        fechaEmision: at(-5),
        fechaVencimiento: at(5),
        estado: "parcialmente_pagada"
      },
      {
        id: "invoice-2026-009",
        clienteId: "client-cafe",
        obraId: "work-bano-cafe",
        numero: "F-2026-009",
        concepto: "Factura final aseo Cafe Norte",
        importeBase: 1487.6,
        iva: 312.4,
        total: 1800,
        pagado: 0,
        pendiente: 1800,
        fechaEmision: at(-18),
        fechaVencimiento: at(-4),
        estado: "vencida"
      },
      {
        id: "invoice-2026-010",
        clienteId: "client-marta",
        obraId: "work-atico-marta",
        numero: "F-2026-010",
        concepto: "Senal pintura atico",
        importeBase: 743.8,
        iva: 156.2,
        total: 900,
        pagado: 900,
        pendiente: 0,
        fechaEmision: at(-8),
        fechaVencimiento: at(-1),
        estado: "pagada"
      },
      {
        id: "invoice-2026-012",
        clienteId: "client-juan",
        obraId: "work-cocina-juan",
        numero: "F-2026-012",
        concepto: "Materiales cocina y mano de obra",
        importeBase: 1818.18,
        iva: 381.82,
        total: 2200,
        pagado: 0,
        pendiente: 2200,
        fechaEmision: at(-1),
        fechaVencimiento: at(9),
        estado: "pendiente_pago"
      },
      {
        id: "invoice-2026-013",
        clienteId: "client-ana",
        obraId: null,
        numero: "F-2026-013",
        concepto: "Reserva visita y medicion",
        importeBase: 120,
        iva: 25.2,
        total: 145.2,
        pagado: 0,
        pendiente: 145.2,
        fechaEmision: at(0),
        fechaVencimiento: at(7),
        estado: "emitida"
      },
      {
        id: "invoice-2026-014",
        clienteId: "client-ruiz",
        obraId: null,
        numero: "F-2026-014",
        concepto: "Trabajos de apoyo Construcciones Ruiz",
        importeBase: 1157.02,
        iva: 242.98,
        total: 1400,
        pagado: 0,
        pendiente: 1400,
        fechaEmision: at(-5),
        fechaVencimiento: at(2, 12),
        estado: "pendiente_pago"
      }
    ]
  });

  await prisma.payment.createMany({
    data: [
      {
        id: "payment-juan-500",
        facturaId: "invoice-2026-011",
        clienteId: "client-juan",
        obraId: "work-cocina-juan",
        importe: 500,
        metodo: "transferencia",
        fecha: at(-2, 12),
        tipo: "pago_parcial",
        notas: "Pago a cuenta recibido."
      },
      {
        id: "payment-marta-900",
        facturaId: "invoice-2026-010",
        clienteId: "client-marta",
        obraId: "work-atico-marta",
        importe: 900,
        metodo: "bizum",
        fecha: at(-7, 18),
        tipo: "senal",
        notas: "Senal para bloquear fecha."
      }
    ]
  });

  await prisma.expense.createMany({
    data: [
      { obraId: "work-cocina-juan", clienteId: "client-juan", proveedor: "BricoCentro", concepto: "Cemento cola flexible", categoria: "material", importe: 86, fecha: at(0, 7), notas: "Para alicatado cocina." },
      { obraId: "work-cocina-juan", clienteId: "client-juan", proveedor: "Saneamientos Rivas", concepto: "Valvulas y latiguillos", categoria: "material", importe: 142.5, fecha: at(-1), notas: null },
      { obraId: "work-cocina-juan", clienteId: "client-juan", proveedor: "Equipo externo", concepto: "Mano de oficial", categoria: "mano_obra", importe: 480, fecha: at(-2), notas: "Dos jornadas." },
      { obraId: "work-cocina-juan", clienteId: "client-juan", proveedor: "Gasolinera A-3", concepto: "Gasolina furgoneta", categoria: "gasolina", importe: 64.8, fecha: at(-3), notas: null },
      { obraId: "work-bano-cafe", clienteId: "client-cafe", proveedor: "Mamparas Diaz", concepto: "Mampara frontal", categoria: "material", importe: 390, fecha: at(-8), notas: "Pendiente ajustar silicona." },
      { obraId: "work-bano-cafe", clienteId: "client-cafe", proveedor: "Contenedor Express", concepto: "Desescombro", categoria: "transporte", importe: 210, fecha: at(-15), notas: null },
      { obraId: "work-bano-cafe", clienteId: "client-cafe", proveedor: "Subcontrata fonta", concepto: "Roza y conexion", categoria: "subcontrata", importe: 620, fecha: at(-13), notas: null },
      { obraId: "work-atico-marta", clienteId: "client-marta", proveedor: "Pinturas Levante", concepto: "Reserva pintura lavable", categoria: "material", importe: 126.3, fecha: at(-1), notas: "Recoger antes del inicio." }
    ]
  });

  await prisma.material.createMany({
    data: [
      { obraId: "work-cocina-juan", nombre: "Cemento cola", cantidad: "4 sacos", estado: "comprado", notas: "Comprado hoy." },
      { obraId: "work-cocina-juan", nombre: "Lechada gris", cantidad: "2 botes", estado: "pendiente", notas: "Necesaria para remates." },
      { obraId: "work-cocina-juan", nombre: "Encimera", cantidad: "1 pieza", estado: "falta", notas: "Proveedor confirma manana." },
      { obraId: "work-bano-cafe", nombre: "Silicona antimoho", cantidad: "3 tubos", estado: "pendiente", notas: "Para mampara." },
      { obraId: "work-bano-cafe", nombre: "Plato ducha", cantidad: "1", estado: "entregado", notas: "Instalado." },
      { obraId: "work-atico-marta", nombre: "Pintura lavable blanco roto", cantidad: "20 litros", estado: "pendiente", notas: "Recoger antes de iniciar." }
    ]
  });

  await prisma.reminder.createMany({
    data: [
      {
        clienteId: "client-marta",
        obraId: "work-atico-marta",
        presupuestoId: "budget-2026-002",
        tipo: "seguimiento_presupuesto",
        canal: "whatsapp",
        mensaje: "Hola Marta, te escribo para saber si pudiste revisar el presupuesto del atico. Si quieres ajustamos fechas o partidas.",
        fechaProgramada: at(1, 10),
        estado: "pendiente_confirmacion",
        requiereConfirmacion: true,
        confirmadoPorUsuario: false
      },
      {
        clienteId: "client-cafe",
        obraId: "work-bano-cafe",
        facturaId: "invoice-2026-009",
        tipo: "factura_vencida",
        canal: "email",
        mensaje: "Hola, os dejo recordatorio de la factura F-2026-009, que aparece pendiente de pago. Decidme si necesitais que la reenviemos.",
        fechaProgramada: at(0, 16),
        estado: "pendiente_confirmacion",
        requiereConfirmacion: true,
        confirmadoPorUsuario: false
      },
      {
        clienteId: "client-lozano",
        tipo: "pedir_medidas",
        canal: "whatsapp",
        mensaje: "Cuando puedas, mandame medidas y fotos de los dos banos para cerrar el presupuesto.",
        fechaProgramada: at(0, 13),
        estado: "borrador",
        requiereConfirmacion: true,
        confirmadoPorUsuario: false
      },
      {
        clienteId: "client-juan",
        obraId: "work-cocina-juan",
        tipo: "material_pendiente",
        canal: "interno",
        mensaje: "Confirmar encimera y comprar lechada gris para rematar cocina de Juan.",
        fechaProgramada: at(1, 8),
        estado: "programado",
        requiereConfirmacion: false,
        confirmadoPorUsuario: true
      },
      {
        clienteId: "client-ana",
        presupuestoId: "budget-2026-003",
        tipo: "pedir_fotos",
        canal: "whatsapp",
        mensaje: "Hola Ana, para afinar el presupuesto del bano, mandame una foto del plato actual y medidas de la mampara.",
        fechaProgramada: at(2, 9),
        estado: "pendiente_confirmacion",
        requiereConfirmacion: true,
        confirmadoPorUsuario: false
      }
    ]
  });

  await prisma.eventoAgenda.createMany({
    data: [
      {
        id: "agenda-visita-marta",
        titulo: "Visita con Marta",
        descripcion: "Revisar medidas, calidades y fechas antes de aceptar presupuesto.",
        tipo: "visita",
        estado: "confirmado",
        fechaInicio: at(1, 10),
        fechaFin: at(1, 11),
        horaInicio: "10:00",
        horaFin: "11:00",
        clienteId: "client-marta",
        obraId: "work-atico-marta",
        presupuestoId: "budget-2026-002",
        direccion: "Avenida del Puerto 42, Valencia",
        notas: "No se notifica fuera de la app.",
        requiereConfirmacion: false,
        confirmadoPorUsuario: true
      },
      {
        id: "agenda-seguimiento-marta",
        titulo: "Seguimiento presupuesto Marta",
        descripcion: "Preguntar si ha podido revisar P-2026-002.",
        tipo: "seguimiento_presupuesto",
        estado: "pendiente",
        fechaInicio: at(1, 10),
        horaInicio: "10:00",
        clienteId: "client-marta",
        obraId: "work-atico-marta",
        presupuestoId: "budget-2026-002",
        direccion: "Avenida del Puerto 42, Valencia",
        requiereConfirmacion: true,
        confirmadoPorUsuario: false
      },
      {
        id: "agenda-llamada-pedro",
        titulo: "Llamar a Pedro",
        descripcion: "Pedir fotos de humedades y confirmar disponibilidad.",
        tipo: "llamada",
        estado: "pendiente",
        fechaInicio: at(5, 10),
        horaInicio: "10:00",
        clienteId: "client-pedro",
        direccion: "Calle Rio 11, Madrid",
        requiereConfirmacion: false,
        confirmadoPorUsuario: true
      },
      {
        id: "agenda-visita-pedro",
        titulo: "Visita con Pedro",
        descripcion: "Comprobar humedades y tomar medidas.",
        tipo: "visita",
        estado: "pendiente",
        fechaInicio: at(3, 12),
        fechaFin: at(3, 13),
        horaInicio: "12:00",
        horaFin: "13:00",
        clienteId: "client-pedro",
        direccion: "Calle Rio 11, Madrid",
        requiereConfirmacion: true,
        confirmadoPorUsuario: false
      },
      {
        id: "agenda-compra-material-juan",
        titulo: "Comprar lechada gris para cocina Juan",
        descripcion: "Material pendiente para rematar cocina.",
        tipo: "compra_material",
        estado: "pendiente",
        fechaInicio: at(0, 8),
        horaInicio: "08:00",
        clienteId: "client-juan",
        obraId: "work-cocina-juan",
        direccion: "Calle Mayor 18, Getafe",
        requiereConfirmacion: false,
        confirmadoPorUsuario: true
      },
      {
        id: "agenda-vencimiento-ruiz",
        titulo: "Vence factura Construcciones Ruiz",
        descripcion: "Revisar cobro de F-2026-014.",
        tipo: "vencimiento_factura",
        estado: "pendiente",
        fechaInicio: at(2, 12),
        horaInicio: "12:00",
        clienteId: "client-ruiz",
        facturaId: "invoice-2026-014",
        direccion: "Avenida Industria 22, Fuenlabrada",
        requiereConfirmacion: false,
        confirmadoPorUsuario: true
      },
      {
        id: "agenda-inicio-juan",
        titulo: "Inicio obra Juan",
        descripcion: "Inicio planificado de la cocina de Juan.",
        tipo: "inicio_obra",
        estado: "confirmado",
        fechaInicio: at(-9, 8),
        horaInicio: "08:00",
        clienteId: "client-juan",
        obraId: "work-cocina-juan",
        direccion: "Calle Mayor 18, Getafe",
        requiereConfirmacion: false,
        confirmadoPorUsuario: true
      },
      {
        id: "agenda-fin-marta",
        titulo: "Fin previsto reforma baño Marta",
        descripcion: "Revisar si quedan remates o cobros antes de cerrar.",
        tipo: "fin_previsto_obra",
        estado: "pendiente",
        fechaInicio: at(9, 18),
        horaInicio: "18:00",
        clienteId: "client-marta",
        obraId: "work-atico-marta",
        direccion: "Avenida del Puerto 42, Valencia",
        requiereConfirmacion: false,
        confirmadoPorUsuario: true
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
