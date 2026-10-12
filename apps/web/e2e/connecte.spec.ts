/**
 * Parcours connecté de bout en bout. Nécessite un Supabase local (supabase/local/demarrer.sh)
 * et l'application lancée avec ses clés : E2E_CONNECTE=1 pnpm test:e2e.
 */
import { expect, test } from '@playwright/test'

test.skip(!process.env.E2E_CONNECTE, 'Supabase local requis (E2E_CONNECTE=1)')
test.describe.configure({ mode: 'serial' })

const email = `camille${Date.now()}@atelier-lumen.fr`
let slug = ''

test('inscription, entreprise et démarrage guidé', async ({ page }) => {
  await page.goto('/inscription')
  await page.getByLabel('Nom et prénom').fill('Camille Roux')
  await page.getByLabel('Email professionnel').fill(email)
  await page.getByLabel('Mot de passe').fill('facture2027')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await page.waitForURL(/bienvenue/)

  await page.getByLabel('Nom affiché').fill('Atelier Lumen')
  await page.getByRole('button', { name: 'Continuer' }).click()
  await page.waitForURL(/demarrage/)
  slug = new URL(page.url()).pathname.split('/')[1]!

  await page.getByText('Réel normal', { exact: true }).click()
  await page.getByRole('button', { name: 'Continuer' }).click()
  await page.getByLabel('IBAN').fill('FR76 3000 6000 0112 3456 7890 188')
  await page.getByRole('button', { name: 'Continuer' }).click()
  await expect(page.getByText('IBAN invalide')).toBeVisible()
  await page.getByLabel('IBAN').fill('FR76 3000 6000 0112 3456 7890 189')
  await page.getByRole('button', { name: 'Continuer' }).click()
  await page.waitForURL(/etape=apparence/)
  await page.getByRole('button', { name: 'Continuer' }).click()
  await page.getByLabel('Numéro de la prochaine facture').fill('42')
  await expect(page.getByText(/F-\d{4}-0042/)).toBeVisible()
  await page.getByRole('button', { name: 'Continuer' }).click()
  await page.getByRole('button', { name: 'Accéder au tableau de bord' }).click()
  await page.waitForURL(/tableau-de-bord/)
})

test('client, catalogue, tarif spécifique et import', async ({ page }) => {
  await page.goto('/connexion')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill('facture2027')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL(/tableau-de-bord/)

  await page.goto(`/${slug}/clients/nouveau`)
  await page.getByLabel('Raison sociale').fill('Atelier Dupont')
  await page.getByLabel('SIREN', { exact: true }).fill('123456789')
  await page.getByRole('button', { name: 'Créer le client' }).click()
  await expect(page.getByText('SIREN invalide').first()).toBeVisible()
  await page.getByLabel('SIREN', { exact: true }).fill('404 833 048')
  await page.getByRole('button', { name: 'Créer le client' }).click()
  await page.waitForURL(/clients\/[0-9a-f-]{36}$/)
  await expect(page.getByText('FR83404833048')).toBeVisible()
  const fiche = page.url()

  await page.goto(`/${slug}/catalogue/nouveau`)
  await page.getByLabel('Désignation').fill('Création logo')
  await page.getByLabel('Prix unitaire').fill('450')
  await page.getByRole('button', { name: 'Ajouter au catalogue' }).click()
  await page.waitForURL(new RegExp(`${slug}/catalogue$`))

  await page.goto(`${fiche}?onglet=tarifs`)
  await page.getByLabel('Prix pour ce client').fill('420')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('420,00').first()).toBeVisible()

  await page.goto(`/${slug}/clients/import`)
  await page.locator('input[type=file]').setInputFiles({
    name: 'clients.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Raison sociale;SIREN;Ville\r\nBoulangerie Kerlann;732829320;Quimper\r\nMauvais;111111111;Paris\r\n'),
  })
  await page.getByRole('button', { name: /Importer 2 clients/ }).click()
  await expect(page.getByText('1 client importé')).toBeVisible()
  await expect(page.getByText(/Ligne 3/)).toBeVisible()
})

test('facture : catalogue, saisie rapide, calcul, enregistrement automatique', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/connexion')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill('facture2027')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL(/tableau-de-bord/)

  // Raccourci « N » : nouvelle facture.
  // Réessayé tant que la page n'est pas hydratée (le raccourci est posé côté client).
  await expect(async () => {
    await page.keyboard.press('n')
    await page.waitForURL(/ventes\/factures\/nouvelle/, { timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await page.getByLabel('Client', { exact: true }).selectOption({ label: 'Atelier Dupont' })
  await expect(page.getByText('Entreprise France').first()).toBeVisible()

  const ligne1 = page.getByLabel('Désignation, ligne 1')
  await ligne1.fill('logo')
  await expect(page.getByRole('option', { name: /Création logo/ })).toBeVisible()
  await ligne1.press('Enter')
  // Prix spécifique du client (420 €) plutôt que le prix catalogue (450 €).
  await expect(page.getByLabel('Prix unitaire HT, ligne 1')).toHaveValue('420,00')
  await ligne1.press('Enter')
  const ligne2 = page.getByLabel('Désignation, ligne 2')
  await expect(ligne2).toBeFocused()
  await ligne2.fill('2 x Conseil 80')
  await ligne2.press('Enter')
  await expect(page.getByLabel('Désignation, ligne 2')).toHaveValue('Conseil')
  await expect(page.getByLabel('Quantité, ligne 2')).toHaveValue('2')
  await expect(page.getByLabel('Total HT, ligne 2')).toHaveText(/160,00/)
  await expect(page.getByLabel('Désignation, ligne 3')).toBeFocused()

  // 420 + 160 = 580 HT, TVA 20 % = 116, TTC 696.
  await expect(page.getByText(/696,00/).first()).toBeVisible()
  await expect(page.getByText(/TVA 20\s%\ssur\s580,00/)).toBeVisible()

  await page.waitForURL(/ventes\/factures\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('status').filter({ hasText: /^Enregistré/ })).toBeVisible()
  await expect(page.getByText('SIREN de votre entreprise')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Désignation, ligne 2')).toHaveValue('Conseil')
  await expect(page.getByLabel('Désignation, ligne 3')).toHaveCount(0)

  await page.goto(`/${slug}/ventes/factures?statut=brouillons`)
  await expect(page.getByRole('cell', { name: /696,00/ })).toBeVisible()
  await expect(page.getByText('Brouillon').first()).toBeVisible()
})

test('émission, numéro définitif, document figé, avoir total', async ({ page }) => {
  test.setTimeout(120_000)
  page.on('dialog', (d) => void d.accept())
  await page.goto('/connexion')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill('facture2027')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL(/tableau-de-bord/)

  // Identité légale de l'entreprise et adresse du client : requises pour émettre.
  await page.goto(`/${slug}/reglages`)
  await page.getByLabel('Forme juridique').selectOption('EI')
  await page.getByLabel('SIREN', { exact: true }).fill('732829320')
  await page.getByLabel('N° de TVA intracommunautaire').fill('FR44732829320')
  await page.getByLabel('Adresse', { exact: true }).fill('12 rue des Lilas')
  await page.getByLabel('Code postal').fill('75011')
  await page.getByLabel('Ville').fill('Paris')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/enregistr/i).first()).toBeVisible()

  await page.goto(`/${slug}/clients`)
  await page.getByRole('link', { name: /Atelier Dupont/ }).click()
  await page.getByRole('link', { name: 'Modifier' }).click()
  await page.getByLabel('Adresse', { exact: true }).fill('3 place du Marché')
  await page.getByLabel('Code postal').first().fill('69002')
  await page.getByLabel('Ville').first().fill('Lyon')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await page.waitForURL(/clients\/[0-9a-f-]{36}$/)

  await page.goto(`/${slug}/ventes/factures?statut=brouillons`)
  await page.getByRole('link', { name: 'Brouillon', exact: true }).first().click()
  await page.waitForURL(/ventes\/factures\/[0-9a-f-]{36}$/)
  await expect(page.getByText('Prête à émettre')).toBeVisible({ timeout: 15_000 })
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/editeur.png`, fullPage: true })
  await page.getByRole('button', { name: 'Émettre la facture' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Émettre la facture' }).click()

  await expect(page.getByRole('heading', { level: 1 })).toContainText(/F-\d{4}-0042/)
  await expect(page.getByText('Intégrité')).toBeVisible()
  await expect(page.getByText('Rang dans la chaîne')).toBeVisible()
  await expect(page.locator('.document-imprime')).toContainText('Indemnité forfaitaire')
  await expect(page.locator('.document-imprime')).toContainText('FR44732829320')
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/facture-emise.png`, fullPage: true })

  // Fichiers : PDF/A-3 Factur-X et XML EN 16931.
  await expect(page.getByText('PDF/A-3 Factur-X, profil EN 16931')).toBeVisible()
  const idFacture = page.url().split('/').pop()!
  const pdf = await page.request.get(`/${slug}/documents/${idFacture}/pdf`)
  expect(pdf.headers()['content-type']).toBe('application/pdf')
  expect(pdf.headers()['x-factur-x']).toBe('EN16931')
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')
  const cii = await page.request.get(`/${slug}/documents/${idFacture}/xml?format=cii`)
  expect(await cii.text()).toContain('<ram:TypeCode>380</ram:TypeCode>')
  const ubl = await page.request.get(`/${slug}/documents/${idFacture}/xml?format=ubl`)
  expect(await ubl.text()).toContain('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>')

  await page.getByRole('button', { name: 'Marquer comme envoyée' }).click()
  await expect(page.getByText('Envoyée').first()).toBeVisible()

  await page.getByRole('button', { name: 'Créer un avoir' }).click()
  await page.waitForURL(/ventes\/avoirs\/[0-9a-f-]{36}$/)
  await expect(page.getByText(/Avoir se rapportant à/)).toBeVisible()
  await expect(page.getByLabel('Quantité, ligne 1')).toHaveValue('-1')
  await page.getByRole('button', { name: 'Émettre l’avoir' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Émettre l’avoir' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/A-\d{4}-0001/)
  await expect(page.locator('.document-imprime')).toContainText(/Avoir se rapportant à la facture n° F-\d{4}-0042/)

  await page.goto(`/${slug}/ventes/factures`)
  await expect(page.getByText('Annulée').first()).toBeVisible()
})

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/connexion')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill('facture2027')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL(/tableau-de-bord/)
}

async function nouveauDocument(page: import('@playwright/test').Page, chemin: string, designation: string) {
  await page.goto(`/${slug}/${chemin}`)
  await page.getByLabel('Client', { exact: true }).selectOption({ label: 'Atelier Dupont · Lyon' })
  const ligne = page.getByLabel('Désignation, ligne 1')
  await ligne.fill(designation)
  await ligne.press('Tab')
  await page.waitForURL(/[0-9a-f-]{36}$/)
  await expect(page.getByText('Prête à émettre')).toBeVisible({ timeout: 15_000 })
}

test('paiements, envoi, récurrence et exports', async ({ page }) => {
  test.setTimeout(150_000)
  page.on('dialog', (d) => void d.accept())
  await connecter(page)

  await nouveauDocument(page, 'ventes/factures/nouvelle', '3 x Maintenance 100')
  await page.getByRole('button', { name: 'Émettre la facture' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Émettre la facture' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/F-\d{4}-0043/)

  // Paiement partiel puis solde : 3 × 100 € HT = 360 € TTC.
  await page.getByLabel('Montant', { exact: true }).fill('100')
  await page.getByRole('button', { name: 'Enregistrer le paiement' }).click()
  await expect(page.getByText('Paiement enregistré.')).toBeVisible()
  await expect(page.getByText('Paiement partiel')).toBeVisible()
  await expect(page.getByLabel('Montant', { exact: true })).toHaveValue('260,00')
  await page.getByRole('button', { name: 'Enregistrer le paiement' }).click()
  await expect(page.getByText(/^Soldée le/)).toBeVisible()
  await expect(page.getByText('Payée').first()).toBeVisible()

  // Envoi par email (simulé sans messagerie configurée) et lien de partage.
  await page.getByLabel('Destinataire').fill('compta@dupont.fr')
  await page.getByRole('button', { name: 'Envoyer par email' }).click()
  await expect(page.getByText(/Envoi simulé à compta@dupont\.fr/)).toBeVisible()
  await page.getByRole('button', { name: 'Créer un lien de partage' }).click()
  const lien = await page.getByLabel('Lien de partage').inputValue()
  expect(lien).toMatch(/\/d\/[0-9a-f-]{36}$/)

  // Récurrence mensuelle, générée depuis le tableau de bord.
  await page.getByText('Rendre récurrente').click()
  await page.getByRole('button', { name: 'Créer la récurrence' }).click()
  await expect(page.getByText(/Récurrence créée/)).toBeVisible()
  await page.goto(`/${slug}/tableau-de-bord`)
  await expect(page.getByText(/360,00/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Générer maintenant' }).click()
  await expect(page.getByText(/1 facture créée/)).toBeVisible()
  await page.goto(`/${slug}/ventes/recurrences`)
  await expect(page.getByText('Active')).toBeVisible()

  // Exports comptables.
  await page.goto(`/${slug}/comptabilite/exports`)
  await expect(page.getByText(/écritures équilibrées/)).toBeVisible()
  const debut = new Date().toISOString().slice(0, 7)
  const fecReponse = await page.request.get(`/${slug}/exports?type=fec&du=${debut}-01&au=${debut}-28`)
  expect(await fecReponse.text()).toContain('JournalCode\tJournalLib')
  const zip = await page.request.get(`/${slug}/exports?type=archive&du=${debut}-01&au=${debut}-28`)
  expect(zip.headers()['content-type']).toBe('application/zip')
})

test('devis accepté en ligne par le client', async ({ page, browser }) => {
  test.setTimeout(120_000)
  await connecter(page)
  await nouveauDocument(page, 'ventes/devis/nouveau', 'Refonte du site 2400')
  await page.getByRole('button', { name: 'Finaliser le devis' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Finaliser le devis' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/D-\d{4}-0001/)
  await page.getByRole('button', { name: 'Créer un lien de partage' }).click()
  const lien = await page.getByLabel('Lien de partage').inputValue()

  // Le client, sans compte.
  const contexte = await browser.newContext()
  const client = await contexte.newPage()
  await client.goto(lien)
  await expect(client.getByRole('heading', { level: 1 })).toContainText('Devis')
  await client.getByLabel('Nom et prénom').fill('Claire Dupont')
  await client.getByRole('button', { name: 'Accepter le devis' }).click()
  await expect(client.getByText('Cochez « Bon pour accord » pour accepter le devis.')).toBeVisible()
  await client.getByLabel(/Bon pour accord/).check()
  await client.getByRole('button', { name: 'Accepter le devis' }).click()
  await expect(client.getByRole('heading', { name: 'Devis accepté' })).toBeVisible()
  await expect(client.getByText(/Par Claire Dupont/)).toBeVisible()
  const pdf = await client.request.get(`${lien}/pdf`)
  expect(pdf.headers()['content-type']).toBe('application/pdf')
  await contexte.close()

  await page.reload()
  await expect(page.getByText('Accepté en ligne')).toBeVisible()
  await expect(page.getByText(/Par Claire Dupont/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Transformer en facture' })).toBeVisible()
})

test('plateforme agréée : transmission, cycle de vie, réception et e-reporting', async ({ page }) => {
  test.setTimeout(150_000)
  await connecter(page)

  await page.goto(`/${slug}/e-facturation/reforme`)
  await expect(page.getByText('Plateforme agréée choisie')).toBeVisible()
  await expect(page.getByText(/plateforme simulée : parfaite pour essayer/)).toBeVisible()

  // Transmission d'une facture émise et suivi de son cycle de vie.
  await page.goto(`/${slug}/ventes/factures?statut=payees`)
  await page.getByRole('link', { name: /F-\d{4}-0043/ }).click()
  await page.getByRole('button', { name: 'Transmettre via la plateforme' }).click()
  const panneau = page.getByRole('region', { name: 'Plateforme agréée' })
  await expect(panneau.getByText('Déposée').first()).toBeVisible()
  await panneau.getByRole('button', { name: 'Actualiser le statut' }).click()
  await expect(panneau.getByText('Émise').first()).toBeVisible()
  await panneau.getByRole('button', { name: 'Actualiser le statut' }).click()
  await expect(panneau.getByText('Reçue').first()).toBeVisible()

  // Réception d'une facture fournisseur, mise en litige motivée.
  await page.goto(`/${slug}/e-facturation/recues`)
  await page.getByRole('button', { name: 'Simuler une réception' }).click()
  await expect(page.getByText('Une facture fournisseur vient d’arriver.')).toBeVisible()
  await page.getByRole('cell').getByRole('link').first().click()
  await page.waitForURL(/recues\/[0-9a-f-]{36}$/)
  await page.getByLabel('Décision').selectOption('litige')
  await page.getByRole('button', { name: 'Transmettre la décision' }).click()
  await expect(page.getByText(/Indiquez le motif/)).toBeVisible()
  await page.getByLabel('Décision').selectOption('litige')
  await page.getByLabel(/Motif/).fill('Quantité livrée inférieure')
  await page.getByRole('button', { name: 'Transmettre la décision' }).click()
  await expect(page.getByText('« Quantité livrée inférieure »')).toBeVisible()
  await expect(page.getByText('En litige').first()).toBeVisible()

  // E-reporting : la période précédente se dépose une fois.
  await page.goto(`/${slug}/e-facturation/e-reporting`)
  await page.getByRole('button', { name: 'Déposer les transactions' }).click()
  await expect(page.getByText(/Déposé le/).first()).toBeVisible()
})

test('abonnement, invitation de l’expert-comptable, tableau des factures, export RGPD', async ({ page, browser }) => {
  test.setTimeout(150_000)
  await connecter(page)

  await page.goto(`/${slug}/reglages/abonnement`)
  await expect(page.getByText(/Essai gratuit · 1[34] jours restants/).first()).toBeVisible()
  await expect(page.getByText('Pastille Pro', { exact: true })).toBeVisible()

  // Invitation : sans messagerie configurée, le lien s'affiche pour être transmis.
  await page.goto(`/${slug}/reglages/membres`)
  const comptable = `compta${Date.now()}@cabinet.fr`
  await page.getByLabel('Email', { exact: true }).fill(comptable)
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click()
  const message = await page.getByText(/transmettez ce lien/).textContent()
  const lien = /(https?:\/\/\S+\/invitation\/[0-9a-f-]{36})/.exec(message ?? '')![1]!

  const contexte = await browser.newContext()
  const invite = await contexte.newPage()
  await invite.goto(new URL(lien).pathname)
  await expect(invite.getByRole('heading', { name: /Rejoindre Atelier Lumen/ })).toBeVisible()
  await invite.getByRole('link', { name: 'Créer mon compte' }).click()
  await invite.getByLabel('Nom et prénom').fill('Jeanne Comptable')
  await expect(invite.getByLabel('Email professionnel')).toHaveValue(comptable)
  await invite.getByLabel('Mot de passe').fill('cabinet2027x')
  await invite.getByRole('button', { name: 'Créer mon compte' }).click()
  await invite.waitForURL(/\/invitation\//)
  await invite.getByRole('button', { name: /Rejoindre Atelier Lumen/ }).click()
  await invite.waitForURL(/tableau-de-bord/)
  // Rôle expert-comptable : consultation, pas de création.
  await invite.goto(`/${slug}/ventes/factures`)
  await expect(invite.getByRole('link', { name: 'Nouvelle facture' })).toHaveCount(0)
  await contexte.close()

  await page.reload()
  await expect(page.getByText('Jeanne Comptable')).toBeVisible()

  // Tableau des factures par état.
  await page.goto(`/${slug}/ventes/factures?affichage=tableau`)
  await expect(page.getByRole('region', { name: 'Payée' })).toContainText(/F-\d{4}-0043/)
  await expect(page.getByRole('region', { name: 'Brouillon' })).toBeVisible()

  // Export RGPD.
  const zip = await page.request.get('/compte/export')
  expect(zip.headers()['content-type']).toBe('application/zip')
})
