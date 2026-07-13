export interface TaxYearConstants {
  grundfreibetrag: number
  zone2Ende: number
  zone3Ende: number
  zone4Ende: number
  zone2: { a: number; b: number }
  zone3: { a: number; b: number; c: number }
  zone4: { satz: number; abzug: number }
  zone5: { satz: number; abzug: number }
  entfernungspauschale: number
  entfernungspauschaleAb21: number
  entfernungSchwelleKm: number
  homeofficeProTag: number
  homeofficeMaxTage: number
  arbeitnehmerPauschbetrag: number
  kontofuehrungspauschale: number
  bewerbungSchriftlich: number
  bewerbungOnline: number
  umzugspauschale: number
}

export const TAX_2024: TaxYearConstants = {
  grundfreibetrag: 11604,
  zone2Ende: 17005,
  zone3Ende: 66760,
  zone4Ende: 277825,
  zone2: { a: 922.98, b: 1400 },
  zone3: { a: 181.19, b: 2397, c: 1025.38 },
  zone4: { satz: 0.42, abzug: 10602.13 },
  zone5: { satz: 0.45, abzug: 18936.88 },
  entfernungspauschale: 0.3,
  entfernungspauschaleAb21: 0.38,
  entfernungSchwelleKm: 20,
  homeofficeProTag: 6,
  homeofficeMaxTage: 210,
  arbeitnehmerPauschbetrag: 1230,
  kontofuehrungspauschale: 16,
  bewerbungSchriftlich: 8.5,
  bewerbungOnline: 2.5,
  umzugspauschale: 964,
}

export interface StudyYearInput {
  belegausgaben: number
  pendlertage: number
  entfernungKm: number
  homeofficeTage: number
  bewerbungenSchriftlich: number
  bewerbungenOnline: number
  umzug: boolean
  einnahmenWerkstudent: number
}

const toCents = (x: number) => Math.round(x * 100) / 100

export function werbungskosten(input: StudyYearInput, c: TaxYearConstants = TAX_2024): number {
  const km = input.entfernungKm
  const proTag =
    km <= c.entfernungSchwelleKm
      ? km * c.entfernungspauschale
      : c.entfernungSchwelleKm * c.entfernungspauschale +
        (km - c.entfernungSchwelleKm) * c.entfernungspauschaleAb21
  const fahrtkosten = input.pendlertage * proTag
  const homeoffice = Math.min(input.homeofficeTage, c.homeofficeMaxTage) * c.homeofficeProTag
  const bewerbungen =
    input.bewerbungenSchriftlich * c.bewerbungSchriftlich +
    input.bewerbungenOnline * c.bewerbungOnline
  return toCents(
    input.belegausgaben +
      fahrtkosten +
      homeoffice +
      bewerbungen +
      c.kontofuehrungspauschale +
      (input.umzug ? c.umzugspauschale : 0),
  )
}

export function jahresverlust(input: StudyYearInput, c: TaxYearConstants = TAX_2024): number {
  const einkommen = Math.max(0, input.einnahmenWerkstudent - c.arbeitnehmerPauschbetrag)
  return toCents(Math.max(0, werbungskosten(input, c) - einkommen))
}

export function verlustvortrag(inputs: StudyYearInput[], c: TaxYearConstants = TAX_2024): number {
  return toCents(inputs.reduce((sum, input) => sum + jahresverlust(input, c), 0))
}

export function einkommensteuer(zvE: number, c: TaxYearConstants = TAX_2024): number {
  const x = Math.floor(zvE)
  if (x <= c.grundfreibetrag) return 0
  if (x <= c.zone2Ende) {
    const y = (x - c.grundfreibetrag) / 10000
    return Math.floor((c.zone2.a * y + c.zone2.b) * y)
  }
  if (x <= c.zone3Ende) {
    const z = (x - c.zone2Ende) / 10000
    return Math.floor((c.zone3.a * z + c.zone3.b) * z + c.zone3.c)
  }
  if (x <= c.zone4Ende) return Math.floor(c.zone4.satz * x - c.zone4.abzug)
  return Math.floor(c.zone5.satz * x - c.zone5.abzug)
}

export interface RefundPrognose {
  zvEBasis: number
  estRegulaer: number
  zvENeu: number
  estNeu: number
  erstattung: number
}

export function refundPrognose(
  bruttoGehalt: number,
  vGesamt: number,
  vorsorgeRate = 0.2,
  c: TaxYearConstants = TAX_2024,
): RefundPrognose {
  const zvEBasis = Math.max(
    0,
    Math.floor(bruttoGehalt - c.arbeitnehmerPauschbetrag - bruttoGehalt * vorsorgeRate),
  )
  const estRegulaer = einkommensteuer(zvEBasis, c)
  const zvENeu = Math.floor(Math.max(0, zvEBasis - vGesamt))
  const estNeu = einkommensteuer(zvENeu, c)
  return { zvEBasis, estRegulaer, zvENeu, estNeu, erstattung: estRegulaer - estNeu }
}
