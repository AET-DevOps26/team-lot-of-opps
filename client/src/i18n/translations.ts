export const SUPPORTED_LANGUAGES = ['en', 'de'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export interface TranslationDict {
  brand: string
  sidebar: { title: string; subtitle: string }
  nav: {
    dashboard: string
    invoices: string
    upload: string
    export: string
    settings: string
    signInRequired: string
    menu: string
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
  auth: {
    signIn: string
    signOut: string
    accountMenu: string
    signingIn: string
    orContinueWith: string
    emailLabel: string
    passwordLabel: string
    confirmPasswordLabel: string
    signInWithEmail: string
    createAccount: string
    switchToSignUp: string
    switchToSignIn: string
    forgotPassword: string
    sendResetEmail: string
    resetEmailSent: string
    passwordHint: string
    passwordMismatch: string
    weakPassword: string
    emailInUse: string
    invalidCredentials: string
    invalidEmail: string
    userDisabled: string
    tooManyRequests: string
    networkError: string
    popupBlocked: string
    accountExists: string
    genericError: string
  }
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
      carryforwardNote: string
      aiVerified: string
      futureRefund: string
      taxRateNote: string
    }
    categories: { title: string; reverseOrder: string }
    savings: {
      title: string
      intro: string
      recordedExpenses: string
      futureTaxRate: string
      futureRefund: string
    }
    ai: {
      title: string
      subtitle: string
      loading: string
      error: string
      empty: string
      uploadCta: string
    }
  }
  upload: {
    title: string
    subtitle: string
    dropzone: { title: string; subtitle: string; maxSize: string }
    queue: { title: string; viewAll: string }
    status: { extracting: string; verified: string; actionNeeded: string; review: string; accepted: string }
    meta: { uploadedToday: string; uploadedYesterday: string; missingVendor: string; uploadFailed: string; reviewNeeded: string }
    fields: { vendor: string; amount: string }
    actions: { keep: string; edit: string; undo: string }
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
  invoices: {
    title: string
    subtitle: string
    totalFiltered: string
    search: string
    allYears: string
    allCategories: string
    moreFilters: string
    minAmount: string
    maxAmount: string
    clearAmount: string
    addInvoice: string
    editInvoice: string
    form: {
      itemName: string
      company: string
      price: string
      category: string
      date: string
      noCategory: string
      save: string
      cancel: string
      saveFailed: string
    }
    table: {
      date: string
      vendor: string
      category: string
      amount: string
      action: string
      viewReceipt: string
      edit: string
      delete: string
    }
    pagination: string
    confirmDelete: string
    deleteFailed: string
    viewFailed: string
  }
  chat: {
    title: string
    open: string
    close: string
    placeholder: string
    send: string
    stop: string
    emptyTitle: string
    emptyBody: string
    error: string
    sources: { one: string; other: string; jump: string }
  }
  export: {
    title: string
    subtitle: string
    taxYear: string
    noYears: string
    loadFailed: string
    summary: {
      title: string
      loading: string
      empty: string
    }
    table: { category: string; receipts: string; amount: string; total: string; uncategorized: string }
    downloads: {
      title: string
      zip: string
      zipHint: string
      pdf: string
      pdfHint: string
      csv: string
      csvHint: string
      preparing: string
      failed: string
    }
    disclaimer: string
  }
  // Keys match the backend InvoiceCategory enum (see lib/invoices.ts CATEGORY_KEYS).
  categories: Record<string, string>
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
      invoices: 'Invoices',
      upload: 'Upload',
      export: 'Export',
      settings: 'Settings',
      signInRequired: 'Sign in to access this section',
      menu: 'Menu',
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
    auth: {
      signIn: 'Sign in with Google',
      signOut: 'Sign out',
      accountMenu: 'Account menu',
      signingIn: 'Signing in…',
      orContinueWith: 'or continue with email',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      confirmPasswordLabel: 'Confirm password',
      signInWithEmail: 'Sign in',
      createAccount: 'Create account',
      switchToSignUp: "Don't have an account? Sign up",
      switchToSignIn: 'Already have an account? Sign in',
      forgotPassword: 'Forgot password?',
      sendResetEmail: 'Send reset email',
      resetEmailSent: 'Check your inbox — reset link sent.',
      passwordHint: 'Use at least 6 characters.',
      passwordMismatch: 'Passwords do not match.',
      weakPassword: 'Password must be at least 6 characters.',
      emailInUse: 'An account with this email already exists.',
      invalidCredentials: 'Incorrect email or password.',
      invalidEmail: 'Please enter a valid email address.',
      userDisabled: 'This account has been disabled.',
      tooManyRequests: 'Too many attempts. Please try again in a moment.',
      networkError: 'Network error. Check your connection and try again.',
      popupBlocked: 'Your browser blocked the sign-in popup. Please allow popups and try again.',
      accountExists: 'An account already exists with this email. Try signing in with email.',
      genericError: 'Something went wrong. Please try again.',
    },
    settings: {
      title: 'Settings',
      language: 'Language',
      languages: { en: 'English', de: 'German' },
      close: 'Close',
    },
    dashboard: {
      title: 'Tax Overview',
      subtitle: 'Here is the current state of your academic tax loss carryforward.',
      cards: {
        totalExpenses: 'Total Expenses',
        sinceLastUpload: 'since last upload',
        carryforward: 'Est. Loss Carryforward',
        carryforwardNote: 'From confirmed invoices only',
        aiVerified: 'AI Verified',
        futureRefund: 'Estimated Future Refund',
        taxRateNote: 'Based on your assumed tax rate',
      },
      categories: { title: 'Expenses by Category', reverseOrder: 'Reverse order' },
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
        subtitle: 'Based on your invoices, here is what we found.',
        loading: 'Analyzing your invoices…',
        error: 'Could not load suggestions right now.',
        empty: 'No suggestions yet — upload a document to get started.',
        uploadCta: 'Upload',
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
      queue: { title: 'Processing Queue', viewAll: 'View All Invoices' },
      status: {
        extracting: 'AI Extracting',
        verified: 'Verified',
        actionNeeded: 'Action Needed',
        review: 'Needs Review',
        accepted: 'Kept',
      },
      meta: {
        uploadedToday: 'Uploaded Today, 10:42 AM',
        uploadedYesterday: 'Uploaded Yesterday',
        missingVendor: 'Missing vendor information',
        uploadFailed: 'Upload failed',
        reviewNeeded: 'Review the extracted data, then keep or undo it',
      },
      fields: { vendor: 'Vendor', amount: 'Amount' },
      actions: { keep: 'Keep', edit: 'Edit', undo: 'Undo' },
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
    invoices: {
      title: 'Invoices',
      subtitle: 'Manage and review your uploaded invoices.',
      totalFiltered: 'Total Filtered Amount',
      search: 'Search vendors or notes...',
      allYears: 'All Years',
      allCategories: 'All Categories',
      moreFilters: 'More Filters',
      minAmount: 'Min Amount (€)',
      maxAmount: 'Max Amount (€)',
      clearAmount: 'Clear',
      addInvoice: 'Add Invoice',
      editInvoice: 'Edit Invoice',
      form: {
        itemName: 'Item Name',
        company: 'Vendor',
        price: 'Amount (€)',
        category: 'Category',
        date: 'Invoice Date',
        noCategory: 'No category',
        save: 'Save',
        cancel: 'Cancel',
        saveFailed: 'Failed to save invoice',
      },
      table: {
        date: 'Date',
        vendor: 'Vendor',
        category: 'Category',
        amount: 'Amount',
        action: 'Action',
        viewReceipt: 'View Receipt',
        edit: 'Edit',
        delete: 'Delete',
      },
      pagination: 'Showing 1-5 of 24 invoices',
      confirmDelete: 'Delete this invoice?',
      deleteFailed: 'Failed to delete invoice',
      viewFailed: 'Could not open invoice',
    },
    chat: {
      title: 'AI Assistant',
      open: 'Open AI Assistant',
      close: 'Close AI Assistant',
      placeholder: 'Ask about your documents…',
      send: 'Send message',
      stop: 'Stop generating',
      emptyTitle: 'Hi! How can I help?',
      emptyBody:
        'Ask me about your uploaded documents or what you should still upload for your tax return.',
      error: 'Something went wrong.',
      sources: { one: 'source', other: 'sources', jump: 'View this invoice' },
    },
    export: {
      title: 'Export',
      subtitle: 'Everything one tax year needs, in the form the Finanzamt expects it.',
      taxYear: 'Tax year',
      noYears: 'Nothing to export yet — upload and accept a receipt first.',
      loadFailed: 'Could not load this tax year.',
      summary: {
        title: 'Summary',
        loading: 'Loading…',
        empty: 'No accepted invoices for this year.',
      },
      table: {
        category: 'Category',
        receipts: 'Invoices',
        amount: 'Amount',
        total: 'Total',
        uncategorized: 'Uncategorized',
      },
      downloads: {
        title: 'Download',
        zip: 'Complete package (ZIP)',
        zipHint: 'Summary, spreadsheet, and every original receipt.',
        pdf: 'Summary sheet (PDF)',
        pdfHint: 'The German-language page you hand over. Not tax advice.',
        csv: 'Spreadsheet (CSV)',
        csvHint: 'One row per invoice, for your tax advisor.',
        preparing: 'Preparing…',
        failed: 'Download failed. Please try again.',
      },
      disclaimer: 'Only reviewed invoices are exported.',
    },
    categories: {
      KONTOFUEHRUNGSGEBUEHREN: 'Account maintenance fees',
      WEGE_ZUR_ARBEIT: 'Commuting to work',
      HOMEOFFICE_UND_ARBEITSZIMMER: 'Home office and study',
      INTERNET_UND_TELEFON: 'Internet and phone',
      ARBEITSMITTEL: 'Work equipment',
      BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN: 'Professional associations and unions',
      STEUERBERATUNGSKOSTEN: 'Tax advice costs',
      REISEKOSTEN: 'Travel expenses',
      BEWERBUNGEN: 'Job applications',
      FORTBILDUNGEN: 'Further education',
      UMZUG: 'Relocation',
      BEWIRTUNG: 'Hospitality',
      DOPPELTER_HAUSHALT: 'Second household',
      AUSSERGEWOEHNLICHE_FAHRZEUGKOSTEN: 'Extraordinary vehicle costs',
      SONSTIGE_AUSGABEN: 'Other expenses',
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
      invoices: 'Rechnungen',
      upload: 'Hochladen',
      export: 'Export',
      settings: 'Einstellungen',
      signInRequired: 'Anmelden, um diesen Bereich zu nutzen',
      menu: 'Menü',
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
    auth: {
      signIn: 'Mit Google anmelden',
      signOut: 'Abmelden',
      accountMenu: 'Kontomenü',
      signingIn: 'Anmelden…',
      orContinueWith: 'oder mit E-Mail fortfahren',
      emailLabel: 'E-Mail',
      passwordLabel: 'Passwort',
      confirmPasswordLabel: 'Passwort bestätigen',
      signInWithEmail: 'Anmelden',
      createAccount: 'Konto erstellen',
      switchToSignUp: 'Noch kein Konto? Registrieren',
      switchToSignIn: 'Bereits ein Konto? Anmelden',
      forgotPassword: 'Passwort vergessen?',
      sendResetEmail: 'Reset-E-Mail senden',
      resetEmailSent: 'Postfach prüfen — Reset-Link wurde gesendet.',
      passwordHint: 'Mindestens 6 Zeichen verwenden.',
      passwordMismatch: 'Passwörter stimmen nicht überein.',
      weakPassword: 'Passwort muss mindestens 6 Zeichen haben.',
      emailInUse: 'Ein Konto mit dieser E-Mail existiert bereits.',
      invalidCredentials: 'Falsche E-Mail oder falsches Passwort.',
      invalidEmail: 'Bitte eine gültige E-Mail-Adresse eingeben.',
      userDisabled: 'Dieses Konto wurde deaktiviert.',
      tooManyRequests: 'Zu viele Versuche. Bitte versuche es gleich erneut.',
      networkError: 'Netzwerkfehler. Bitte Verbindung prüfen und erneut versuchen.',
      popupBlocked: 'Dein Browser hat das Anmelde-Popup blockiert. Bitte Popups erlauben und erneut versuchen.',
      accountExists: 'Mit dieser E-Mail existiert bereits ein Konto. Versuche, dich mit E-Mail anzumelden.',
      genericError: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
    },
    settings: {
      title: 'Einstellungen',
      language: 'Sprache',
      languages: { en: 'Englisch', de: 'Deutsch' },
      close: 'Schließen',
    },
    dashboard: {
      title: 'Steuerübersicht',
      subtitle: 'Hier ist der aktuelle Stand deines akademischen Verlustvortrags.',
      cards: {
        totalExpenses: 'Gesamtausgaben',
        sinceLastUpload: 'seit letztem Upload',
        carryforward: 'Geschätzter Verlustvortrag',
        carryforwardNote: 'Nur aus bestätigten Rechnungen',
        aiVerified: 'KI-geprüft',
        futureRefund: 'Geschätzte zukünftige Rückerstattung',
        taxRateNote: 'Basierend auf deinem angenommenen Steuersatz',
      },
      categories: { title: 'Ausgaben nach Kategorie', reverseOrder: 'Reihenfolge umkehren' },
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
        subtitle: 'Basierend auf deinen Rechnungen haben wir Folgendes gefunden.',
        loading: 'Deine Rechnungen werden analysiert…',
        error: 'Vorschläge konnten gerade nicht geladen werden.',
        empty: 'Noch keine Vorschläge — lade ein Dokument hoch, um zu starten.',
        uploadCta: 'Hochladen',
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
      queue: { title: 'Verarbeitungs-Warteschlange', viewAll: 'Alle Rechnungen ansehen' },
      status: {
        extracting: 'KI extrahiert',
        verified: 'Geprüft',
        actionNeeded: 'Aktion erforderlich',
        review: 'Zu prüfen',
        accepted: 'Übernommen',
      },
      meta: {
        uploadedToday: 'Heute hochgeladen, 10:42 Uhr',
        uploadedYesterday: 'Gestern hochgeladen',
        missingVendor: 'Lieferanteninformation fehlt',
        uploadFailed: 'Upload fehlgeschlagen',
        reviewNeeded: 'Prüfe die extrahierten Daten, dann übernehmen oder verwerfen',
      },
      fields: { vendor: 'Lieferant', amount: 'Betrag' },
      actions: { keep: 'Übernehmen', edit: 'Bearbeiten', undo: 'Verwerfen' },
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
    invoices: {
      title: 'Rechnungen',
      subtitle: 'Verwalte und überprüfe deine hochgeladenen Rechnungen.',
      totalFiltered: 'Gefilterter Gesamtbetrag',
      search: 'Lieferanten oder Notizen suchen...',
      allYears: 'Alle Jahre',
      allCategories: 'Alle Kategorien',
      moreFilters: 'Weitere Filter',
      minAmount: 'Min. Betrag (€)',
      maxAmount: 'Max. Betrag (€)',
      clearAmount: 'Zurücksetzen',
      addInvoice: 'Rechnung hinzufügen',
      editInvoice: 'Rechnung bearbeiten',
      form: {
        itemName: 'Bezeichnung',
        company: 'Lieferant',
        price: 'Betrag (€)',
        category: 'Kategorie',
        date: 'Rechnungsdatum',
        noCategory: 'Keine Kategorie',
        save: 'Speichern',
        cancel: 'Abbrechen',
        saveFailed: 'Rechnung konnte nicht gespeichert werden',
      },
      table: {
        date: 'Datum',
        vendor: 'Lieferant',
        category: 'Kategorie',
        amount: 'Betrag',
        action: 'Aktion',
        viewReceipt: 'Beleg ansehen',
        edit: 'Bearbeiten',
        delete: 'Löschen',
      },
      pagination: '1–5 von 24 Rechnungen',
      confirmDelete: 'Diese Rechnung löschen?',
      deleteFailed: 'Rechnung konnte nicht gelöscht werden',
      viewFailed: 'Rechnung konnte nicht geöffnet werden',
    },
    chat: {
      title: 'KI-Assistent',
      open: 'KI-Assistent öffnen',
      close: 'KI-Assistent schließen',
      placeholder: 'Frag mich zu deinen Dokumenten…',
      send: 'Nachricht senden',
      stop: 'Generierung stoppen',
      emptyTitle: 'Hallo! Wie kann ich helfen?',
      emptyBody:
        'Frag mich zu deinen hochgeladenen Dokumenten oder was du für deine Steuererklärung noch hochladen solltest.',
      error: 'Etwas ist schiefgelaufen.',
      sources: { one: 'Quelle', other: 'Quellen', jump: 'Rechnung anzeigen' },
    },
    export: {
      title: 'Export',
      subtitle: 'Alles für ein Steuerjahr — in der Form, die das Finanzamt erwartet.',
      taxYear: 'Steuerjahr',
      noYears: 'Noch nichts zu exportieren — lade zuerst einen Beleg hoch und bestätige ihn.',
      loadFailed: 'Dieses Steuerjahr konnte nicht geladen werden.',
      summary: {
        title: 'Zusammenfassung',
        loading: 'Wird geladen…',
        empty: 'Keine bestätigten Rechnungen für dieses Jahr.',
      },
      table: {
        category: 'Kategorie',
        receipts: 'Rechnungen',
        amount: 'Betrag',
        total: 'Gesamt',
        uncategorized: 'Ohne Kategorie',
      },
      downloads: {
        title: 'Herunterladen',
        zip: 'Komplettpaket (ZIP)',
        zipHint: 'Aufstellung, Tabelle und alle Originalbelege.',
        pdf: 'Aufstellung (PDF)',
        pdfHint: 'Die Seite, die du abgibst. Keine Steuerberatung.',
        csv: 'Tabelle (CSV)',
        csvHint: 'Eine Zeile pro Rechnung, für dein Steuerbüro.',
        preparing: 'Wird vorbereitet…',
        failed: 'Download fehlgeschlagen. Bitte versuch es erneut.',
      },
      disclaimer: 'Es werden nur geprüfte Rechnungen exportiert.',
    },
    categories: {
      KONTOFUEHRUNGSGEBUEHREN: 'Kontoführungsgebühren',
      WEGE_ZUR_ARBEIT: 'Wege zur Arbeit',
      HOMEOFFICE_UND_ARBEITSZIMMER: 'Homeoffice und Arbeitszimmer',
      INTERNET_UND_TELEFON: 'Internet und Telefon',
      ARBEITSMITTEL: 'Arbeitsmittel',
      BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN: 'Berufsverbände und Gewerkschaften',
      STEUERBERATUNGSKOSTEN: 'Steuerberatungskosten',
      REISEKOSTEN: 'Reisekosten',
      BEWERBUNGEN: 'Bewerbungen',
      FORTBILDUNGEN: 'Fortbildungen',
      UMZUG: 'Umzug',
      BEWIRTUNG: 'Bewirtung',
      DOPPELTER_HAUSHALT: 'Doppelter Haushalt',
      AUSSERGEWOEHNLICHE_FAHRZEUGKOSTEN: 'Außergewöhnliche Fahrzeugkosten',
      SONSTIGE_AUSGABEN: 'Sonstige Ausgaben',
    },
  },
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

export default translations
