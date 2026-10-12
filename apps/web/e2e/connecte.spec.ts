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
  await page.keyboard.press('n')
  await page.waitForURL(/ventes\/factures\/nouvelle/)
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
