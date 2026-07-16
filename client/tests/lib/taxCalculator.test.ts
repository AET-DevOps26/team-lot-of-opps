import { describe, expect, it } from 'vitest'
import {
  einkommensteuer,
  jahresverlust,
  refundPrognose,
  TAX_2024,
  verlustvortrag,
  werbungskosten,
  type StudyYearInput,
} from '../../src/lib/taxCalculator'

const year = (partial: Partial<StudyYearInput> = {}): StudyYearInput => ({
  belegausgaben: 0,
  pendlertage: 0,
  entfernungKm: 0,
  homeofficeTage: 0,
  bewerbungenSchriftlich: 0,
  bewerbungenOnline: 0,
  umzug: false,
  einnahmenWerkstudent: 0,
  ...partial,
})

describe('einkommensteuer (§ 32a EStG 2024)', () => {
  it.each([
    [11604, 0],
    [11605, 0],
    [17005, 1025],
    [17006, 1025],
    [30000, 4446],
    [66760, 17437],
    [66761, 17437],
    [100000, 31397],
    [277825, 106084],
    [277826, 106084],
    [300000, 116063],
  ])('zvE %d → %d €', (zvE, expected) => {
    expect(einkommensteuer(zvE)).toBe(expected)
  })

  it('rundet das zvE vor der Berechnung auf volle Euro ab', () => {
    expect(einkommensteuer(17005.99)).toBe(einkommensteuer(17005))
  })

  it('liefert immer ganze Euro', () => {
    for (const zvE of [12000, 25000.5, 70000, 280000]) {
      expect(Number.isInteger(einkommensteuer(zvE))).toBe(true)
    }
  })
})

describe('werbungskosten', () => {
  it('enthält immer die Kontoführungspauschale', () => {
    expect(werbungskosten(year())).toBe(16)
  })

  it('rechnet Fahrtkosten bis 20 km mit 0,30 €', () => {
    expect(werbungskosten(year({ pendlertage: 200, entfernungKm: 20 }))).toBe(1200 + 16)
  })

  it('rechnet ab dem 21. km mit 0,38 €', () => {
    expect(werbungskosten(year({ pendlertage: 200, entfernungKm: 21 }))).toBe(1276 + 16)
  })

  it('deckelt die Home-Office-Pauschale bei 210 Tagen', () => {
    expect(werbungskosten(year({ homeofficeTage: 100 }))).toBe(600 + 16)
    expect(werbungskosten(year({ homeofficeTage: 210 }))).toBe(1260 + 16)
    expect(werbungskosten(year({ homeofficeTage: 300 }))).toBe(1260 + 16)
  })

  it('summiert Bewerbungskosten nach Art', () => {
    expect(
      werbungskosten(year({ bewerbungenSchriftlich: 3, bewerbungenOnline: 10 })),
    ).toBe(50.5 + 16)
  })

  it('addiert die Umzugspauschale nur bei studienbedingtem Umzug', () => {
    expect(werbungskosten(year({ umzug: true }))).toBe(964 + 16)
  })
})

describe('jahresverlust / verlustvortrag', () => {
  it('zieht Werkstudenten-Einkommen erst oberhalb des Pauschbetrags ab', () => {
    expect(jahresverlust(year({ belegausgaben: 1000, einnahmenWerkstudent: 1000 }))).toBe(1016)
    expect(jahresverlust(year({ belegausgaben: 5000, einnahmenWerkstudent: 5000 }))).toBe(
      5016 - 3770,
    )
  })

  it('klemmt den Jahresverlust bei 0, wenn Einnahmen überwiegen', () => {
    expect(jahresverlust(year({ einnahmenWerkstudent: 30000 }))).toBe(0)
  })

  it('summiert die Verluste mehrerer Jahre', () => {
    expect(
      verlustvortrag([year({ belegausgaben: 1000 }), year({ belegausgaben: 2000 })]),
    ).toBe(3032)
  })
})

describe('refundPrognose', () => {
  it('nähert das zvE aus dem Bruttogehalt an', () => {
    expect(refundPrognose(48000, 0).zvEBasis).toBe(37170)
    expect(refundPrognose(48000, 0).erstattung).toBe(0)
  })

  it('erstattet die Differenz der beiden Steuerbeträge', () => {
    const p = refundPrognose(48000, 10000)
    expect(p.zvENeu).toBe(27170)
    expect(p.erstattung).toBe(einkommensteuer(37170) - einkommensteuer(27170))
    expect(p.erstattung).toBeGreaterThan(0)
  })

  it('klemmt das geminderte zvE bei 0, wenn der Verlust das Einkommen übersteigt', () => {
    const p = refundPrognose(20000, 999999)
    expect(p.zvENeu).toBe(0)
    expect(p.erstattung).toBe(p.estRegulaer)
  })

  it('liefert bei Brutto 0 keine negativen Werte', () => {
    const p = refundPrognose(0, 5000)
    expect(p).toEqual({ zvEBasis: 0, estRegulaer: 0, zvENeu: 0, estNeu: 0, erstattung: 0 })
  })

  it('senkt zvEBasis bei höherem Vorsorge-Anteil', () => {
    const niedrig = refundPrognose(48000, 0, 0.2)
    const hoch = refundPrognose(48000, 0, 0.3)
    expect(hoch.zvEBasis).toBeLessThan(niedrig.zvEBasis)
    expect(hoch.estRegulaer).toBeLessThan(niedrig.estRegulaer)
  })

  it('senkt zvEBasis bei höherem Arbeitnehmer-Pauschbetrag', () => {
    const hoehererPauschbetrag = { ...TAX_2024, arbeitnehmerPauschbetrag: 2000 }
    const p = refundPrognose(48000, 0, 0.2, hoehererPauschbetrag)
    expect(p.zvEBasis).toBe(refundPrognose(48000, 0, 0.2).zvEBasis - (2000 - 1230))
  })
})
