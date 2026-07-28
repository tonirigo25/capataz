import { XMLParser } from "fast-xml-parser";
import { canonicalInvoiceHash, canonicalJson, sha256Hex, type CanonicalInvoice } from "./canonical";
import type { FiscalSignature, FiscalSignatureAdapter } from "./signatures";

export type ElectronicInvoiceFormat = "UBL" | "CII" | "FACTURAE" | "EDIFACT";

export const ELECTRONIC_INVOICE_CONTRACT = {
  semanticVersion: "orqena-fiscal-1.0.0",
  validatorVersion: "orqena-einvoice-validator-1.0.0",
  schemas: {
    UBL: "UBL-2.1-EN16931:2017",
    CII: "UNCEFACT-CII-D16B-EN16931:2017",
    FACTURAE: "Facturae-3.2.2",
    EDIFACT: "UN-EDIFACT-INVOIC-D16B",
  },
} as const;

export type GeneratedElectronicInvoice = {
  format: ElectronicInvoiceFormat;
  schemaVersion: string;
  semanticVersion: string;
  validatorVersion: string;
  mimeType: string;
  bytes: Uint8Array;
  contentHash: string;
  semanticHash: string;
  validation: { valid: true; checks: string[] };
  signature?: FiscalSignature;
};

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function ubl(invoice: CanonicalInvoice) {
  const lines = invoice.lines.map((line) => `<cac:InvoiceLine><cbc:ID>${xml(line.id)}</cbc:ID><cbc:InvoicedQuantity unitCode="C62">${line.quantity}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="EUR">${line.taxableBase}</cbc:LineExtensionAmount><cac:Item><cbc:Description>${xml(line.description)}</cbc:Description><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>${line.taxRate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="EUR">${line.unitPrice}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID><cbc:ProfileID>urn:orqena:es:b2b:rd238:2026:draft-1</cbc:ProfileID><cbc:ID>${xml(invoice.documentId)}</cbc:ID><cbc:IssueDate>${invoice.issueDate}</cbc:IssueDate><cbc:InvoiceTypeCode>${invoice.documentType.startsWith("R") ? "381" : "380"}</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode><cac:AccountingSupplierParty><cac:Party><cac:PartyTaxScheme><cbc:CompanyID>${xml(invoice.seller.taxId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${xml(invoice.seller.legalName)}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty><cac:AccountingCustomerParty><cac:Party><cac:PartyTaxScheme><cbc:CompanyID>${xml(invoice.buyer.taxId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${xml(invoice.buyer.legalName)}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty><cac:TaxTotal><cbc:TaxAmount currencyID="EUR">${invoice.totals.taxAmount}</cbc:TaxAmount></cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="EUR">${invoice.totals.taxableBase}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="EUR">${invoice.totals.taxableBase}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">${invoice.totals.payableAmount}</cbc:TaxInclusiveAmount><cbc:AllowanceTotalAmount currencyID="EUR">${invoice.totals.discountAmount}</cbc:AllowanceTotalAmount><cbc:PayableAmount currencyID="EUR">${invoice.totals.payableAmount}</cbc:PayableAmount></cac:LegalMonetaryTotal>${lines}</Invoice>`;
}

function cii(invoice: CanonicalInvoice) {
  const lines = invoice.lines.map((line) => `<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument><ram:LineID>${xml(line.id)}</ram:LineID></ram:AssociatedDocumentLineDocument><ram:SpecifiedTradeProduct><ram:Name>${xml(line.description)}</ram:Name></ram:SpecifiedTradeProduct><ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${line.unitPrice}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement><ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">${line.quantity}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery><ram:SpecifiedLineTradeSettlement><ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>${line.taxRate}</ram:RateApplicablePercent></ram:ApplicableTradeTax><ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${line.taxableBase}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"><rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext><rsm:ExchangedDocument><ram:ID>${xml(invoice.documentId)}</ram:ID><ram:TypeCode>${invoice.documentType.startsWith("R") ? "381" : "380"}</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">${invoice.issueDate.replaceAll("-", "")}</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument><rsm:SupplyChainTradeTransaction>${lines}<ram:ApplicableHeaderTradeAgreement><ram:SellerTradeParty><ram:Name>${xml(invoice.seller.legalName)}</ram:Name><ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${xml(invoice.seller.taxId)}</ram:ID></ram:SpecifiedTaxRegistration></ram:SellerTradeParty><ram:BuyerTradeParty><ram:Name>${xml(invoice.buyer.legalName)}</ram:Name><ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${xml(invoice.buyer.taxId)}</ram:ID></ram:SpecifiedTaxRegistration></ram:BuyerTradeParty></ram:ApplicableHeaderTradeAgreement><ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode><ram:ApplicableTradeTax><ram:CalculatedAmount>${invoice.totals.taxAmount}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode></ram:ApplicableTradeTax><ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>${invoice.totals.taxableBase}</ram:LineTotalAmount><ram:TaxBasisTotalAmount>${invoice.totals.taxableBase}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">${invoice.totals.taxAmount}</ram:TaxTotalAmount><ram:GrandTotalAmount>${invoice.totals.payableAmount}</ram:GrandTotalAmount><ram:DuePayableAmount>${invoice.totals.payableAmount}</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation></ram:ApplicableHeaderTradeSettlement></rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>`;
}

function facturae(invoice: CanonicalInvoice, signature?: FiscalSignature) {
  const items = invoice.lines.map((line) => `<InvoiceLine><ItemDescription>${xml(line.description)}</ItemDescription><Quantity>${line.quantity}</Quantity><UnitPriceWithoutTax>${line.unitPrice}</UnitPriceWithoutTax><TotalCost>${line.taxableBase}</TotalCost><GrossAmount>${line.taxableBase}</GrossAmount><TaxesOutputs><Tax><TaxTypeCode>01</TaxTypeCode><TaxRate>${line.taxRate}</TaxRate><TaxableBase><TotalAmount>${line.taxableBase}</TotalAmount></TaxableBase><TaxAmount><TotalAmount>${line.taxAmount}</TotalAmount></TaxAmount></Tax></TaxesOutputs></InvoiceLine>`).join("");
  const signatureBlock = signature ? `<Extensions><Extension><ExtensionContent><OrqenaDetachedSignature algorithm="${signature.algorithm}" keyVersion="${xml(signature.keyVersion)}" certificateFingerprint="${signature.certificateFingerprint}">${signature.signatureBase64}</OrqenaDetachedSignature></ExtensionContent></Extension></Extensions>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><fe:Facturae xmlns:fe="http://www.facturae.es/Facturae/2009/v3.2/Facturae"><FileHeader><SchemaVersion>3.2.2</SchemaVersion><Modality>I</Modality><InvoiceIssuerType>EM</InvoiceIssuerType><Batch><BatchIdentifier>${xml(invoice.documentId)}</BatchIdentifier><InvoicesCount>1</InvoicesCount><TotalInvoicesAmount><TotalAmount>${invoice.totals.payableAmount}</TotalAmount></TotalInvoicesAmount><TotalOutstandingAmount><TotalAmount>${invoice.totals.payableAmount}</TotalAmount></TotalOutstandingAmount><TotalExecutableAmount><TotalAmount>${invoice.totals.payableAmount}</TotalAmount></TotalExecutableAmount><InvoiceCurrencyCode>EUR</InvoiceCurrencyCode></Batch></FileHeader><Parties><SellerParty><TaxIdentification><PersonTypeCode>J</PersonTypeCode><ResidenceTypeCode>R</ResidenceTypeCode><TaxIdentificationNumber>${xml(invoice.seller.taxId)}</TaxIdentificationNumber></TaxIdentification><LegalEntity><CorporateName>${xml(invoice.seller.legalName)}</CorporateName></LegalEntity></SellerParty><BuyerParty><TaxIdentification><PersonTypeCode>J</PersonTypeCode><ResidenceTypeCode>R</ResidenceTypeCode><TaxIdentificationNumber>${xml(invoice.buyer.taxId)}</TaxIdentificationNumber></TaxIdentification><LegalEntity><CorporateName>${xml(invoice.buyer.legalName)}</CorporateName></LegalEntity></BuyerParty></Parties><Invoices><Invoice><InvoiceHeader><InvoiceNumber>${xml(invoice.documentId)}</InvoiceNumber><InvoiceSeriesCode>ORQ</InvoiceSeriesCode><InvoiceDocumentType>${invoice.documentType.startsWith("R") ? "FC" : "FC"}</InvoiceDocumentType><InvoiceClass>${invoice.documentType.startsWith("R") ? "OR" : "OO"}</InvoiceClass></InvoiceHeader><InvoiceIssueData><IssueDate>${invoice.issueDate}</IssueDate><InvoiceCurrencyCode>EUR</InvoiceCurrencyCode><TaxCurrencyCode>EUR</TaxCurrencyCode><LanguageName>es</LanguageName></InvoiceIssueData><Items>${items}</Items><InvoiceTotals><TotalGrossAmount>${invoice.totals.grossAmount}</TotalGrossAmount><TotalGeneralDiscounts>${invoice.totals.discountAmount}</TotalGeneralDiscounts><TotalGrossAmountBeforeTaxes>${invoice.totals.taxableBase}</TotalGrossAmountBeforeTaxes><TotalTaxOutputs>${invoice.totals.taxAmount}</TotalTaxOutputs><InvoiceTotal>${invoice.totals.payableAmount}</InvoiceTotal><TotalOutstandingAmount>${invoice.totals.payableAmount}</TotalOutstandingAmount><TotalExecutableAmount>${invoice.totals.payableAmount}</TotalExecutableAmount></InvoiceTotals></Invoice></Invoices>${signatureBlock}</fe:Facturae>`;
}

function edi(value: string) {
  return value.replaceAll("?", "??").replaceAll("+", "?+").replaceAll(":", "?:").replaceAll("'", "?'");
}

function edifact(invoice: CanonicalInvoice) {
  const date = invoice.issueDate.replaceAll("-", "");
  const lines = invoice.lines.flatMap((line, index) => [
    `LIN+${index + 1}++${edi(line.id)}:SA'`,
    `IMD+F++:::${edi(line.description)}'`,
    `QTY+47:${line.quantity}:C62'`,
    `PRI+AAA:${line.unitPrice}'`,
    `MOA+203:${line.taxableBase}:EUR'`,
    `TAX+7+VAT+++:::${line.taxRate}'`,
  ]);
  const segments = [
    "UNA:+.? '",
    `UNH+${edi(invoice.documentId)}+INVOIC:D:16B:UN:EAN010'`,
    `BGM+380+${edi(invoice.documentId)}+9'`,
    `DTM+137:${date}:102'`,
    `NAD+SU+${edi(invoice.seller.taxId)}::9++${edi(invoice.seller.legalName)}'`,
    `NAD+BY+${edi(invoice.buyer.taxId)}::9++${edi(invoice.buyer.legalName)}'`,
    ...lines,
    "UNS+S'",
    `MOA+77:${invoice.totals.payableAmount}:EUR'`,
    `MOA+125:${invoice.totals.taxableBase}:EUR'`,
    `MOA+124:${invoice.totals.taxAmount}:EUR'`,
    `CNT+2:${invoice.lines.length}'`,
  ];
  segments.push(`UNT+${segments.length + 1}+${edi(invoice.documentId)}'`);
  return segments.join("\n");
}

function serialize(invoice: CanonicalInvoice, format: ElectronicInvoiceFormat, signature?: FiscalSignature) {
  if (format === "UBL") return ubl(invoice);
  if (format === "CII") return cii(invoice);
  if (format === "FACTURAE") return facturae(invoice, signature);
  return edifact(invoice);
}

export function validateElectronicInvoiceArtifact(format: ElectronicInvoiceFormat, content: string, invoice: CanonicalInvoice) {
  const checks: string[] = [];
  if (format === "EDIFACT") {
    for (const token of ["UNH+", "INVOIC:D:16B", `BGM+380+${edi(invoice.documentId)}`, `MOA+77:${invoice.totals.payableAmount}:EUR`, "UNT+"]) {
      if (!content.includes(token)) throw new Error(`EDIFACT_VALIDATION_FAILED:${token}`);
      checks.push(token);
    }
  } else {
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, trimValues: false });
    const parsed = parser.parse(content) as Record<string, unknown>;
    const root = format === "UBL" ? "Invoice" : format === "CII" ? "CrossIndustryInvoice" : "Facturae";
    if (!parsed[root]) throw new Error(`EINVOICE_ROOT_INVALID:${format}`);
    checks.push(`root:${root}`);
    for (const value of [invoice.documentId, invoice.seller.taxId, invoice.buyer.taxId, invoice.totals.payableAmount]) {
      if (!content.includes(xml(value))) throw new Error(`EINVOICE_SEMANTIC_VALUE_MISSING:${format}`);
      checks.push(`semantic:${value}`);
    }
  }
  return { valid: true as const, checks };
}

export async function generateElectronicInvoice(
  invoice: CanonicalInvoice,
  format: ElectronicInvoiceFormat,
  options: { signer?: FiscalSignatureAdapter; credentialReference?: string; keyVersion?: string; signedAt?: string } = {},
): Promise<GeneratedElectronicInvoice> {
  let signature: FiscalSignature | undefined;
  if (options.signer) {
    const unsigned = Buffer.from(serialize(invoice, format), "utf8");
    signature = await options.signer.sign({
      bytes: unsigned,
      credentialReference: options.credentialReference ?? "missing",
      keyVersion: options.keyVersion ?? "missing",
      signedAt: options.signedAt ?? new Date().toISOString(),
    });
  }
  const content = serialize(invoice, format, signature);
  const bytes = Buffer.from(content, "utf8");
  return {
    format,
    schemaVersion: ELECTRONIC_INVOICE_CONTRACT.schemas[format],
    semanticVersion: ELECTRONIC_INVOICE_CONTRACT.semanticVersion,
    validatorVersion: ELECTRONIC_INVOICE_CONTRACT.validatorVersion,
    mimeType: format === "EDIFACT" ? "application/edifact" : "application/xml",
    bytes,
    contentHash: sha256Hex(bytes),
    semanticHash: canonicalInvoiceHash(invoice),
    validation: validateElectronicInvoiceArtifact(format, content, invoice),
    ...(signature ? { signature } : {}),
  };
}

export function artifactManifest(artifacts: GeneratedElectronicInvoice[]) {
  return {
    contract: ELECTRONIC_INVOICE_CONTRACT,
    artifacts: artifacts.map(({ format, schemaVersion, semanticVersion, validatorVersion, mimeType, contentHash, semanticHash, signature }) => ({
      format, schemaVersion, semanticVersion, validatorVersion, mimeType, contentHash, semanticHash,
      signature: signature ? { algorithm: signature.algorithm, keyVersion: signature.keyVersion, certificateFingerprint: signature.certificateFingerprint } : null,
    })),
    manifestHash: sha256Hex(canonicalJson(artifacts.map((artifact) => ({ format: artifact.format, contentHash: artifact.contentHash, semanticHash: artifact.semanticHash })))),
  };
}
