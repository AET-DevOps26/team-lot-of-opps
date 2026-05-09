export const SUPPORTED_LANGUAGES = ['en', 'de'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export interface TranslationDict {
  brand: string
  sidebar: { title: string; subtitle: string }
  nav: {
    dashboard: string
    documents: string
    upload: string
    settings: string
    signInRequired: string
  }
  onboarding: {
    eyebrow: string
    title: string
    subtitle: string
    signInHint: string
    features: {
      upload: { title: string; body: string }
      ai: { title: string; body: string }
      savings: { title: string; body: string }
    }
  }
  topbar: { logIn: string }
  auth: { signIn: string; signOut: string; accountMenu: string }
  settings: {
    title: string
    language: string
    languages: Record<Language, string>
    close: string
  }
  dashboard: {
    title: string
    subtitle: string
    cards: {
      totalExpenses: string
      sinceLastUpload: string
      carryforward: string
      aiVerified: string
      futureRefund: string
      taxRateNote: string
    }
    categories: { title: string; filter: string }
    savings: {
      title: string
      intro: string
      recordedExpenses: string
      futureTaxRate: string
      futureRefund: string
    }
    ai: {
      title: string
      suggestion1: string
      uploadFlight: string
      suggestion2: string
      addPauschale: string
    }
  }
  upload: {
    title: string
    subtitle: string
    dropzone: { title: string; subtitle: string; maxSize: string }
    queue: { title: string; viewAll: string }
    status: { extracting: string; verified: string; actionNeeded: string }
    meta: { uploadedToday: string; uploadedYesterday: string; missingVendor: string }
    fields: { vendor: string; amount: string }
    review: string
  }
  documents: {
    title: string
    subtitle: string
    totalFiltered: string
    search: string
    allYears: string
    allCategories: string
    moreFilters: string
    table: {
      date: string
      vendor: string
      category: string
      amount: string
      action: string
      viewReceipt: string
    }
    pagination: string
  }
}

const translations: Record<Language, TranslationDict> = {
  en: {
    brand: 'TaxForward',
    sidebar: {
      title: 'Verlustvortrag',
      subtitle: 'Tax Optimizer',
    },
    nav: {
      dashboard: 'Dashboard',
      documents: 'Documents',
      upload: 'Upload',
      settings: 'Settings',
      signInRequired: 'Sign in to access this section',
    },
    onboarding: {
      eyebrow: 'Welcome to TaxForward',
      title: 'Turn your study costs into a future tax refund',
      subtitle:
        'TaxForward records the expenses you have today as students or trainees, so you can offset them against your future income — automatically, with AI-assisted document processing.',
      signInHint: 'We use Google sign-in. We only read your name, email, and profile picture.',
      features: {
        upload: {
          title: 'Drop in your receipts',
          body: 'Upload PDFs or photos of any tuition fee, semester ticket, laptop, books — anything study-related.',
        },
        ai: {
          title: 'AI does the paperwork',
          body: 'Vendor, amount, category, and tax classification are extracted automatically and reviewed before you confirm.',
        },
        savings: {
          title: 'See what it is worth',
          body: 'Get a live estimate of your "Verlustvortrag" — the refund waiting for you when you start earning.',
        },
      },
    },
    topbar: { logIn: 'Log In' },
    auth: { signIn: 'Sign in with Google', signOut: 'Sign out', accountMenu: 'Account menu' },
    settings: {
      title: 'Settings',
      language: 'Language',
      languages: { en: 'English', de: 'German' },
      close: 'Close',
    },
    dashboard: {
      title: 'Tax Overview 2023',
      subtitle: 'Here is the current state of your academic tax loss carryforward.',
      cards: {
        totalExpenses: 'Total Expenses',
        sinceLastUpload: '+€350 since last upload',
        carryforward: 'Est. Loss Carryforward',
        aiVerified: 'AI Verified',
        futureRefund: 'Estimated Future Refund',
        taxRateNote: 'Assuming 30% tax rate later',
      },
      categories: { title: 'Expenses by Category', filter: 'Filter' },
      savings: {
        title: 'How Your Savings Work',
        intro:
          'A "Verlustvortrag" records your study costs now, to offset against your future income when you start working.',
        recordedExpenses: 'Your recorded expenses',
        futureTaxRate: 'Future tax rate (Est. 30%)',
        futureRefund: 'Future Cash Refund',
      },
      ai: {
        title: 'AI Suggestions',
        suggestion1:
          '"I see you uploaded a hotel receipt for Barcelona (Nov 12). Do you have the corresponding flight bill to claim full Reisekosten?"',
        uploadFlight: 'Upload Flight Bill',
        suggestion2: "You haven't claimed the Internet Pauschale (Internet Flatrate) for this year.",
        addPauschale: 'Add Pauschale',
      },
    },
    upload: {
      title: 'Intelligent Upload',
      subtitle:
        'Securely deposit your financial documents. Our AI will automatically extract key data, classify expenses, and identify potential tax-loss carryforwards.',
      dropzone: {
        title: 'Drag & drop your invoices here',
        subtitle: 'or click to browse from your device',
        maxSize: 'Max 25MB',
      },
      queue: { title: 'Processing Queue', viewAll: 'View All Documents' },
      status: {
        extracting: 'AI Extracting',
        verified: 'Verified',
        actionNeeded: 'Action Needed',
      },
      meta: {
        uploadedToday: 'Uploaded Today, 10:42 AM',
        uploadedYesterday: 'Uploaded Yesterday',
        missingVendor: 'Missing vendor information',
      },
      fields: { vendor: 'Vendor', amount: 'Amount' },
      review: 'Review Document',
    },
    documents: {
      title: 'Documents',
      subtitle: 'Manage and review your uploaded tax documents.',
      totalFiltered: 'Total Filtered Amount',
      search: 'Search vendors or notes...',
      allYears: 'All Years',
      allCategories: 'All Categories',
      moreFilters: 'More Filters',
      table: {
        date: 'Date',
        vendor: 'Vendor',
        category: 'Category',
        amount: 'Amount',
        action: 'Action',
        viewReceipt: 'View Receipt',
      },
      pagination: 'Showing 1-5 of 24 documents',
    },
  },
  de: {
    brand: 'TaxForward',
    sidebar: {
      title: 'Verlustvortrag',
      subtitle: 'Steueroptimierer',
    },
    nav: {
      dashboard: 'Übersicht',
      documents: 'Dokumente',
      upload: 'Hochladen',
      settings: 'Einstellungen',
      signInRequired: 'Anmelden, um diesen Bereich zu nutzen',
    },
    onboarding: {
      eyebrow: 'Willkommen bei TaxForward',
      title: 'Aus heutigen Studienkosten wird morgen Steuerrückerstattung',
      subtitle:
        'TaxForward erfasst deine aktuellen Ausgaben als Studierende:r oder Auszubildende:r, damit du sie später mit deinem Einkommen verrechnen kannst — automatisch, mit KI-gestützter Belegerkennung.',
      signInHint:
        'Wir nutzen Google-Anmeldung und lesen nur Name, E-Mail und Profilbild.',
      features: {
        upload: {
          title: 'Belege einfach hochladen',
          body: 'Lade PDFs oder Fotos von Studiengebühren, Semestertickets, Laptops, Büchern hoch — alles, was zum Studium gehört.',
        },
        ai: {
          title: 'KI übernimmt die Bürokratie',
          body: 'Lieferant, Betrag, Kategorie und steuerliche Einordnung werden automatisch extrahiert und vor der Bestätigung geprüft.',
        },
        savings: {
          title: 'Sieh, was es wert ist',
          body: 'Erhalte eine Live-Schätzung deines Verlustvortrags — die Rückerstattung, die auf dich wartet, sobald du verdienst.',
        },
      },
    },
    topbar: { logIn: 'Anmelden' },
    auth: { signIn: 'Mit Google anmelden', signOut: 'Abmelden', accountMenu: 'Kontomenü' },
    settings: {
      title: 'Einstellungen',
      language: 'Sprache',
      languages: { en: 'Englisch', de: 'Deutsch' },
      close: 'Schließen',
    },
    dashboard: {
      title: 'Steuerübersicht 2023',
      subtitle: 'Hier ist der aktuelle Stand deines akademischen Verlustvortrags.',
      cards: {
        totalExpenses: 'Gesamtausgaben',
        sinceLastUpload: '+350 € seit letztem Upload',
        carryforward: 'Geschätzter Verlustvortrag',
        aiVerified: 'KI-geprüft',
        futureRefund: 'Geschätzte zukünftige Rückerstattung',
        taxRateNote: 'Bei angenommenem Steuersatz von 30 %',
      },
      categories: { title: 'Ausgaben nach Kategorie', filter: 'Filter' },
      savings: {
        title: 'So funktionieren deine Einsparungen',
        intro:
          'Ein „Verlustvortrag" erfasst deine Studienkosten jetzt, um sie später mit deinem zukünftigen Einkommen zu verrechnen.',
        recordedExpenses: 'Erfasste Ausgaben',
        futureTaxRate: 'Zukünftiger Steuersatz (geschätzt 30 %)',
        futureRefund: 'Zukünftige Rückerstattung',
      },
      ai: {
        title: 'KI-Vorschläge',
        suggestion1:
          '„Ich sehe, du hast eine Hotelrechnung für Barcelona (12. Nov) hochgeladen. Hast du die zugehörige Flugrechnung, um die vollen Reisekosten geltend zu machen?"',
        uploadFlight: 'Flugrechnung hochladen',
        suggestion2: 'Du hast die Internet-Pauschale für dieses Jahr noch nicht geltend gemacht.',
        addPauschale: 'Pauschale hinzufügen',
      },
    },
    upload: {
      title: 'Intelligenter Upload',
      subtitle:
        'Lade deine Finanzdokumente sicher hoch. Unsere KI extrahiert automatisch wichtige Daten, klassifiziert Ausgaben und identifiziert mögliche Verlustvorträge.',
      dropzone: {
        title: 'Rechnungen hier hineinziehen',
        subtitle: 'oder klicken, um sie von deinem Gerät auszuwählen',
        maxSize: 'Max. 25 MB',
      },
      queue: { title: 'Verarbeitungs-Warteschlange', viewAll: 'Alle Dokumente ansehen' },
      status: {
        extracting: 'KI extrahiert',
        verified: 'Geprüft',
        actionNeeded: 'Aktion erforderlich',
      },
      meta: {
        uploadedToday: 'Heute hochgeladen, 10:42 Uhr',
        uploadedYesterday: 'Gestern hochgeladen',
        missingVendor: 'Lieferanteninformation fehlt',
      },
      fields: { vendor: 'Lieferant', amount: 'Betrag' },
      review: 'Dokument prüfen',
    },
    documents: {
      title: 'Dokumente',
      subtitle: 'Verwalte und überprüfe deine hochgeladenen Steuerdokumente.',
      totalFiltered: 'Gefilterter Gesamtbetrag',
      search: 'Lieferanten oder Notizen suchen...',
      allYears: 'Alle Jahre',
      allCategories: 'Alle Kategorien',
      moreFilters: 'Weitere Filter',
      table: {
        date: 'Datum',
        vendor: 'Lieferant',
        category: 'Kategorie',
        amount: 'Betrag',
        action: 'Aktion',
        viewReceipt: 'Beleg ansehen',
      },
      pagination: '1–5 von 24 Dokumenten',
    },
  },
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

export default translations
