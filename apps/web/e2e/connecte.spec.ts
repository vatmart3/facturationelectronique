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
